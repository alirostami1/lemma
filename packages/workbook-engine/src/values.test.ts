import { describe, expect, it } from "vitest";
import type { WorkbookSparseValues } from "./domain.js";
import { WorkbookEngineError } from "./domain.js";
import {
  normalizeWorkbookSparseValues,
  parseWorkbookRef,
  resolveWorkbookValue,
  sparseValuesToRows,
} from "./values.js";

describe("workbook engine values", () => {
  it("parses workbook cell refs", () => {
    expect(parseWorkbookRef("'Sheet 1'!$B$2")).toEqual({
      sheet: "Sheet 1",
      rowIndex: 1,
      columnIndex: 1,
    });
    expect(parseWorkbookRef("'Bob''s Sheet'!A1")).toEqual({
      sheet: "Bob's Sheet",
      rowIndex: 0,
      columnIndex: 0,
    });
    expect(parseWorkbookRef("Sheet1!C3:D4")).toEqual({
      sheet: "Sheet1",
      rowIndex: 2,
      columnIndex: 2,
    });
  });

  it("resolves sparse values and expands rows", () => {
    const workbook: WorkbookSparseValues = {
      sheets: [
        {
          name: "Sheet1",
          cells: {
            A1: "alpha",
            C2: "charlie",
          },
          rowCount: 2,
          columnCount: 3,
        },
      ],
    };

    expect(resolveWorkbookValue(workbook, "Sheet1!C2")).toBe("charlie");
    expect(resolveWorkbookValue(workbook, "Sheet1!B2")).toBe("");
    expect(sparseValuesToRows(workbook)).toEqual({
      sheets: [
        {
          name: "Sheet1",
          rows: [
            ["alpha", "", ""],
            ["", "", "charlie"],
          ],
        },
      ],
    });
  });

  it("rejects normalized sparse values beyond configured limits", () => {
    expect(() =>
      normalizeWorkbookSparseValues(
        {
          sheets: [
            {
              name: "Sheet1",
              cells: {
                A1: "alpha",
                A2: "beta",
              },
              rowCount: 2,
              columnCount: 1,
            },
          ],
        },
        { maxSheets: 1, maxCells: 1, maxCachedValueBytes: 100 },
      ),
    ).toThrow(WorkbookEngineError);
  });

  it("omits missing cell types from normalized sparse values", () => {
    const normalized = normalizeWorkbookSparseValues(
      {
        sheets: [
          {
            name: "Sheet1",
            cells: { A1: "alpha" },
            rowCount: 1,
            columnCount: 1,
          },
        ],
      },
      { maxSheets: 1, maxCells: 1, maxCachedValueBytes: 100 },
    );

    expect(normalized.sheets[0]).not.toHaveProperty("cellTypes");
  });
});
