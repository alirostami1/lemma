import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import * as XLSX from "xlsx";
import { EngineWorkbookCalculator } from "./EngineWorkbookCalculator.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs
      .splice(0)
      .map((path) => rm(path, { force: true, recursive: true })),
  );
});

describe("EngineWorkbookCalculator reference targets", () => {
  it("extracts normalized reference targets from a real workbook file", async () => {
    const path = await writeWorkbookFixture();
    const calculator = new EngineWorkbookCalculator({
      engine: "cached",
      engineTimeoutMs: 1000,
      maxCachedValueBytes: 1_000_000,
      maxCells: 100,
      maxFileBytes: 1_000_000,
      maxFormulas: 100,
      maxResponseBytes: 1_000_000,
      maxSheets: 10,
      validationTimeoutMs: 1000,
    });

    const result = await calculator.referenceTargets(path);

    assert.deepEqual(result, {
      status: "available",
      targets: {
        schemaVersion: 1,
        sheets: [
          {
            dimensions: { columnCount: 3, rowCount: 3 },
            name: "Sheet 1",
            valueCells: ["A1", "C3"],
          },
          {
            dimensions: { columnCount: 2, rowCount: 2 },
            name: "Data Sheet",
            valueCells: ["B2"],
          },
        ],
      },
    });
  });
});

async function writeWorkbookFixture() {
  const dir = await mkdtemp(join(tmpdir(), "lemma-workbook-targets-"));
  tempDirs.push(dir);
  const path = join(dir, "targets.xlsx");
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["alpha", "", ""],
      ["", "", ""],
      ["", "", "omega"],
    ]),
    "Sheet 1",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["", ""],
      ["", "beta"],
    ]),
    "Data Sheet",
  );
  await writeFile(
    path,
    XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }),
  );
  return path;
}
