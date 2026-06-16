import { readFile } from "node:fs/promises";
import { InvalidWorkbookError } from "./domain.js";
import type {
  Inspection,
  WorkbookEngineConfig,
  ZipEntry,
} from "./domain.js";

function hasExternalTarget(xml: string) {
  return /TargetMode\s*=\s*["']External["']/i.test(xml);
}

function findCentralDirectory(buffer: Buffer) {
  const signature = 0x06054b50;
  const min = Math.max(0, buffer.length - 65_557);
  for (let offset = buffer.length - 22; offset >= min; offset -= 1) {
    if (buffer.readUInt32LE(offset) === signature) {
      return offset;
    }
  }
  throw new InvalidWorkbookError("Workbook is not a valid .xlsx zip file.");
}

function parseZipEntries(buffer: Buffer) {
  const eocd = findCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries: ZipEntry[] = [];

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new InvalidWorkbookError(
        "Workbook zip central directory is invalid.",
      );
    }
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer
      .subarray(offset + 46, offset + 46 + nameLength)
      .toString("utf8");
    entries.push({
      name,
      compressedSize,
      uncompressedSize,
      method,
      offset: localHeaderOffset,
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function readZipEntry(buffer: Buffer, entry: ZipEntry) {
  if (buffer.readUInt32LE(entry.offset) !== 0x04034b50) {
    throw new InvalidWorkbookError(
      `Workbook zip entry is invalid: ${entry.name}`,
    );
  }
  const nameLength = buffer.readUInt16LE(entry.offset + 26);
  const extraLength = buffer.readUInt16LE(entry.offset + 28);
  const start = entry.offset + 30 + nameLength + extraLength;
  const data = buffer.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) {
    return data;
  }
  if (entry.method !== 8) {
    throw new InvalidWorkbookError(
      `Unsupported workbook zip compression: ${entry.name}`,
    );
  }
  const { inflateRaw } = await import("node:zlib");
  return new Promise<Buffer>((resolve, reject) => {
    inflateRaw(data, (error, result) => {
      if (error) {
        reject(error);
        return;
      }
      if (result.length !== entry.uncompressedSize) {
        reject(
          new InvalidWorkbookError(
            `Workbook zip entry size mismatch: ${entry.name}`,
          ),
        );
        return;
      }
      resolve(result);
    });
  });
}

function countMatches(value: string, pattern: RegExp) {
  return value.match(pattern)?.length ?? 0;
}

export async function inspectXlsx(
  path: string,
  config: WorkbookEngineConfig,
): Promise<Omit<Inspection, "libreOfficeVersion">> {
  const buffer = await readFile(path);
  if (
    config.maxFileBytes !== undefined &&
    buffer.length > config.maxFileBytes
  ) {
    throw new InvalidWorkbookError("Workbook file is too large.", {
      sheetCount: 0,
      cellCount: 0,
      formulaCount: 0,
      forbiddenFeatureFindings: ["file_too_large"],
    });
  }
  const entries = parseZipEntries(buffer);
  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  const findings: string[] = [];
  if (!byName.has("[Content_Types].xml") || !byName.has("xl/workbook.xml")) {
    throw new InvalidWorkbookError("Workbook must be an .xlsx file.");
  }
  for (const entry of entries) {
    const lowerName = entry.name.toLowerCase();
    if (
      lowerName === "xl/vbaproject.bin" ||
      lowerName.endsWith("/vbaproject.bin")
    ) {
      findings.push("macros_vba");
    }
    if (lowerName.startsWith("xl/externallinks/")) {
      findings.push("external_workbook_links");
    }
    if (
      lowerName === "xl/connections.xml" ||
      lowerName.startsWith("xl/connections/")
    ) {
      findings.push("data_connections");
    }
    if (
      lowerName.startsWith("xl/embeddings/") ||
      lowerName.includes("activex")
    ) {
      findings.push("ole_or_activex");
    }
    if (lowerName === "encryptedpackage") {
      findings.push("encrypted_workbook");
    }
  }
  const workbookXml = (
    await readZipEntry(buffer, byName.get("xl/workbook.xml")!)
  ).toString("utf8");
  if (/<workbookProtection(?:\s|>)/i.test(workbookXml)) {
    findings.push("workbook_protection");
  }
  let sheetCount = 0;
  let cellCount = 0;
  let formulaCount = 0;
  for (const entry of entries) {
    if (entry.name.endsWith(".rels")) {
      const xml = (await readZipEntry(buffer, entry)).toString("utf8");
      if (hasExternalTarget(xml)) {
        findings.push(`external_relationship:${entry.name}`);
      }
    }
    if (
      entry.name.startsWith("xl/worksheets/") &&
      entry.name.endsWith(".xml")
    ) {
      const xml = (await readZipEntry(buffer, entry)).toString("utf8");
      if (/<sheetProtection(?:\s|>)/i.test(xml)) {
        findings.push("sheet_protection");
      }
      if (/<queryTable(?:\s|>)/i.test(xml)) {
        findings.push("data_connections");
      }
      sheetCount += 1;
      cellCount += countMatches(xml, /<c(?:\s|>)/g);
      formulaCount += countMatches(xml, /<f(?:\s|>)/g);
    }
  }
  const inspection = {
    sheetCount,
    cellCount,
    formulaCount,
    forbiddenFeatureFindings: [...new Set(findings)],
  };
  if (inspection.sheetCount > config.maxSheets) {
    throw new InvalidWorkbookError("Workbook has too many sheets.", inspection);
  }
  if (inspection.cellCount > config.maxCells) {
    throw new InvalidWorkbookError("Workbook has too many cells.", inspection);
  }
  if (inspection.formulaCount > config.maxFormulas) {
    throw new InvalidWorkbookError(
      "Workbook has too many formulas.",
      inspection,
    );
  }
  if (inspection.forbiddenFeatureFindings.length > 0) {
    throw new InvalidWorkbookError(
      "Workbook contains unsafe features.",
      inspection,
    );
  }
  return inspection;
}
