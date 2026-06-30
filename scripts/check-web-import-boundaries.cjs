const fs = require("node:fs");
const { builtinModules } = require("node:module");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const webSourceRoot = path.join(root, "apps/web/src");
const inlineBlueprintSourceRoot = path.join(
  root,
  "packages/questions/src/domain/blueprint-document",
);
const sourceExtensions = new Set([".ts", ".tsx"]);
const allowedQuestionsImports = new Set(["@lemma/questions/inline-blueprint"]);
const forbiddenWebPackages = new Set([
  "@lemma/db",
  "@lemma/events",
  "@lemma/files",
  "@lemma/identity",
  "@lemma/jobs",
  "@lemma/ops",
  "@lemma/workbook",
]);
const forbiddenInlineBlueprintPackages = new Set([
  "@lemma/db",
  "@lemma/events",
  "@lemma/files",
  "@lemma/identity",
  "@lemma/jobs",
  "@lemma/ops",
  "@lemma/workbook",
  "hono",
  "kysely",
  "react",
]);
const allowedInlineBlueprintTestBuiltins = new Set([
  "node:assert",
  "node:assert/strict",
  "node:test",
]);
const nodeBuiltinSpecifiers = new Set(
  builtinModules.flatMap((specifier) => [
    specifier,
    specifier.replace(/^node:/u, ""),
  ]),
);

function collectSourceFiles(directory) {
  if (!fs.existsSync(directory)) return [];

  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(entryPath));
      continue;
    }
    if (entry.isFile() && sourceExtensions.has(path.extname(entry.name))) {
      files.push(entryPath);
    }
  }

  return files;
}

