import { builtinModules } from "node:module";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const sourceRoots = ["apps", "packages", "scripts"].map((root) =>
  path.join(repoRoot, root),
);
const sourceExtensions = [
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
];
const ignoredDirectoryNames = new Set([
  ".git",
  ".turbo",
  "__snapshots__",
  "dist",
  "gen",
  "generated",
  "node_modules",
  "openapi",
]);
const ignoredFilePatterns = [/\.test\.[cm]?[tj]sx?$/u, /\.d\.ts$/u];
const domainForbiddenPackagePrefixes = [
  "@lemma/db",
  "@lemma/http",
  "@lemma/identity/application",
  "@lemma/files/application",
  "@lemma/files/http",
  "@lemma/files/infrastructure",
  "@lemma/workbook/application",
  "@lemma/workbook/http",
  "@lemma/workbook/infrastructure",
];
const domainForbiddenLayerPattern =
  /^@lemma\/[^/]+\/(?:application|http|infrastructure)(?:\/|$)/u;
const domainForbiddenExternalPackages = new Set(["hono", "kysely", "zod"]);
const builtinPackageNames = new Set(
  builtinModules.map((moduleName) => moduleName.replace(/^node:/u, "")),
);

const workspacePackages = discoverWorkspacePackages();
const workspacePackagesByName = new Map(
  workspacePackages.map((workspacePackage) => [
    workspacePackage.packageJson.name,
    workspacePackage,
  ]),
);
const rootPackage = createWorkspacePackage(repoRoot);
const files = sourceRoots.flatMap(collectSourceFiles);
const violations = [];

for (const file of files) {
  const source = readFileSync(file, "utf8");
  const imports = extractImports(source);
  for (const importRecord of imports) {
    checkNoPackageSrcImport(file, importRecord.specifier);
    checkNoPackageDistImport(file, importRecord.specifier);
    checkDomainImportRules(file, importRecord.specifier);
    checkDeclaredDependency(file, importRecord.specifier);
    checkWorkspaceExport(file, importRecord.specifier);
  }
}

if (violations.length > 0) {
  console.error("Package boundary check failed:");
  for (const violation of violations) {
    console.error(`- ${violation.file}: ${violation.message}`);
  }
  process.exit(1);
}

console.log(`Package boundary check passed (${files.length} files).`);

function collectSourceFiles(root) {
  const result = [];
  if (!existsSync(root)) {
    return result;
  }
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectoryNames.has(entry.name)) {
      continue;
    }
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      result.push(...collectSourceFiles(fullPath));
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
  const requirePattern = /\brequire\s*\(\s*["']([^"']+)["']\s*\)/gu;

  for (const importedFile of ts.preProcessFile(source, true, true)
    .importedFiles) {
    imports.push({ specifier: importedFile.fileName });
  }
  for (const match of source.matchAll(dynamicImportPattern)) {
    imports.push({ specifier: match[1] });
  }
  for (const match of source.matchAll(requirePattern)) {
    imports.push({ specifier: match[1] });
  }

  return imports;
}

function checkNoPackageDistImport(file, specifier) {
  if (/^@lemma\/[^/]+\/dist(?:\/|$)/u.test(specifier)) {
    addViolation(file, `do not import another package dist path: ${specifier}`);
    return;
  }
}

function checkNoPackageSrcImport(file, specifier) {
  if (/^@lemma\/[^/]+\/src(?:\/|$)/u.test(specifier)) {
    addViolation(file, `do not import another package src path: ${specifier}`);
    return;
  }

  if (!specifier.startsWith(".")) {
    return;
  }

  const resolved = resolveRelativeImport(file, specifier);
  if (!resolved) {
    return;
  }
  const importerPackage = getOwningWorkspacePackage(file) ?? rootPackage;
  const importedPackage = getOwningWorkspacePackage(resolved);
  if (
    importerPackage &&
    importedPackage &&
    importerPackage.packageJson.name !== importedPackage.packageJson.name &&
    isWorkspaceSourceFile(resolved)
  ) {
    addViolation(
      file,
      `do not import another workspace source path: ${specifier}`,
    );
  }
}

function checkDeclaredDependency(file, specifier) {
  const packageName = getBarePackageName(specifier);
  if (!packageName) {
    return;
  }
  const owner = getOwningWorkspacePackage(file) ?? rootPackage;
  if (!owner || owner.packageJson.name === packageName) {
    return;
  }
  if (!owner.declaredDependencyNames.has(packageName)) {
    addViolation(
      file,
      `imported package is not declared in ${owner.relativePackageJsonPath}: ${packageName}`,
    );
  }
}

function checkWorkspaceExport(file, specifier) {
  const packageName = getBarePackageName(specifier);
  if (!packageName) {
    return;
  }
  const importedPackage = workspacePackagesByName.get(packageName);
  if (!importedPackage) {
    return;
  }
  const subpath =
    specifier === packageName ? "." : `.${specifier.slice(packageName.length)}`;
  if (!isPackageSubpathExported(importedPackage.packageJson, subpath)) {
    addViolation(file, `${packageName} does not export subpath ${subpath}`);
  }
}

