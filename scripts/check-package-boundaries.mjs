#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_FILE_EXTENSIONS = new Set([
  ".cjs",
  ".js",
  ".jsx",
  ".mjs",
  ".ts",
  ".tsx",
]);

const BROWSER_APP_CONFIGS = [
  "apps/web/vite.config.ts",
  "apps/web/vitest.config.ts",
  "apps/admin/vite.config.ts",
  "apps/admin/vitest.config.ts",
];

const BROWSER_APP_SOURCE_DIRS = ["apps/web/src", "apps/admin/src"];
const SOURCE_SCAN_DIRS = ["apps", "packages", "scripts"];
const SKIPPED_DIRECTORIES = new Set([
  ".output",
  ".turbo",
  "__snapshots__",
  "dist",
  "generated",
  "node_modules",
  "openapi",
]);
const SKIPPED_SOURCE_FILES = new Set(["scripts/check-package-boundaries.test.mjs"]);

export function validateBrowserViteConfig({ filePath, text }) {
  const issues = [];
  const config = stripJsComments(text);
  if (/conditions\s*:\s*\[[^\]]*["']source["']/su.test(config)) {
    issues.push({
      filePath,
      message:
        'Browser Vite apps must not set global resolve.conditions containing "source". Add explicit browser export conditions instead.',
    });
  }
  return issues;
}

export function validateWorkspaceImportSpecifiers({ filePath, text }) {
  const issues = [];
  for (const specifier of readImportSpecifiers(text)) {
    if (/^@lemma\/[^/]+\/src(?:\/|$)/u.test(specifier)) {
      issues.push({
        filePath,
        message: `Browser apps must import public package exports, not package internals: ${specifier}`,
      });
    }
  }
  return issues;
}

export function validateBrowserOnlyImportSpecifiers({ filePath, text }) {
  const issues = [];
  for (const specifier of readImportSpecifiers(text)) {
    if (
      /^@lemma\/[^/]+\/browser(?:\/|$)/u.test(specifier) &&
      !isBrowserImportAllowed(filePath)
    ) {
      issues.push({
        filePath,
        message: `Browser-only package exports may not be imported from server/runtime code: ${specifier}`,
      });
    }
  }
  return issues;
}

export function validatePackageExports({ filePath, packageJson }) {
  const issues = [];
  const packageName =
    typeof packageJson.name === "string" ? packageJson.name : filePath;
  const exportsMap = packageJson.exports;

  if (!isRecord(exportsMap)) {
    return issues;
  }

  if (packageName === "@lemma/domain") {
    const rootExport = exportsMap["."];
    if (!isRecord(rootExport) || rootExport.browser !== "./src/index.ts") {
      issues.push({
        filePath,
        message:
          '@lemma/domain root export must expose browser-safe source with "browser": "./src/index.ts".',
      });
    }
  }

  for (const [exportPath, exportValue] of Object.entries(exportsMap)) {
    if (!isBrowserSurface(exportPath, exportValue)) {
      continue;
    }

    if (!isRecord(exportValue)) {
      issues.push({
        filePath,
        message: `${packageName} ${exportPath} must use an object export map with a browser condition.`,
      });
      continue;
    }

    if (typeof exportValue.browser !== "string") {
      issues.push({
        filePath,
        message: `${packageName} ${exportPath} must define an explicit browser condition.`,
      });
    } else if (!pointsToSource(exportValue.browser)) {
      issues.push({
        filePath,
        message: `${packageName} ${exportPath} browser condition must point at source, not ${exportValue.browser}.`,
      });
    }

    if (!isBrowserOnlySubpath(exportPath)) {
      continue;
    }

    for (const condition of ["source", "import", "default"]) {
      const target = exportValue[condition];
      if (typeof target !== "string") {
        issues.push({
          filePath,
          message: `${packageName} ${exportPath} must define ${condition} for clean browser app resolution.`,
        });
      } else if (pointsToDist(target)) {
        issues.push({
          filePath,
          message: `${packageName} ${exportPath} ${condition} must not point only at dist for browser app resolution: ${target}`,
        });
      }
    }
  }

  return issues;
}

export function runPackageBoundaryChecks({ repoRoot = process.cwd() } = {}) {
  const issues = [];

  for (const relativePath of BROWSER_APP_CONFIGS) {
    const filePath = path.join(repoRoot, relativePath);
    if (!fs.existsSync(filePath)) {
      continue;
    }
    issues.push(
      ...validateBrowserViteConfig({
        filePath: relativePath,
        text: fs.readFileSync(filePath, "utf8"),
      }),
    );
  }

  for (const relativeDirectory of BROWSER_APP_SOURCE_DIRS) {
    const directory = path.join(repoRoot, relativeDirectory);
    if (!fs.existsSync(directory)) {
      continue;
    }

    for (const filePath of readSourceFiles(directory)) {
      const relativePath = path.relative(repoRoot, filePath);
      issues.push(
        ...validateWorkspaceImportSpecifiers({
          filePath: relativePath,
          text: fs.readFileSync(filePath, "utf8"),
        }),
      );
    }
  }

  for (const relativeDirectory of SOURCE_SCAN_DIRS) {
    const directory = path.join(repoRoot, relativeDirectory);
    if (!fs.existsSync(directory)) {
      continue;
    }

    for (const filePath of readSourceFiles(directory, repoRoot)) {
      const relativePath = toPosixPath(path.relative(repoRoot, filePath));
      if (SKIPPED_SOURCE_FILES.has(relativePath)) {
        continue;
      }
      issues.push(
        ...validateBrowserOnlyImportSpecifiers({
          filePath: relativePath,
          text: fs.readFileSync(filePath, "utf8"),
        }),
      );
    }
  }

  const packagesDirectory = path.join(repoRoot, "packages");
  if (fs.existsSync(packagesDirectory)) {
    for (const packageDirectoryName of fs.readdirSync(packagesDirectory)) {
      const packageJsonPath = path.join(
        packagesDirectory,
        packageDirectoryName,
        "package.json",
      );
      if (!fs.existsSync(packageJsonPath)) {
        continue;
      }

      issues.push(
        ...validatePackageExports({
          filePath: path.relative(repoRoot, packageJsonPath),
          packageJson: JSON.parse(fs.readFileSync(packageJsonPath, "utf8")),
        }),
      );
    }
  }

  return issues;
}

function stripJsComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .replace(/(^|[^:])\/\/.*$/gmu, "$1");
}

