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
      columnIndex: 1,
      rowIndex: 1,
      sheet: "Sheet 1",
    });
    expect(parseWorkbookRef("'Bob''s Sheet'!A1")).toEqual({
      columnIndex: 0,
      rowIndex: 0,
      sheet: "Bob's Sheet",
    });
    expect(parseWorkbookRef("Sheet1!C3:D4")).toEqual({
      columnIndex: 2,
      rowIndex: 2,
      sheet: "Sheet1",
    });
  });

  it("resolves sparse values and expands rows", () => {
    const workbook: WorkbookSparseValues = {
      sheets: [
        {
          cells: {
            A1: "alpha",
            C2: "charlie",
          },
          columnCount: 3,
          name: "Sheet1",
          rowCount: 2,
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
              cells: {
                A1: "alpha",
                A2: "beta",
              },
              columnCount: 1,
              name: "Sheet1",
              rowCount: 2,
            },
          ],
        },
        { maxCachedValueBytes: 100, maxCells: 1, maxSheets: 1 },
      ),
    ).toThrow(WorkbookEngineError);
  });

  it("omits missing cell types from normalized sparse values", () => {
    const normalized = normalizeWorkbookSparseValues(
      {
        sheets: [
          {
            cells: { A1: "alpha" },
            columnCount: 1,
            name: "Sheet1",
            rowCount: 1,
          },
        ],
      },
      { maxCachedValueBytes: 100, maxCells: 1, maxSheets: 1 },
    );

    expect(normalized.sheets[0]).not.toHaveProperty("cellTypes");
  });

  it("keeps only non-empty cells in normalized sparse values", () => {
    const normalized = normalizeWorkbookSparseValues(
      {
        sheets: [
          {
            cells: {
              A1: "alpha",
              B2: "",
              C3: "charlie",
            },
            cellTypes: {
              A1: "string",
              B2: "blank",
              C3: "string",
            },
            columnCount: 20,
            name: "Sheet1",
            rowCount: 50,
          },
        ],
      },
      { maxCachedValueBytes: 100, maxCells: 2, maxSheets: 1 },
    );

    expect(normalized.sheets[0]).toEqual({
      cells: {
        A1: "alpha",
        C3: "charlie",
      },
      cellTypes: {
        A1: "string",
        C3: "string",
      },
      columnCount: 3,
      name: "Sheet1",
      rowCount: 3,
    });
  });
});
