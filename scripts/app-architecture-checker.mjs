import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const defaultSourceExtensions = [".ts", ".tsx"];
const defaultIgnoredPathFragments = ["/api/generated/"];
const defaultIgnoredFilePatterns = [/\.test\.[tj]sx?$/u, /routeTree\.gen\.ts$/u];

export function runAppArchitectureCheck(options) {
  const appRoot = resolvePath(options.appRoot);
  const srcRoot = path.join(appRoot, options.srcDir ?? "src");
  const aliasPrefix = options.aliasPrefix ?? "#/";
  const sourceExtensions =
    options.sourceExtensions ?? defaultSourceExtensions;
  const ignoredPathFragments =
    options.ignoredPathFragments ?? defaultIgnoredPathFragments;
  const ignoredFilePatterns =
    options.ignoredFilePatterns ?? defaultIgnoredFilePatterns;
  const rules = {
    routesMayImportFeaturePublicApisOnly: false,
    ...options.rules,
  };

  const files = collectSourceFiles({
    root: srcRoot,
    ignoredPathFragments,
    ignoredFilePatterns,
    sourceExtensions,
  });
  const violations = [];
  const graph = new Map();
  const context = {
    aliasPrefix,
    rules,
    sourceExtensions,
    srcRoot,
    violations,
  };

  for (const file of files) {
    const normalizedFile = normalizePath(file);
    const source = readFileSync(file, "utf8");
    const imports = extractImports(source);
    const edges = [];

    for (const importRecord of imports) {
      const resolved = resolveImport(context, file, importRecord.specifier);
      if (resolved) {
        edges.push(normalizePath(resolved));
      }
      checkImportRules(context, { file, importRecord, resolved });
    }

    graph.set(normalizedFile, edges);
  }

  checkCycles(context, graph);

  if (violations.length > 0) {
    console.error("Architecture check failed:");
    for (const violation of violations) {
      console.error(`- ${violation.file}: ${violation.message}`);
    }
    process.exit(1);
  }

  console.log(`Architecture check passed (${files.length} files).`);
}

function resolvePath(value) {
  if (value instanceof URL) {
    return path.resolve(fileURLToPath(value));
  }
  return path.resolve(value);
}

function collectSourceFiles({
  root,
  ignoredPathFragments,
  ignoredFilePatterns,
  sourceExtensions,
}) {
  const result = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    const normalized = normalizePath(fullPath);
    if (entry.isDirectory()) {
      if (
        ignoredPathFragments.some((fragment) => normalized.includes(fragment))
      ) {
        continue;
      }
      result.push(
        ...collectSourceFiles({
          root: fullPath,
          ignoredPathFragments,
          ignoredFilePatterns,
          sourceExtensions,
        }),
      );
      continue;
    }
    if (!sourceExtensions.some((extension) => entry.name.endsWith(extension))) {
      continue;
    }
    if (ignoredFilePatterns.some((pattern) => pattern.test(entry.name))) {
      continue;
    }
    result.push(fullPath);
  }
  return result;
}

function extractImports(source) {
  const imports = [];
  const dynamicImportPattern = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/gu;

  for (const importedFile of ts.preProcessFile(source, true, true)
    .importedFiles) {
    imports.push({
      raw: findImportStatement(source, importedFile.fileName),
      specifier: importedFile.fileName,
    });
  }
  for (const match of source.matchAll(dynamicImportPattern)) {
    imports.push({ raw: match[0], specifier: match[1] });
  }

  return imports;
}

function findImportStatement(source, specifier) {
  const quotedSpecifier = `["']${escapeRegExp(specifier)}["']`;
  const pattern = new RegExp(
    `\\b(?:import|export)\\b[\\s\\S]{0,500}?${quotedSpecifier}`,
    "u",
  );
  return pattern.exec(source)?.[0] ?? specifier;
}

function checkImportRules(context, { file, importRecord, resolved }) {
  const relativeFile = toSrcRelativePath(context, file);
  const specifier = importRecord.specifier;
  const importedPath = resolved ? toSrcRelativePath(context, resolved) : null;

  if (context.rules.routesMayImportFeaturePublicApisOnly) {
    if (isRouteFile(relativeFile)) {
      const featureImport = getFeatureImport(specifier, importedPath);
      if (featureImport?.isDeepImport) {
        addViolation(
          context,
          relativeFile,
          `routes may import feature public APIs only: ${specifier}`,
        );
      }
    }
  }

  const importerFeature = getOwningFeature(relativeFile);
  if (importerFeature) {
    const featureImport = getFeatureImport(specifier, importedPath);
    if (
      featureImport &&
      featureImport.feature !== importerFeature &&
      featureImport.isDeepImport
    ) {
      addViolation(
        context,
        relativeFile,
        `cross-feature imports must target public entrypoints: ${specifier}`,
      );
    }
  }

  if (isFeatureUiFile(relativeFile)) {
    if (isGeneratedApiImport(specifier, importedPath)) {
      addViolation(
        context,
        relativeFile,
        `feature UI may not import generated API: ${specifier}`,
      );
    }
    if (isDomainHookOrKeyImport(specifier, importedPath, importRecord)) {
      addViolation(
        context,
        relativeFile,
        `feature UI may not import domain hooks or keys: ${specifier}`,
      );
    }
    if (specifier === "@tanstack/react-query") {
      addViolation(
        context,
        relativeFile,
        "feature UI may not import React Query directly",
      );
    }
  }

  if (isFeatureControllerFile(relativeFile)) {
    if (isGeneratedApiImport(specifier, importedPath)) {
      addViolation(
        context,
        relativeFile,
        `feature controllers may not import generated API: ${specifier}`,
      );
    }
    if (isDomainKeyImport(specifier, importedPath, importRecord)) {
      addViolation(
        context,
        relativeFile,
        `feature controllers may not import domain query keys: ${specifier}`,
      );
    }
  }

  if (relativeFile.startsWith("domains/")) {
    if (
      startsWithAnyInternal(importedPath, [
        "features/",
        "routes/",
        "components/",
      ]) ||
      specifier.startsWith("@lemma/ui")
    ) {
      addViolation(
        context,
        relativeFile,
        `domains may not import features, routes, or app UI: ${specifier}`,
      );
    }
  }

  if (relativeFile.startsWith("components/patterns/")) {
    if (startsWithAnyInternal(importedPath, ["domains/", "features/"])) {
      addViolation(
        context,
        relativeFile,
        `shared patterns may not import domains or features: ${specifier}`,
      );
    }
  }
}

