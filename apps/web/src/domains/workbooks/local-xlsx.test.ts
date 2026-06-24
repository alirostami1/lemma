// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  getLocalWorkbookCell,
  getLocalWorkbookRange,
  parseLocalWorkbookFile,
  searchLocalWorkbookCells,
} from "./local-xlsx";

describe("local-xlsx", () => {
  it("parses workbook data and supports lookup helpers", async () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Name", "Rate"],
      ["Alpha", 10],
      ["Beta", 12],
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, "Rates");
    const file = workbookFile(
      "rates.xlsx",
      XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer,
    );

    const result = await parseLocalWorkbookFile(file);

    expect(result.status).toBe("parsed");
    if (result.status !== "parsed") {
      return;
    }

    expect(result.workbook.sheets).toEqual([
      {
        columnCount: 2,
        name: "Rates",
        rowCount: 3,
        usedRange: "'Rates'!A1:B3",
      },
    ]);

    expect(getLocalWorkbookCell(result.workbook, "'Rates'!B2")).toEqual(
      expect.objectContaining({
        address: "B2",
        displayValue: "10",
        rawValue: 10,
      }),
    );
    expect(
      getLocalWorkbookRange(result.workbook, "'Rates'!A2:B3"),
    ).toHaveLength(4);
    expect(
      searchLocalWorkbookCells(result.workbook, "beta").map(
        (cell) => cell.address,
      ),
    ).toContain("A3");
  });

  it("rejects invalid workbook extension", async () => {
    const result = await parseLocalWorkbookFile(
      new File(["hello"], "notes.txt", { type: "text/plain" }),
    );

    expect(result.status).toBe("failed");
    if (result.status !== "failed") {
      return;
    }

    expect(result.error.code).toBe("unsupported_file_type");
    expect(result.error.message.length).toBeGreaterThan(0);
  });

  it("returns parse error for invalid xlsx bytes", async () => {
    const result = await parseLocalWorkbookFile(
      workbookFile("broken.xlsx", "not-xlsx"),
    );

    expect(result).toEqual({
      error: {
        code: "parse_failed",
        message: "Workbook could not be parsed.",
      },
      status: "failed",
    });
  });
});

function workbookFile(name: string, content: ArrayBuffer | string): File {
  return new File([content], name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