function readImportSpecifiers(text) {
  const specifiers = [];
  const pattern =
    /\b(?:import|export)\b(?:[^"'`]*?\bfrom\s*)?["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/gsu;
  for (const match of text.matchAll(pattern)) {
    specifiers.push(match[1] ?? match[2]);
  }
  return specifiers;
}

function isBrowserSurface(exportPath, exportValue) {
  return (
    isBrowserOnlySubpath(exportPath) ||
    (isRecord(exportValue) && "browser" in exportValue)
  );
}

function isBrowserOnlySubpath(exportPath) {
  return exportPath === "./browser" || exportPath.endsWith("/browser");
}

function pointsToSource(target) {
  return target.startsWith("./src/");
}

function pointsToDist(target) {
  return target.startsWith("./dist/");
}

function* readSourceFiles(directory, repoRoot = directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) {
        yield* readSourceFiles(entryPath, repoRoot);
      }
      continue;
    }

    const relativePath = toPosixPath(path.relative(repoRoot, entryPath));
    if (
      SOURCE_FILE_EXTENSIONS.has(path.extname(entry.name)) &&
      !SKIPPED_SOURCE_FILES.has(relativePath)
    ) {
      yield entryPath;
    }
  }
}

function isBrowserImportAllowed(filePath) {
  const normalizedPath = toPosixPath(filePath);
  return (
    normalizedPath.startsWith("apps/web/src/") ||
    normalizedPath.startsWith("apps/admin/src/") ||
    /^packages\/[^/]+\/src\/browser(?:\.[cm]?[jt]sx?|\/)/u.test(
      normalizedPath,
    )
  );
}

function toPosixPath(filePath) {
  return filePath.split(path.sep).join("/");
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function main() {
  const issues = runPackageBoundaryChecks();
  if (issues.length === 0) {
    return;
  }

  console.error("Package boundary check failed:");
  for (const issue of issues) {
    console.error(`- ${issue.filePath}: ${issue.message}`);
  }
  process.exitCode = 1;
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  main();
}