function checkCycles(context, sourceGraph) {
  const visited = new Set();
  const active = new Set();
  const stack = [];

  for (const file of sourceGraph.keys()) {
    visit(file);
  }

  function visit(file) {
    if (active.has(file)) {
      const cycleStart = stack.indexOf(file);
      const cycle = [...stack.slice(cycleStart), file].map((item) =>
        toSrcRelativePath(context, item),
      );
      addViolation(
        context,
        cycle[0],
        `dependency cycle detected: ${cycle.join(" -> ")}`,
      );
      return;
    }
    if (visited.has(file)) {
      return;
    }

    visited.add(file);
    active.add(file);
    stack.push(file);
    for (const next of sourceGraph.get(file) ?? []) {
      if (sourceGraph.has(next)) {
        visit(next);
      }
    }
    stack.pop();
    active.delete(file);
  }
}

function resolveImport(context, importerFile, specifier) {
  if (specifier.startsWith(context.aliasPrefix)) {
    return resolveSourcePath(
      context,
      path.join(
        context.srcRoot,
        specifier.slice(context.aliasPrefix.length),
      ),
    );
  }
  if (specifier.startsWith(".")) {
    return resolveSourcePath(
      context,
      path.resolve(path.dirname(importerFile), specifier),
    );
  }
  return null;
}

function resolveSourcePath(context, basePath) {
  const candidates = [
    basePath,
    ...context.sourceExtensions.map((extension) => `${basePath}${extension}`),
    ...context.sourceExtensions.map((extension) =>
      path.join(basePath, `index${extension}`),
    ),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function getFeatureImport(specifier, importedPath) {
  const specifierMatch = specifier.match(/^#\/features\/([^/]+)(?:\/(.+))?$/u);
  if (specifierMatch) {
    return {
      feature: specifierMatch[1],
      isDeepImport: Boolean(specifierMatch[2]),
    };
  }

  const pathMatch = importedPath?.match(/^features\/([^/]+)(?:\/(.+))?$/u);
  if (!pathMatch) {
    return null;
  }

  return {
    feature: pathMatch[1],
    isDeepImport:
      pathMatch[2] !== undefined && !pathMatch[2].startsWith("index."),
  };
}

function getOwningFeature(relativeFile) {
  return relativeFile.match(/^features\/([^/]+)\//u)?.[1] ?? null;
}

function isRouteFile(relativeFile) {
  return relativeFile.startsWith("routes/");
}

function isFeatureUiFile(relativeFile) {
  return relativeFile.startsWith("features/") && relativeFile.endsWith(".tsx");
}

function isFeatureControllerFile(relativeFile) {
  return (
    relativeFile.startsWith("features/") &&
    /(?:^|\/)(?:use-)?[a-z0-9-]*controller[a-z0-9-]*\.[tj]sx?$/u.test(
      relativeFile,
    )
  );
}

function isGeneratedApiImport(specifier, importedPath) {
  return (
    specifier.startsWith("#/api/generated") ||
    importedPath?.startsWith("api/generated/")
  );
}

function isDomainHookOrKeyImport(specifier, importedPath, importRecord) {
  return (
    isDomainKeyImport(specifier, importedPath, importRecord) ||
    /^#\/domains\/[^/]+\/hooks(?:\/|$)/u.test(specifier) ||
    /^domains\/[^/]+\/hooks(?:\.|\/)/u.test(importedPath ?? "") ||
    importsDomainHookName(importRecord)
  );
}

function isDomainKeyImport(specifier, importedPath, importRecord) {
  return (
    /^#\/domains\/[^/]+\/keys(?:\/|$)/u.test(specifier) ||
    /^domains\/[^/]+\/keys(?:\.|\/)/u.test(importedPath ?? "") ||
    importsDomainKeyName(importRecord)
  );
}

function importsDomainHookName(importRecord) {
  if (!importRecord.specifier.startsWith("#/domains/")) {
    return false;
  }
  return /\buse[A-Z][A-Za-z0-9]*(?:Query|Mutation)\b/u.test(importRecord.raw);
}

function importsDomainKeyName(importRecord) {
  if (!importRecord.specifier.startsWith("#/domains/")) {
    return false;
  }
  return /\b[A-Za-z0-9]*(?:Key|Keys|queryKey|queryKeys)\b/u.test(
    importRecord.raw,
  );
}

function startsWithAnyInternal(importedPath, prefixes) {
  return (
    importedPath !== null &&
    prefixes.some((prefix) => importedPath.startsWith(prefix))
  );
}

function addViolation(context, file, message) {
  context.violations.push({ file, message });
}

function toSrcRelativePath(context, file) {
  return normalizePath(path.relative(context.srcRoot, path.resolve(file)));
}

function normalizePath(file) {
  return file.split(path.sep).join("/");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