function checkDomainImportRules(file, specifier) {
  if (!isDomainSourceFile(file)) {
    return;
  }

  if (
    [...domainForbiddenExternalPackages].some(
      (packageName) =>
        specifier === packageName || specifier.startsWith(`${packageName}/`),
    ) ||
    domainForbiddenPackagePrefixes.some(
      (prefix) => specifier === prefix || specifier.startsWith(`${prefix}/`),
    ) ||
    domainForbiddenLayerPattern.test(specifier)
  ) {
    addViolation(file, `domain layer may not import ${specifier}`);
    return;
  }

  if (!specifier.startsWith(".")) {
    return;
  }

  const resolved = resolveRelativeImport(file, specifier);
  if (resolved && !isDomainSourceFile(resolved)) {
    addViolation(
      file,
      `domain layer may not import outside domain: ${specifier}`,
    );
  }
}

function resolveRelativeImport(importerFile, specifier) {
  const basePath = path.resolve(path.dirname(importerFile), specifier);
  const sourceBasePath = getSourceBasePath(basePath);
  const candidates = [
    basePath,
    ...sourceExtensions.map((extension) => `${sourceBasePath}${extension}`),
    ...sourceExtensions.map((extension) =>
      path.join(sourceBasePath, `index${extension}`),
    ),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function getSourceBasePath(basePath) {
  const extension = path.extname(basePath);
  if ([".js", ".jsx", ".mjs", ".cjs"].includes(extension)) {
    return basePath.slice(0, -extension.length);
  }
  return basePath;
}

function getOwningWorkspacePackage(file) {
  const normalizedFile = normalizePath(file);
  return (
    workspacePackages.find((workspacePackage) =>
      normalizedFile.startsWith(`${workspacePackage.normalizedDir}/`),
    ) ?? null
  );
}

function isWorkspaceSourceFile(file) {
  return /^(?:apps|packages)\/[^/]+\/src\//u.test(
    normalizePath(path.relative(repoRoot, file)),
  );
}

function isDomainSourceFile(file) {
  return /^packages\/[^/]+\/src\/domain\//u.test(
    normalizePath(path.relative(repoRoot, file)),
  );
}

function addViolation(file, message) {
  violations.push({
    file: normalizePath(path.relative(repoRoot, file)),
    message,
  });
}

function normalizePath(file) {
  return file.split(path.sep).join("/");
}

function discoverWorkspacePackages() {
  const result = [];
  for (const workspaceRoot of ["apps", "packages"]) {
    const root = path.join(repoRoot, workspaceRoot);
    if (!existsSync(root)) {
      continue;
    }
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }
      const workspacePackage = createWorkspacePackage(
        path.join(root, entry.name),
      );
      if (workspacePackage) {
        result.push(workspacePackage);
      }
    }
  }
  return result;
}

function createWorkspacePackage(directory) {
  const packageJsonPath = path.join(directory, "package.json");
  if (!existsSync(packageJsonPath)) {
    return null;
  }
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  if (typeof packageJson.name !== "string" || packageJson.name.length === 0) {
    return null;
  }
  return {
    directory,
    normalizedDir: normalizePath(directory),
    packageJson,
    relativePackageJsonPath: normalizePath(
      path.relative(repoRoot, packageJsonPath),
    ),
    declaredDependencyNames: getDeclaredDependencyNames(packageJson),
  };
}

function getDeclaredDependencyNames(packageJson) {
  return new Set(
    [
      packageJson.dependencies,
      packageJson.devDependencies,
      packageJson.peerDependencies,
      packageJson.optionalDependencies,
    ].flatMap((dependencies) => Object.keys(dependencies ?? {})),
  );
}

function getBarePackageName(specifier) {
  if (
    specifier.startsWith(".") ||
    specifier.startsWith("/") ||
    specifier.startsWith("#") ||
    specifier.startsWith("virtual:")
  ) {
    return null;
  }
  const normalized = specifier.replace(/^node:/u, "");
  const firstSegment = normalized.split("/")[0];
  if (builtinPackageNames.has(firstSegment)) {
    return null;
  }
  if (normalized.startsWith("@")) {
    const [scope, name] = normalized.split("/");
    return scope && name ? `${scope}/${name}` : normalized;
  }
  return firstSegment ?? normalized;
}

function isPackageSubpathExported(packageJson, subpath) {
  const exportsField = packageJson.exports;
  if (exportsField === undefined) {
    return subpath === ".";
  }
  if (typeof exportsField === "string" || Array.isArray(exportsField)) {
    return subpath === ".";
  }
  if (typeof exportsField !== "object" || exportsField === null) {
    return false;
  }
  const exportKeys = Object.keys(exportsField).filter((key) =>
    key.startsWith("."),
  );
  if (exportKeys.length === 0) {
    return subpath === ".";
  }
  return exportKeys.some((exportKey) =>
    exportKey.includes("*")
      ? wildcardExportMatches(exportKey, subpath)
      : exportKey === subpath,
  );
}

function wildcardExportMatches(exportKey, subpath) {
  const pattern = `^${escapeRegExp(exportKey).replaceAll("\\*", ".+")}$`;
  return new RegExp(pattern, "u").test(subpath);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
