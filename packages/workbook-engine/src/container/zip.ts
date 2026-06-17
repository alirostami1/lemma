import { inflateRaw } from "node:zlib";
import type { WorkbookEngineConfig, ZipEntry } from "../domain.js";
import { InvalidWorkbookError } from "../domain.js";

const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;

export type XlsxZipContainer = {
  entries: ZipEntry[];
  byName: Map<string, ZipEntry>;
  readEntry(entry: ZipEntry): Promise<Buffer>;
  readTextEntry(entry: ZipEntry): Promise<string>;
};

export function openXlsxZipContainer(
  buffer: Buffer,
  config: WorkbookEngineConfig,
): XlsxZipContainer {
  const entries = parseZipEntries(buffer, config);
  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  return {
    entries,
    byName,
    readEntry: (entry) => readZipEntry(buffer, entry, config),
    async readTextEntry(entry) {
      return (await readZipEntry(buffer, entry, config)).toString("utf8");
    },
  };
}

function parseZipEntries(
  buffer: Buffer,
  config: WorkbookEngineConfig,
): ZipEntry[] {
  const eocd = findCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(eocd + 10);
  const centralDirectorySize = buffer.readUInt32LE(eocd + 12);
  let offset = buffer.readUInt32LE(eocd + 16);
  const centralDirectoryEnd = offset + centralDirectorySize;

  if (centralDirectoryEnd > buffer.length) {
    throw invalidZip("Workbook zip central directory is outside the file.");
  }
  if (entryCount > (config.maxZipEntries ?? 10_000)) {
    throw invalidZip("Workbook zip has too many entries.", {
      reason: "zip_entry_count_exceeded",
      entryCount,
    });
  }

  const entries: ZipEntry[] = [];
  const names = new Set<string>();
  let totalUncompressedBytes = 0;

  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > buffer.length) {
      throw invalidZip("Workbook zip central directory is truncated.");
    }
    if (buffer.readUInt32LE(offset) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw invalidZip("Workbook zip central directory is invalid.");
    }
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const nextOffset = offset + 46 + nameLength + extraLength + commentLength;

    if (nextOffset > buffer.length || nextOffset > centralDirectoryEnd) {
      throw invalidZip("Workbook zip central directory entry is truncated.");
    }

    const name = buffer
      .subarray(offset + 46, offset + 46 + nameLength)
      .toString("utf8");
    validateEntryMetadata({
      name,
      method,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
      bufferLength: buffer.length,
      config,
      names,
    });

    totalUncompressedBytes += uncompressedSize;
    if (
      totalUncompressedBytes >
      (config.maxZipTotalUncompressedBytes ?? config.maxFileBytes * 20)
    ) {
      throw invalidZip("Workbook zip expands to too many bytes.", {
        reason: "zip_expanded_size_exceeded",
      });
    }

    entries.push({
      name,
      compressedSize,
      uncompressedSize,
      method,
      offset: localHeaderOffset,
    });
    offset = nextOffset;
  }

  return entries;
}

async function readZipEntry(
  buffer: Buffer,
  entry: ZipEntry,
  config: WorkbookEngineConfig,
) {
  if (entry.offset + 30 > buffer.length) {
    throw invalidZip(`Workbook zip entry is truncated: ${entry.name}`);
  }
  if (buffer.readUInt32LE(entry.offset) !== LOCAL_FILE_HEADER_SIGNATURE) {
    throw invalidZip(`Workbook zip entry is invalid: ${entry.name}`);
  }
  const nameLength = buffer.readUInt16LE(entry.offset + 26);
  const extraLength = buffer.readUInt16LE(entry.offset + 28);
  const start = entry.offset + 30 + nameLength + extraLength;
  const end = start + entry.compressedSize;
  if (end > buffer.length) {
    throw invalidZip(`Workbook zip entry data is truncated: ${entry.name}`);
  }
  if (
    entry.uncompressedSize > (config.maxZipEntryBytes ?? config.maxFileBytes)
  ) {
    throw invalidZip(`Workbook zip entry is too large: ${entry.name}`, {
      reason: "zip_entry_too_large",
      entry: entry.name,
    });
  }

  const data = buffer.subarray(start, end);
  if (entry.method === 0) {
    return data;
  }
  if (entry.method !== 8) {
    throw invalidZip(`Unsupported workbook zip compression: ${entry.name}`, {
      reason: "zip_unsupported_compression",
      entry: entry.name,
    });
  }
  return new Promise<Buffer>((resolve, reject) => {
    inflateRaw(data, (error, result) => {
      if (error) {
        reject(
          invalidZip(`Workbook zip entry cannot be inflated: ${entry.name}`, {
            cause: error.message,
          }),
        );
        return;
      }
      if (result.length !== entry.uncompressedSize) {
        reject(
          invalidZip(`Workbook zip entry size mismatch: ${entry.name}`, {
            entry: entry.name,
          }),
        );
        return;
      }
      resolve(result);
    });
  });
}

function findCentralDirectory(buffer: Buffer) {
  const min = Math.max(0, buffer.length - 65_557);
  for (let offset = buffer.length - 22; offset >= min; offset -= 1) {
    if (buffer.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
      return offset;
    }
  }
  throw invalidZip("Workbook is not a valid .xlsx zip file.");
}

function validateEntryMetadata(input: {
  name: string;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
  bufferLength: number;
  config: WorkbookEngineConfig;
  names: Set<string>;
}) {
  if (!input.name || input.name.startsWith("/") || input.name.includes("..")) {
    throw invalidZip(`Workbook zip entry path is unsafe: ${input.name}`, {
      reason: "zip_path_traversal",
      entry: input.name,
    });
  }
  if (input.names.has(input.name)) {
    throw invalidZip(`Workbook zip entry is duplicated: ${input.name}`, {
      reason: "zip_duplicate_entry",
      entry: input.name,
    });
  }
  input.names.add(input.name);

  if (input.method !== 0 && input.method !== 8) {
    throw invalidZip(`Unsupported workbook zip compression: ${input.name}`, {
      reason: "zip_unsupported_compression",
      entry: input.name,
    });
  }
  if (input.localHeaderOffset >= input.bufferLength) {
    throw invalidZip(`Workbook zip entry offset is invalid: ${input.name}`);
  }
  if (
    input.uncompressedSize >
    (input.config.maxZipEntryBytes ?? input.config.maxFileBytes)
  ) {
    throw invalidZip(`Workbook zip entry is too large: ${input.name}`, {
      reason: "zip_entry_too_large",
      entry: input.name,
    });
  }
  if (
    input.compressedSize > 0 &&
    input.uncompressedSize / input.compressedSize >
      (input.config.maxZipCompressionRatio ?? 100)
  ) {
    throw invalidZip(
      `Workbook zip entry compression ratio is too high: ${input.name}`,
      {
        reason: "zip_compression_ratio_exceeded",
        entry: input.name,
      },
    );
  }
}

function invalidZip(message: string, details: Record<string, unknown> = {}) {
  return new InvalidWorkbookError(message, {
    sheetCount: 0,
    cellCount: 0,
    formulaCount: 0,
    forbiddenFeatureFindings: [String(details.reason ?? "invalid_zip")],
  });
}
