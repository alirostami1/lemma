import * as XLSX from "xlsx";
import type { WorkbookPreviewSheet } from "./workbook-reference";

export type WorkbookPreview = {
  fileName: string;
  sheets: Array<WorkbookPreviewSheet & { columnCount?: number }>;
};

export async function parseWorkbookPreview(
  file: File,
): Promise<WorkbookPreview> {
  const parsed = XLSX.read(await file.arrayBuffer(), {
    type: "array",
    cellDates: false,
    cellText: true,
  });
  const sheets = parsed.SheetNames.map((name) => {
    const sheet = parsed.Sheets[name];
    const rows = sheetToRows(sheet);

    return {
      name,
      rows,
      columnCount: rows.reduce((max, row) => Math.max(max, row.length), 0),
    };
  });

  return { fileName: file.name, sheets };
}

function sheetToRows(sheet: XLSX.WorkSheet | undefined) {
  const rows: string[][] = [];
  for (const address of Object.keys(sheet ?? {})) {
    if (address.startsWith("!")) {
      continue;
    }
    const decoded = XLSX.utils.decode_cell(address);
    let row = rows[decoded.r];
    if (row === undefined) {
      row = [];
      rows[decoded.r] = row;
    }
    const cell = sheet?.[address];
    row[decoded.c] =
      cell?.w ?? (cell?.v == null ? "" : String(cell.v));
  }
  if (sheet?.["!ref"]) {
    const range = XLSX.utils.decode_range(sheet["!ref"]);
    for (let row = 0; row <= range.e.r; row += 1) {
      rows[row] ??= [];
    }
  }
  return rows;
}