function extractImportUsages(filePath, sourceText = fs.readFileSync(filePath, "utf8")) {
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const usages = [];

  function recordString(kind, moduleSpecifier) {
    if (moduleSpecifier && ts.isStringLiteralLike(moduleSpecifier)) {
      usages.push({ kind, specifier: moduleSpecifier.text });
    }
  }

  function recordNonLiteral(kind, expression) {
    usages.push({
      expressionKind: ts.SyntaxKind[expression.kind] ?? "unknown",
      kind,
      specifier: null,
    });
  }

  function hasCreateRequireBinding(importDeclaration) {
    const clause = importDeclaration.importClause;
    if (!clause) return false;
    if (clause.name?.text === "createRequire") return true;
    const bindings = clause.namedBindings;
    return (
      bindings &&
      ts.isNamedImports(bindings) &&
      bindings.elements.some(
        (element) =>
          element.name.text === "createRequire" ||
          element.propertyName?.text === "createRequire",
      )
    );
  }

  function visit(node) {
    if (ts.isImportDeclaration(node)) {
      recordString("static", node.moduleSpecifier);
      if (
        hasCreateRequireBinding(node) &&
        ts.isStringLiteralLike(node.moduleSpecifier) &&
        (node.moduleSpecifier.text === "node:module" ||
          node.moduleSpecifier.text === "module")
      ) {
        usages.push({
          kind: "createRequire",
          specifier: node.moduleSpecifier.text,
        });
      }
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      recordString("static", node.moduleSpecifier);
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteralLike(node.argument.literal)
    ) {
      recordString("type", node.argument.literal);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      const [argument] = node.arguments;
      if (argument && ts.isStringLiteralLike(argument)) {
        recordString("dynamic", argument);
      } else if (argument) {
        recordNonLiteral("dynamic", argument);
      }
    } else if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "require"
    ) {
      const [argument] = node.arguments;
      if (argument && ts.isStringLiteralLike(argument)) {
        recordString("require", argument);
      } else if (argument) {
        recordNonLiteral("require", argument);
      } else {
        usages.push({ expressionKind: "missing", kind: "require", specifier: null });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return usages;
}

function importMatchesPackage(specifier, packageName) {
  return specifier === packageName || specifier.startsWith(`${packageName}/`);
}

function isNodeBuiltinSpecifier(specifier) {
  if (specifier.startsWith("node:")) return true;
  if (nodeBuiltinSpecifiers.has(specifier)) return true;

  const [baseSpecifier] = specifier.split("/");
  return Boolean(baseSpecifier && nodeBuiltinSpecifiers.has(baseSpecifier));
}

function hasInternalPackagePath(specifier) {
  return (
    /(^|\/)packages\/[^/]+\/(?:src|dist)(?:\/|$)/u.test(specifier) ||
    /^@lemma\/[^/]+\/(?:src|dist)(?:\/|$)/u.test(specifier)
  );
}

function webImportViolation(specifier) {
  if (isNodeBuiltinSpecifier(specifier)) {
    return "web must not import Node builtins";
  }

  if (specifier === "@lemma/questions" || specifier.startsWith("@lemma/questions/")) {
    if (!allowedQuestionsImports.has(specifier)) {
      return "web may only import @lemma/questions/inline-blueprint from @lemma/questions";
    }
    return null;
  }

  if (hasInternalPackagePath(specifier)) {
    return "web must not import another package's src or dist internals";
  }

  for (const packageName of forbiddenWebPackages) {
    if (importMatchesPackage(specifier, packageName)) {
      return "web must not import server/node package surfaces";
    }
  }

  if (
    /^@lemma\/[^/]+\/(?:application|infrastructure|http|module|node)(?:\/|$)/u.test(
      specifier,
    )
  ) {
    return "web must not import server/node package surfaces";
  }

  return null;
}

function webImportUsageViolation(usage) {
  if (usage.kind === "dynamic" && usage.specifier === null) {
    return "web must not use non-literal dynamic imports";
  }
  if (usage.kind === "require") {
    return "web must not use CommonJS require imports";
  }
  if (usage.kind === "createRequire") {
    return "web must not use createRequire to bypass import boundaries";
  }
  if (usage.specifier === null) return null;
  return webImportViolation(usage.specifier);
}

function isInlineBlueprintTestFile(filePath) {
  return /\.test\.[cm]?[tj]sx?$/u.test(filePath);
}

function isPathInsideDirectory(filePath, directory) {
  const relative = path.relative(directory, filePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function inlineBlueprintImportViolation(filePath, specifier) {
  if (isNodeBuiltinSpecifier(specifier)) {
    if (
      isInlineBlueprintTestFile(filePath) &&
      allowedInlineBlueprintTestBuiltins.has(specifier)
    ) {
      return null;
    }
    return "inline-blueprint implementation must not import Node builtins";
  }

  if (specifier.includes("/generated/") || specifier.startsWith("@lemma/questions/generated")) {
    return "inline-blueprint must not import generated DTOs";
  }

  for (const packageName of forbiddenInlineBlueprintPackages) {
    if (importMatchesPackage(specifier, packageName)) {
      return "inline-blueprint must stay browser-safe and dependency-light";
    }
  }

  if (
    /^@lemma\/[^/]+\/(?:application|infrastructure|http|module|node)(?:\/|$)/u.test(
      specifier,
    )
  ) {
    return "inline-blueprint must not import server package surfaces";
  }

  if (specifier.startsWith(".")) {
    const resolved = path.normalize(path.resolve(path.dirname(filePath), specifier));
    if (!isPathInsideDirectory(resolved, inlineBlueprintSourceRoot)) {
      return "inline-blueprint must not import outside its blueprint-document leaf";
    }
  }

  return null;
}

function inlineBlueprintImportUsageViolation(filePath, usage) {
  if (usage.kind === "dynamic" && usage.specifier === null) {
    return "inline-blueprint must not use non-literal dynamic imports";
  }
  if (usage.kind === "require") {
    return "inline-blueprint must not use CommonJS require imports";
  }
  if (usage.kind === "createRequire") {
    return "inline-blueprint must not use createRequire";
  }
  if (usage.specifier === null) return null;
  return inlineBlueprintImportViolation(filePath, usage.specifier);
}

function checkFiles(files, getViolation) {
  const violations = [];

  for (const filePath of files) {
    for (const usage of extractImportUsages(filePath)) {
      const reason = getViolation(filePath, usage);
      if (reason) {
        violations.push({ filePath, reason, usage });
      }
    }
  }

  return violations;
}

function checkWebSourceText(filePath, sourceText) {
  return extractImportUsages(filePath, sourceText)
    .map((usage) => ({ filePath, reason: webImportUsageViolation(usage), usage }))
    .filter((violation) => violation.reason);
}

function checkInlineBlueprintSourceText(filePath, sourceText) {
  return extractImportUsages(filePath, sourceText)
    .map((usage) => ({
      filePath,
      reason: inlineBlueprintImportUsageViolation(filePath, usage),
      usage,
    }))
    .filter((violation) => violation.reason);
}

function formatViolation(violation) {
  const relativePath = path.relative(root, violation.filePath);
  const importSubject =
    violation.usage.specifier === null
      ? `${violation.usage.kind} ${violation.usage.expressionKind}`
      : `${violation.usage.kind} "${violation.usage.specifier}"`;
  return `${relativePath}: ${importSubject} - ${violation.reason}`;
}

function run() {
  const violations = [
    ...checkFiles(collectSourceFiles(webSourceRoot), (_filePath, usage) =>
      webImportUsageViolation(usage),
    ),
    ...checkFiles(collectSourceFiles(inlineBlueprintSourceRoot), (filePath, usage) =>
      inlineBlueprintImportUsageViolation(filePath, usage),
    ),
  ];

  if (violations.length === 0) {
    console.log("Web import boundaries passed.");
    return;
  }

  console.error("Web import boundary violations:");
  for (const violation of violations) {
    console.error(`- ${formatViolation(violation)}`);
  }
  process.exitCode = 1;
}

if (require.main === module) {
  run();
}

module.exports = {
  checkInlineBlueprintSourceText,
  checkWebSourceText,
  inlineBlueprintImportViolation,
  webImportUsageViolation,
  webImportViolation,
};
