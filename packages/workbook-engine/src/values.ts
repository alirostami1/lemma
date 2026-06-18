import { readFile } from "node:fs/promises";
import * as XLSX from "xlsx";
import type {
  WorkbookCellType,
  WorkbookEngineConfig,
  WorkbookSparseSheet,
  WorkbookSparseValues,
  WorkbookValues,
} from "./domain.js";
import { WorkbookEngineError } from "./domain.js";

export type WorkbookValueLimits = {
  maxSheets: number;
  maxCells: number;
  maxCachedValueBytes: number;
};

export async function readWorkbookValues(
  path: string,
  config?: WorkbookEngineConfig,
): Promise<WorkbookValues> {
  return parseWorkbookValues(await readFile(path), config);
}

export async function readWorkbookSparseValues(
  path: string,
  config?: WorkbookEngineConfig,
): Promise<WorkbookSparseValues> {
  return parseWorkbookSparseValues(await readFile(path), config);
}

export function parseWorkbookValues(
  buffer: Buffer,
  config?: WorkbookEngineConfig,
): WorkbookValues {
  return sparseValuesToRows(parseWorkbookSparseValues(buffer, config));
}

export function parseWorkbookSparseValues(
  buffer: Buffer,
  config?: WorkbookEngineConfig,
): WorkbookSparseValues {
  try {
    const parsed = XLSX.read(buffer, {
      type: "buffer",
      cellDates: false,
      cellText: true,
      bookVBA: false,
    });
    const limits = workbookValueLimits(config);
    if (parsed.SheetNames.length > limits.maxSheets) {
      throw new WorkbookEngineError(
        "workbook_too_large",
        "Workbook has too many sheets.",
      );
    }
    const sheets = parsed.SheetNames.map((name) =>
      sheetToSparseValues(name, parsed.Sheets[name], limits),
    );
    return normalizeWorkbookSparseValues({ sheets }, limits);
  } catch (error) {
    if (error instanceof WorkbookEngineError) {
      throw error;
    }
    throw new WorkbookEngineError(
      "workbook_parse_failed",
      "Workbook cached values could not be parsed.",
      { cause: error instanceof Error ? error.message : String(error) },
    );
  }
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
          const targetRow = rows[decoded.r];
          if (targetRow === undefined) {
            continue;
          }
          targetRow[decoded.c] = value;
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

export function normalizeWorkbookSparseValues(
  workbook: WorkbookSparseValues,
  limits: WorkbookValueLimits,
): WorkbookSparseValues {
  if (workbook.sheets.length > limits.maxSheets) {
    throw new WorkbookEngineError(
      "workbook_too_large",
      "Workbook values include too many sheets.",
    );
  }

  let cellCount = 0;
  let valueBytes = 0;
  return {
    sheets: workbook.sheets.map((sheet) => {
      const cells = Object.fromEntries(
        Object.entries(sheet.cells).map(([address, value]) => {
          cellCount += 1;
          valueBytes += Buffer.byteLength(value, "utf8");
          if (cellCount > limits.maxCells) {
            throw new WorkbookEngineError(
              "workbook_too_large",
              "Workbook values include too many cells.",
            );
          }
          if (valueBytes > limits.maxCachedValueBytes) {
            throw new WorkbookEngineError(
              "workbook_too_large",
              "Workbook cached values are too large.",
            );
          }
          return [address, value] as const;
        }),
      );
      const inferred = inferWorkbookSparseSheetSize(cells);
      return {
        name: sheet.name,
        cells,
        cellTypes: sheet.cellTypes,
        rowCount: Math.max(sheet.rowCount, inferred.rowCount),
        columnCount: Math.max(sheet.columnCount, inferred.columnCount),
      };
    }),
  };
}

export function workbookValueLimits(
  config?: WorkbookEngineConfig,
): WorkbookValueLimits {
  return {
    maxSheets: config?.maxSheets ?? 50,
    maxCells: config?.maxCells ?? 500_000,
    maxCachedValueBytes:
      config?.maxCachedValueBytes ?? config?.maxResponseBytes ?? 10_000_000,
  };
}

function sheetToSparseValues(
  name: string,
  sheet: XLSX.WorkSheet | undefined,
  limits: WorkbookValueLimits,
): WorkbookSparseSheet {
  const cells: Record<string, string> = {};
  const cellTypes: Record<string, WorkbookCellType> = {};
  let rowCount = 0;
  let columnCount = 0;
  if (sheet?.["!ref"]) {
    const range = XLSX.utils.decode_range(sheet["!ref"]);
    rowCount = range.e.r + 1;
    columnCount = range.e.c + 1;
  }
  let valueBytes = 0;
  let cellCount = 0;
  for (const address of Object.keys(sheet ?? {})) {
    if (address.startsWith("!")) {
      continue;
    }
    cellCount += 1;
    if (cellCount > limits.maxCells) {
      throw new WorkbookEngineError(
        "workbook_too_large",
        "Workbook values include too many cells.",
      );
    }
    const decoded = XLSX.utils.decode_cell(address);
    const cell = sheet?.[address];
    const value = cell?.w ?? (cell?.v == null ? "" : String(cell.v));
    valueBytes += Buffer.byteLength(value, "utf8");
    if (valueBytes > limits.maxCachedValueBytes) {
      throw new WorkbookEngineError(
        "workbook_too_large",
        "Workbook cached values are too large.",
      );
    }
    cells[address] = value;
    cellTypes[address] = workbookCellType(cell);
    rowCount = Math.max(rowCount, decoded.r + 1);
    columnCount = Math.max(columnCount, decoded.c + 1);
  }
  return { name, cells, cellTypes, rowCount, columnCount };
}

function workbookCellType(cell: XLSX.CellObject | undefined): WorkbookCellType {
  if (!cell || cell.v == null) {
    return "blank";
  }
  if (typeof cell.f === "string" && cell.f.length > 0) {
    return "formula_cached";
  }
  if (cell.t === "n") {
    return "number";
  }
  if (cell.t === "b") {
    return "boolean";
  }
  if (cell.t === "d") {
    return "date_like";
  }
  if (cell.t === "e") {
    return "error";
  }
  return "string";
}

function columnNameToIndex(column: string) {
  return (
    [...column.toUpperCase()].reduce(
      (total, char) => total * 26 + char.charCodeAt(0) - 64,
      0,
    ) - 1
  );
}
