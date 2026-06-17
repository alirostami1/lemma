import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SKIPPED_DIRS = new Set([
  ".git",
  ".turbo",
  "dist",
  "node_modules",
  "vendor",
]);
const SUPPORTED_MERMAID_START =
  /^(architecture-beta|classDiagram|erDiagram|flowchart|gantt|gitGraph|graph|journey|mindmap|pie|quadrantChart|requirementDiagram|sequenceDiagram|stateDiagram-v2|timeline|xychart-beta)\b/;
const FLOWCHART_START = /^(flowchart|graph)\b/;
const UNQUOTED_SPECIAL_LABEL = /[A-Za-z_][\w-]*\[[^\]"'\n]*[@#][^\]"'\n]*\]/;

const markdownFiles = await collectMarkdownFiles(ROOT);
const failures = [];

for (const file of markdownFiles) {
  const text = await readFile(file, "utf8");
  checkFences(file, text);
  checkMermaidBlocks(file, text);
}

if (failures.length > 0) {
  console.error("Docs check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

async function collectMarkdownFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRS.has(entry.name)) {
        files.push(...(await collectMarkdownFiles(fullPath)));
      }
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }
  return files;
}

function checkFences(file, text) {
  const fences = [...text.matchAll(/^```/gm)];
  if (fences.length % 2 !== 0) {
    fail(file, "has an unclosed fenced code block");
  }
}

function checkMermaidBlocks(file, text) {
  for (const block of mermaidBlocks(text)) {
    const firstLine = firstMeaningfulLine(block.body);
    if (!firstLine) {
      fail(file, `has an empty Mermaid block at line ${block.line}`);
      continue;
    }
    if (!SUPPORTED_MERMAID_START.test(firstLine)) {
      fail(
        file,
        `has a Mermaid block at line ${block.line} with unsupported start: ${firstLine}`,
      );
    }
    if (FLOWCHART_START.test(firstLine)) {
      checkFlowchartLabels(file, block);
    }
  }
}

function* mermaidBlocks(text) {
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    if (!/^```\s*mermaid\s*$/.test(lines[index] ?? "")) {
      continue;
    }
    const body = [];
    const line = index + 1;
    index += 1;
    while (index < lines.length && !/^```/.test(lines[index] ?? "")) {
      body.push(lines[index] ?? "");
      index += 1;
    }
    yield { body: body.join("\n"), line };
  }
}

function checkFlowchartLabels(file, block) {
  const lines = block.body.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    const normalized = line.trim();
    if (normalized.startsWith("%%")) {
      continue;
    }
    if (UNQUOTED_SPECIAL_LABEL.test(normalized)) {
      fail(
        file,
        `has an unquoted Mermaid label with special characters at line ${
          block.line + index + 1
        }`,
      );
    }
  }
}

function firstMeaningfulLine(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.startsWith("%%"));
}

function fail(file, message) {
  failures.push(`${path.relative(ROOT, file)} ${message}`);
}
