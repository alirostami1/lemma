import { createRequire } from "node:module";
import { buffer as streamToBuffer } from "node:stream/consumers";
import { describe, expect, it } from "vitest";
import type { WorkbookEngineConfig } from "../domain.js";
import { InvalidWorkbookError } from "../domain.js";
import { openXlsxZipContainer } from "./zip.js";

const require = createRequire(import.meta.url);
const yazl = require("yazl") as YazlModule;

type YazlModule = {
  ZipFile: new () => {
    outputStream: NodeJS.ReadableStream;
    addBuffer(
      buffer: Buffer,
      metadataPath: string,
      options?: { compress?: boolean },
    ): void;
    end(): void;
  };
};

describe("openXlsxZipContainer", () => {
  it("indexes safe zip entries", async () => {
    const container = await openXlsxZipContainer(
      await makeZip([{ name: "xl/workbook.xml", body: "<workbook />" }]),
      config(),
    );

    expect(container.byName.has("xl/workbook.xml")).toBe(true);
    const entry = container.entries[0];
    if (!entry) {
      throw new Error("Missing test entry.");
    }

    try {
      await expect(container.readTextEntry(entry)).resolves.toBe(
        "<workbook />",
      );
    } finally {
      container.close();
    }
  });

  it("rejects duplicate entries", async () => {
    await expect(
      openXlsxZipContainer(
        await makeZip([
          { name: "xl/workbook.xml", body: "" },
          { name: "xl/workbook.xml", body: "" },
        ]),
        config(),
      ),
    ).rejects.toThrow(InvalidWorkbookError);
  });

  it("rejects path traversal entries", async () => {
    await expect(
      openXlsxZipContainer(
        makeUnsafeZip([{ name: "../xl/workbook.xml", body: "" }]),
        config(),
      ),
    ).rejects.toThrow(InvalidWorkbookError);
  });

  it("rejects oversized expanded data", async () => {
    await expect(
      openXlsxZipContainer(
        await makeZip([{ name: "xl/workbook.xml", body: "abc" }]),
        { ...config(), maxZipTotalUncompressedBytes: 2 },
      ),
    ).rejects.toThrow(InvalidWorkbookError);
  });
});

function config(): WorkbookEngineConfig {
  return {
    engine: "cached",
    engineTimeoutMs: 1000,
    validationTimeoutMs: 1000,
    maxFileBytes: 1_000_000,
    maxSheets: 10,
    maxCells: 1000,
    maxFormulas: 100,
    maxResponseBytes: 1_000_000,
  };
}

async function makeZip(entries: Array<{ name: string; body: string }>) {
  const zip = new yazl.ZipFile();
  for (const entry of entries) {
    zip.addBuffer(Buffer.from(entry.body), entry.name, { compress: false });
  }
  zip.end();
  return streamToBuffer(zip.outputStream);
}

function makeUnsafeZip(entries: Array<{ name: string; body: string }>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const body = Buffer.from(entry.body);
    const local = Buffer.alloc(30 + name.length + body.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(body.length, 22);
    local.writeUInt16LE(name.length, 26);
    name.copy(local, 30);
    body.copy(local, 30 + name.length);
    localParts.push(local);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(body.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(localOffset, 42);
    name.copy(central, 46);
    centralParts.push(central);
    localOffset += local.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localOffset, 16);
  return Buffer.concat([...localParts, centralDirectory, end]);
}
