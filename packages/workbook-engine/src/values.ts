import { readFile } from "node:fs/promises";
import * as XLSX from "xlsx";
import type {
  WorkbookSparseSheet,
  WorkbookSparseValues,
  WorkbookValues,
} from "./domain.js";

export async function readWorkbookValues(
  path: string,
): Promise<WorkbookValues> {
  return parseWorkbookValues(await readFile(path));
}

export async function readWorkbookSparseValues(
  path: string,
): Promise<WorkbookSparseValues> {
  return parseWorkbookSparseValues(await readFile(path));
}

export function parseWorkbookValues(buffer: Buffer): WorkbookValues {
  return sparseValuesToRows(parseWorkbookSparseValues(buffer));
}

export function parseWorkbookSparseValues(
  buffer: Buffer,
): WorkbookSparseValues {
  const parsed = XLSX.read(buffer, {
    type: "buffer",
    cellDates: false,
    cellText: true,
  });
  const sheets = parsed.SheetNames.map((name) => {
    const sheet = parsed.Sheets[name];
    return sheetToSparseValues(name, sheet);
  });
  return { sheets };
}

export function sparseValuesToRows(
  workbook: WorkbookSparseValues,
): WorkbookValues {
  return {
    sheets: workbook.sheets.map((sheet) => {
      const rows = Array.from({ length: sheet.rowCount }, () =>
        Array.from({ length: sheet.columnCount }, () => ""),
      );
      for (const [address, value] of Object.entries(sheet.cells)) {
        const decoded = XLSX.utils.decode_cell(address);
        if (decoded.r < sheet.rowCount && decoded.c < sheet.columnCount) {
          rows[decoded.r]![decoded.c] = value;
        }
      }
      return { name: sheet.name, rows };
    }),
  };
}

export function resolveWorkbookValue(
  workbook: WorkbookValues | WorkbookSparseValues,
  ref: string,
) {
  const parsedRef = parseWorkbookRef(ref);
  if (!parsedRef) {
    return "";
  }
  const sheet = workbook.sheets.find((item) => item.name === parsedRef.sheet);
  if (!sheet) {
    return "";
  }
  if ("cells" in sheet) {
    const address = XLSX.utils.encode_cell({
      r: parsedRef.rowIndex,
      c: parsedRef.columnIndex,
    });
    return sheet.cells[address] ?? "";
  }
  return sheet.rows[parsedRef.rowIndex]?.[parsedRef.columnIndex] ?? "";
}

export function parseWorkbookRef(ref: string) {
  const match =
    /^(?:'((?:[^']|'')+)'|([^!]+))!\$?([A-Za-z]{1,3})\$?([1-9][0-9]*)/.exec(
      ref,
    );
  if (!match) {
    return null;
  }
  const rawSheet = match[1]?.replaceAll("''", "'") ?? match[2];
  const column = match[3];
  const row = Number(match[4]);
  if (!rawSheet || !column || Number.isNaN(row)) {
    return null;
  }
  return {
    sheet: rawSheet,
    rowIndex: row - 1,
    columnIndex: columnNameToIndex(column),
  };
}

export function inferWorkbookSparseSheetSize(cells: Record<string, string>) {
  let rowCount = 0;
  let columnCount = 0;
  for (const address of Object.keys(cells)) {
    const decoded = XLSX.utils.decode_cell(address);
    rowCount = Math.max(rowCount, decoded.r + 1);
    columnCount = Math.max(columnCount, decoded.c + 1);
  }
  return { rowCount, columnCount };
}

function sheetToSparseValues(
  name: string,
  sheet: XLSX.WorkSheet | undefined,
): WorkbookSparseSheet {
  const cells: Record<string, string> = {};
  let rowCount = 0;
  let columnCount = 0;
  if (sheet?.["!ref"]) {
    const range = XLSX.utils.decode_range(sheet["!ref"]);
    rowCount = range.e.r + 1;
    columnCount = range.e.c + 1;
  }
  for (const address of Object.keys(sheet ?? {})) {
    if (address.startsWith("!")) {
      continue;
    }
    const decoded = XLSX.utils.decode_cell(address);
    const cell = sheet?.[address];
    const value = cell?.w ?? (cell?.v == null ? "" : String(cell.v));
    cells[address] = value;
    rowCount = Math.max(rowCount, decoded.r + 1);
    columnCount = Math.max(columnCount, decoded.c + 1);
  }
  return { name, cells, rowCount, columnCount };
}

function columnNameToIndex(column: string) {
  return (
    [...column.toUpperCase()].reduce(
      (total, char) => total * 26 + char.charCodeAt(0) - 64,
      0,
    ) - 1
  );
}
