import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  workbookCalculationId,
  workbookId,
  workbookSnapshotId,
} from "./ids.js";
import {
  createWorkbookSnapshot,
  createWorkbookSnapshotRangeBatch,
  resolveWorkbookSnapshotValue,
} from "./workbook-snapshot.js";

describe("workbook snapshot values", () => {
  const snapshot = createWorkbookSnapshot(
    {
      id: workbookSnapshotId("019e9315-6a87-715f-9861-8654df070c4c"),
      workbookId: workbookId("019e9315-6a87-715f-9861-8654df070c4d"),
      calculationId: workbookCalculationId(
        "019e9315-6a87-715f-9861-8654df070c4e",
      ),
      snapshotIndex: 0,
      values: {
        sheets: [
          {
            name: "Sheet1",
            cells: {
              A1: "10",
              B1: "30",
              A2: "20",
              B2: "40",
            },
            cellTypes: {
              A1: "number",
              B1: "number",
            },
            rowCount: 2,
            columnCount: 2,
          },
        ],
      },
    },
    new Date("2026-01-01T00:00:00.000Z"),
  );

  it("resolves a single cell as a scalar", () => {
    assert.equal(
      resolveWorkbookSnapshotValue(snapshot, {
        type: "cell",
        ref: "Sheet1!A1",
      }),
      "10",
    );
  });

  it("preserves cell type metadata", () => {
    assert.deepEqual(snapshot.values.sheets[0]?.cellTypes, {
      A1: "number",
      B1: "number",
    });
  });

  it("resolves a range as a 2D array", () => {
    assert.deepEqual(
      resolveWorkbookSnapshotValue(snapshot, {
        type: "range",
        ref: "Sheet1!A1:B2",
      }),
      [
        ["10", "30"],
        ["20", "40"],
      ],
    );
  });

  it("resolves range batches with per-ref errors", () => {
    assert.deepEqual(
      createWorkbookSnapshotRangeBatch(snapshot, {
        refs: ["Sheet1!A1:B1", "Missing!A1"],
      }),
      {
        ranges: [
          {
            ref: "Sheet1!A1:B1",
            status: "ok",
            errorMessage: null,
            range: {
              sheetIndex: 0,
              sheetName: "Sheet1",
              startRow: 1,
              startColumn: 1,
              rowCount: 1,
              columnCount: 2,
              rows: [["10", "30"]],
              cellTypes: [["number", "number"]],
              ref: "'Sheet1'!A1:B1",
              startCellAddress: "A1",
              endCellAddress: "B1",
            },
          },
          {
            ref: "Missing!A1",
            status: "error",
            range: null,
            errorMessage: "Sheet not found in workbook snapshot.",
          },
        ],
      },
    );
  });

  it("returns per-ref errors when range batch total cells exceed the cap", () => {
    const largeSnapshot = createWorkbookSnapshot(
      {
        id: workbookSnapshotId("019e9315-6a87-715f-9861-8654df070d4c"),
        workbookId: workbookId("019e9315-6a87-715f-9861-8654df070d4d"),
        calculationId: workbookCalculationId(
          "019e9315-6a87-715f-9861-8654df070d4e",
        ),
        snapshotIndex: 0,
        values: {
          sheets: [
            {
              name: "Sheet1",
              cells: {},
              rowCount: 150,
              columnCount: 40,
            },
          ],
        },
      },
      new Date("2026-01-01T00:00:00.000Z"),
    );

    const batch = createWorkbookSnapshotRangeBatch(largeSnapshot, {
      refs: ["Sheet1!A1:AN50", "Sheet1!A51:AN100", "Sheet1!A101:AN150"],
    });

    assert.equal(batch.ranges[0]?.status, "ok");
    assert.equal(batch.ranges[1]?.status, "ok");
    assert.deepEqual(batch.ranges[2], {
      ref: "Sheet1!A101:AN150",
      status: "error",
      range: null,
      errorMessage: "Batch ranges must return at most 5000 cells.",
    });
  });
});
