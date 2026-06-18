import { createRequire } from "node:module";
import { buffer as streamToBuffer } from "node:stream/consumers";
import type { WorkbookEngineConfig, ZipEntry } from "../domain.js";
import { InvalidWorkbookError } from "../domain.js";

const require = createRequire(import.meta.url);
const yauzl = require("yauzl") as YauzlModule;

type YauzlModule = {
  fromBuffer(
    buffer: Buffer,
    options: {
      autoClose?: boolean;
      lazyEntries?: boolean;
      strictFileNames?: boolean;
      validateEntrySizes?: boolean;
    },
    callback: (error: Error | null, zipFile?: YauzlZipFile) => void,
  ): void;
};

type YauzlZipFile = {
  entryCount: number;
  close(): void;
  readEntry(): void;
  openReadStream(
    entry: YauzlEntry,
    callback: (error: Error | null, stream?: NodeJS.ReadableStream) => void,
  ): void;
  on(event: "entry", listener: (entry: YauzlEntry) => void): void;
  on(event: "end", listener: () => void): void;
  on(event: "error", listener: (error: Error) => void): void;
};

type YauzlEntry = {
  fileName: string;
  compressedSize: number;
  uncompressedSize: number;
  compressionMethod: number;
  relativeOffsetOfLocalHeader: number;
  isEncrypted(): boolean;
};

type IndexedZipEntry = ZipEntry & {
  source: YauzlEntry;
};

export type XlsxZipContainer = {
  entries: ZipEntry[];
  byName: Map<string, ZipEntry>;
  readEntry(entry: ZipEntry): Promise<Buffer>;
  readTextEntry(entry: ZipEntry): Promise<string>;
  close(): void;
};

export async function openXlsxZipContainer(
  buffer: Buffer,
  config: WorkbookEngineConfig,
): Promise<XlsxZipContainer> {
  const zipFile = await openZipBuffer(buffer);
  const indexedEntries = await indexZipEntries(zipFile, config);
  const entries: ZipEntry[] = indexedEntries.map(
    ({ source: _source, ...entry }) => entry,
  );
  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  const sourceByName = new Map(
    indexedEntries.map((entry) => [entry.name, entry.source]),
  );

  return {
    entries,
    byName,
    readEntry: (entry) =>
      readZipEntry(zipFile, sourceByName.get(entry.name), entry, config),
    async readTextEntry(entry) {
      return (
        await readZipEntry(zipFile, sourceByName.get(entry.name), entry, config)
      ).toString("utf8");
    },
    close: () => zipFile.close(),
  };
}

function openZipBuffer(buffer: Buffer): Promise<YauzlZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(
      buffer,
      {
        autoClose: false,
        lazyEntries: true,
        strictFileNames: true,
        validateEntrySizes: true,
      },
      (error, zipFile) => {
        if (error || !zipFile) {
          reject(invalidZip("Workbook is not a valid .xlsx zip file."));
          return;
        }
        resolve(zipFile);
      },
    );
  });
}

function indexZipEntries(
  zipFile: YauzlZipFile,
  config: WorkbookEngineConfig,
): Promise<IndexedZipEntry[]> {
  return new Promise((resolve, reject) => {
    if (zipFile.entryCount > (config.maxZipEntries ?? 10_000)) {
      reject(
        invalidZip("Workbook zip has too many entries.", {
          reason: "zip_entry_count_exceeded",
          entryCount: zipFile.entryCount,
        }),
      );
      return;
    }

    const entries: IndexedZipEntry[] = [];
    const names = new Set<string>();
    let totalUncompressedBytes = 0;
    let settled = false;

    function fail(error: Error) {
      if (settled) {
        return;
      }
      settled = true;
      zipFile.close();
      reject(error);
    }

    zipFile.on("error", (error) => {
      fail(
        invalidZip("Workbook zip central directory is invalid.", {
          cause: error.message,
        }),
      );
    });

    zipFile.on("entry", (entry) => {
      try {
        const indexedEntry = toIndexedEntry(entry, config, names);
        totalUncompressedBytes += indexedEntry.uncompressedSize;
        if (
          totalUncompressedBytes >
          (config.maxZipTotalUncompressedBytes ?? config.maxFileBytes * 20)
        ) {
          throw invalidZip("Workbook zip expands to too many bytes.", {
            reason: "zip_expanded_size_exceeded",
          });
        }
        entries.push(indexedEntry);
        zipFile.readEntry();
      } catch (error) {
        fail(
          error instanceof Error
            ? error
            : invalidZip("Workbook zip is invalid."),
        );
      }
    });

    zipFile.on("end", () => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(entries);
    });

    zipFile.readEntry();
  });
}

function toIndexedEntry(
  entry: YauzlEntry,
  config: WorkbookEngineConfig,
  names: Set<string>,
): IndexedZipEntry {
  validateEntryMetadata({
    name: entry.fileName,
    method: entry.compressionMethod,
    compressedSize: entry.compressedSize,
    uncompressedSize: entry.uncompressedSize,
    offset: entry.relativeOffsetOfLocalHeader,
    encrypted: entry.isEncrypted(),
    config,
    names,
  });

  return {
    name: entry.fileName,
    compressedSize: entry.compressedSize,
    uncompressedSize: entry.uncompressedSize,
    method: entry.compressionMethod,
    offset: entry.relativeOffsetOfLocalHeader,
    source: entry,
  };
}

async function readZipEntry(
  zipFile: YauzlZipFile,
  source: YauzlEntry | undefined,
  entry: ZipEntry,
  config: WorkbookEngineConfig,
) {
  if (!source) {
    throw invalidZip(`Workbook zip entry is missing: ${entry.name}`);
  }
  if (
    entry.uncompressedSize > (config.maxZipEntryBytes ?? config.maxFileBytes)
  ) {
    throw invalidZip(`Workbook zip entry is too large: ${entry.name}`, {
      reason: "zip_entry_too_large",
      entry: entry.name,
    });
  }

  const stream = await openReadStream(zipFile, source, entry.name);
  const data = await streamToBuffer(stream);
  if (data.length !== entry.uncompressedSize) {
    throw invalidZip(`Workbook zip entry size mismatch: ${entry.name}`, {
      entry: entry.name,
    });
  }
  return data;
}

function openReadStream(
  zipFile: YauzlZipFile,
  entry: YauzlEntry,
  entryName: string,
): Promise<NodeJS.ReadableStream> {
  return new Promise((resolve, reject) => {
    zipFile.openReadStream(entry, (error, stream) => {
      if (error || !stream) {
        reject(
          invalidZip(`Workbook zip entry cannot be read: ${entryName}`, {
            cause: error?.message,
          }),
        );
        return;
      }
      resolve(stream);
    });
  });
}

function validateEntryMetadata(input: {
  name: string;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  offset: number;
  encrypted: boolean;
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

  if (input.encrypted || (input.method !== 0 && input.method !== 8)) {
    throw invalidZip(`Unsupported workbook zip compression: ${input.name}`, {
      reason: "zip_unsupported_compression",
      entry: input.name,
    });
  }
  if (!Number.isSafeInteger(input.offset) || input.offset < 0) {
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
