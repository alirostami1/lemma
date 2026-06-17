import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { WorkbookEngineConfig } from "./domain.js";
import { InvalidWorkbookError } from "./domain.js";
import { inspectXlsx } from "./inspection.js";

const tempDirs: string[] = [];

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
  await writeFile(path, makeZip(entries));
  return path;
}

function makeZip(entries: Array<{ name: string; body: string }>): Buffer {
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
