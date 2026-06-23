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
      calculationId: workbookCalculationId(
        "019e9315-6a87-715f-9861-8654df070c4e",
      ),
      id: workbookSnapshotId("019e9315-6a87-715f-9861-8654df070c4c"),
      questionIndex: 0,
      snapshotIndex: 0,
      sourceId: "primary",
      values: {
        sheets: [
          {
            cells: {
              A1: "10",
              A2: "20",
              B1: "30",
              B2: "40",
            },
            cellTypes: {
              A1: "number",
              B1: "number",
            },
            columnCount: 2,
            name: "Sheet1",
            rowCount: 2,
          },
        ],
      },
      workbookId: workbookId("019e9315-6a87-715f-9861-8654df070c4d"),
    },
    new Date("2026-01-01T00:00:00.000Z"),
  );

  it("resolves a single cell as a scalar", () => {
    assert.equal(
      resolveWorkbookSnapshotValue(snapshot, {
        ref: "Sheet1!A1",
        type: "cell",
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
        ref: "Sheet1!A1:B2",
        type: "range",
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
            errorMessage: null,
            range: {
              cellTypes: [["number", "number"]],
              columnCount: 2,
              endCellAddress: "B1",
              ref: "'Sheet1'!A1:B1",
              rowCount: 1,
              rows: [["10", "30"]],
              sheetIndex: 0,
              sheetName: "Sheet1",
              startCellAddress: "A1",
              startColumn: 1,
              startRow: 1,
            },
            ref: "Sheet1!A1:B1",
            status: "ok",
          },
          {
            errorMessage: "Sheet not found in workbook snapshot.",
            range: null,
            ref: "Missing!A1",
            status: "error",
          },
        ],
      },
    );
  });

  it("returns per-ref errors when range batch total cells exceed the cap", () => {
    const largeSnapshot = createWorkbookSnapshot(
      {
        calculationId: workbookCalculationId(
          "019e9315-6a87-715f-9861-8654df070d4e",
        ),
        id: workbookSnapshotId("019e9315-6a87-715f-9861-8654df070d4c"),
        questionIndex: 0,
        snapshotIndex: 0,
        sourceId: "primary",
        values: {
          sheets: [
            {
              cells: {},
              columnCount: 40,
              name: "Sheet1",
              rowCount: 150,
            },
          ],
        },
        workbookId: workbookId("019e9315-6a87-715f-9861-8654df070d4d"),
      },
      new Date("2026-01-01T00:00:00.000Z"),
    );

    const batch = createWorkbookSnapshotRangeBatch(largeSnapshot, {
      refs: ["Sheet1!A1:AN50", "Sheet1!A51:AN100", "Sheet1!A101:AN150"],
    });

    assert.equal(batch.ranges[0]?.status, "ok");
    assert.equal(batch.ranges[1]?.status, "ok");
    assert.deepEqual(batch.ranges[2], {
      errorMessage: "Batch ranges must return at most 5000 cells.",
      range: null,
      ref: "Sheet1!A101:AN150",
      status: "error",
    });
  });
});
