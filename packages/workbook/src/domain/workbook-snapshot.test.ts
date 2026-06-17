import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  workbookCalculationId,
  workbookId,
  workbookSnapshotId,
} from "./ids.js";
import {
  createWorkbookSnapshot,
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
});
