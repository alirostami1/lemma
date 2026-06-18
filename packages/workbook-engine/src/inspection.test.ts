import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buffer as streamToBuffer } from "node:stream/consumers";
import { afterEach, describe, expect, it } from "vitest";
import type { WorkbookEngineConfig } from "./domain.js";
import { InvalidWorkbookError } from "./domain.js";
import { inspectXlsx } from "./inspection.js";

const require = createRequire(import.meta.url);
const yazl = require("yazl") as YazlModule;
const tempDirs: string[] = [];

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

afterEach(async () => {
  await Promise.all(
    tempDirs
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("inspectXlsx", () => {
  it("inspects a minimal worksheet package", async () => {
    const path = await writeWorkbookFixture([
      { name: "[Content_Types].xml", body: "<Types />" },
      { name: "xl/workbook.xml", body: "<workbook />" },
      {
        name: "xl/worksheets/sheet1.xml",
        body: '<worksheet><sheetData><row><c r="A1"><v>1</v></c></row></sheetData></worksheet>',
      },
    ]);

    await expect(inspectXlsx(path, config())).resolves.toEqual({
      sheetCount: 1,
      cellCount: 1,
      formulaCount: 0,
      forbiddenFeatureFindings: [],
    });
  });

  it("rejects unsafe relationships through inspection", async () => {
    const path = await writeWorkbookFixture([
      { name: "[Content_Types].xml", body: "<Types />" },
      { name: "xl/workbook.xml", body: "<workbook />" },
      {
        name: "xl/_rels/workbook.xml.rels",
        body: '<Relationship TargetMode="External" Target="https://example.com" />',
      },
    ]);

    await expect(inspectXlsx(path, config())).rejects.toThrow(
      InvalidWorkbookError,
    );
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

async function writeWorkbookFixture(
  entries: Array<{ name: string; body: string }>,
) {
  const dir = await mkdtemp(join(tmpdir(), "lemma-workbook-engine-"));
  tempDirs.push(dir);
  const path = join(dir, "fixture.xlsx");
  await writeFile(path, await makeZip(entries));
  return path;
}

async function makeZip(entries: Array<{ name: string; body: string }>) {
  const zip = new yazl.ZipFile();
  for (const entry of entries) {
    zip.addBuffer(Buffer.from(entry.body), entry.name, { compress: false });
  }
  zip.end();
  return streamToBuffer(zip.outputStream);
}
