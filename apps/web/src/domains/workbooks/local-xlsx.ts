import { validateWorkbookUploadFile } from "#/domains/files/upload-validation";
import {
  formatWorkbookSheetName,
  normalizeWorkbookRef,
  parseWorkbookRef,
} from "#/domains/questions/workbook-reference";

const MAX_LOCAL_WORKBOOK_FILE_BYTES = 25 * 1024 * 1024;
const MAX_LOCAL_WORKBOOK_CELLS = 250_000;

export type LocalWorkbookCellValue = {
  sheetName: string;
  address: string;
  type:
    | "blank"
    | "string"
    | "number"
    | "boolean"
    | "date"
    | "error"
    | "formula"
    | "unknown";
  rawValue: string | number | boolean | Date | null;
  displayValue: string;
  formula: string | null;
  hasCachedValue: boolean;
};

export type LocalWorkbookSheet = {
  name: string;
  rowCount: number;
  columnCount: number;
  usedRange: string | null;
};

export type LocalWorkbookParseResult = {
  fileName: string;
  byteSize: number;
  sheetCount: number;
  sheets: readonly LocalWorkbookSheet[];
  cellsByKey: ReadonlyMap<string, LocalWorkbookCellValue>;
  parsedAt: Date;
};

export type LocalWorkbookParseError = {
  message: string;
  code:
    | "unsupported_file_type"
    | "file_too_large"
    | "empty_workbook"
    | "parse_failed";
};

export type LocalWorkbookParseOutcome =
  | { status: "parsed"; workbook: LocalWorkbookParseResult }
  | { status: "failed"; error: LocalWorkbookParseError };

export async function parseLocalWorkbookFile(
  file: File,
): Promise<LocalWorkbookParseOutcome> {
  const validation = validateWorkbookUploadFile(file);
  if (validation.status === "invalid") {
    return {
      error: {
        code: "unsupported_file_type",
        message:
          validation.issues[0]?.message ?? "Select an .xlsx workbook file.",
      },
      status: "failed",
    };
  }

  if (file.size > MAX_LOCAL_WORKBOOK_FILE_BYTES) {
    return {
      error: {
        code: "file_too_large",
        message: "Workbook file is too large to parse in browser.",
      },
      status: "failed",
    };
  }

  try {
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    if (
      fileBytes.length < 4 ||
      fileBytes[0] !== 0x50 ||
      fileBytes[1] !== 0x4b ||
      fileBytes[2] !== 0x03 ||
      fileBytes[3] !== 0x04
    ) {
      return {
        error: {
          code: "parse_failed",
          message: "Workbook could not be parsed.",
        },
        status: "failed",
      };
    }

    const XLSX = await import("xlsx");
    const workbook = XLSX.read(fileBytes, {
      cellDates: true,
      cellNF: true,
      cellText: true,
      type: "array",
    });

    if (workbook.SheetNames.length === 0) {
      return {
        error: {
          code: "empty_workbook",
          message: "Workbook has no sheets.",
        },
        status: "failed",
      };
    }

    const sheets: LocalWorkbookSheet[] = [];
    const cellsByKey = new Map<string, LocalWorkbookCellValue>();

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        continue;
      }

      const ref =
        typeof worksheet["!ref"] === "string" ? worksheet["!ref"] : null;
      const usedRange = ref
        ? `${formatWorkbookSheetName(sheetName, true)}!${normalizeRangeRef(ref)}`
        : null;

      if (!ref) {
        sheets.push({
          columnCount: 0,
          name: sheetName,
          rowCount: 0,
          usedRange: null,
        });
        continue;
      }

      const decodedRange = XLSX.utils.decode_range(ref);
      const rowCount = decodedRange.e.r - decodedRange.s.r + 1;
      const columnCount = decodedRange.e.c - decodedRange.s.c + 1;
      const cellCount = rowCount * columnCount;

      if (cellCount > MAX_LOCAL_WORKBOOK_CELLS) {
        return {
          error: {
            code: "parse_failed",
            message: "Workbook is too large to inspect in browser.",
          },
          status: "failed",
        };
      }

      sheets.push({
        columnCount,
        name: sheetName,
        rowCount,
        usedRange,
      });

      for (
        let rowIndex = decodedRange.s.r;
        rowIndex <= decodedRange.e.r;
        rowIndex += 1
      ) {
        for (
          let columnIndex = decodedRange.s.c;
          columnIndex <= decodedRange.e.c;
          columnIndex += 1
        ) {
          const address = XLSX.utils.encode_cell({
            c: columnIndex,
            r: rowIndex,
          });
          const cell = worksheet[address];
          const value = mapWorksheetCell(sheetName, address, cell);
          cellsByKey.set(createLocalWorkbookCellKey(sheetName, address), value);
        }
      }
    }

    return {
      status: "parsed",
      workbook: {
        byteSize: file.size,
        cellsByKey,
        fileName: file.name,
        parsedAt: new Date(),
        sheetCount: sheets.length,
        sheets,
      },
    };
  } catch {
    return {
      error: {
        code: "parse_failed",
        message: "Workbook could not be parsed.",
      },
      status: "failed",
    };
  }
}

export function getLocalWorkbookCell(
  workbook: LocalWorkbookParseResult,
  ref: string,
): LocalWorkbookCellValue | null {
  const parsedRef = parseWorkbookRef(ref);
  if (!parsedRef || parsedRef.hasRange) {
    return null;
  }

  return (
    workbook.cellsByKey.get(
      createLocalWorkbookCellKey(
        parsedRef.sheetName,
        `${columnIndexToLabel(parsedRef.startColumnIndex)}${parsedRef.startRowIndex + 1}`,
      ),
    ) ?? null
  );
}

export function getLocalWorkbookRange(
  workbook: LocalWorkbookParseResult,
  ref: string,
): readonly LocalWorkbookCellValue[] {
  const parsedRef = parseWorkbookRef(ref);
  if (!parsedRef) {
    return [];
  }

  const cells: LocalWorkbookCellValue[] = [];
  for (
    let rowIndex = parsedRef.startRowIndex;
    rowIndex <= parsedRef.endRowIndex;
    rowIndex += 1
  ) {
    for (
      let columnIndex = parsedRef.startColumnIndex;
      columnIndex <= parsedRef.endColumnIndex;
      columnIndex += 1
    ) {
      const address = `${columnIndexToLabel(columnIndex)}${rowIndex + 1}`;
      const cell =
        workbook.cellsByKey.get(
          createLocalWorkbookCellKey(parsedRef.sheetName, address),
        ) ?? null;
      if (cell) {
        cells.push(cell);
      }
    }
  }

  return cells;
}

export function searchLocalWorkbookCells(
  workbook: LocalWorkbookParseResult,
  query: string,
): readonly LocalWorkbookCellValue[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length === 0) {
    return [];
  }

  return [...workbook.cellsByKey.values()].filter((cell) => {
    const rawValue =
      cell.rawValue instanceof Date
        ? cell.rawValue.toISOString()
        : cell.rawValue === null
          ? ""
          : String(cell.rawValue);

    return (
      cell.displayValue.toLowerCase().includes(normalizedQuery) ||
      rawValue.toLowerCase().includes(normalizedQuery) ||
      cell.address.toLowerCase().includes(normalizedQuery) ||
      cell.sheetName.toLowerCase().includes(normalizedQuery)
    );
  });
}

export function createLocalWorkbookCellKey(
  sheetName: string,
  address: string,
): string {
  return `${sheetName}::${address.toUpperCase()}`;
}

function mapWorksheetCell(
  sheetName: string,
  address: string,
  cell: Record<string, unknown> | undefined,
): LocalWorkbookCellValue {
  if (!cell) {
    return {
      address,
      displayValue: "",
      formula: null,
      hasCachedValue: true,
      rawValue: null,
      sheetName,
      type: "blank",
    };
  }

  const formula = typeof cell.f === "string" ? cell.f : null;
  const formatted = typeof cell.w === "string" ? cell.w : null;
  const rawValue = mapRawCellValue(cell.v);
  const hasCachedValue = formula === null || cell.v !== undefined;

  if (formula && !hasCachedValue) {
    return {
      address,
      displayValue: "Cached value unavailable",
      formula,
      hasCachedValue: false,
      rawValue: null,
      sheetName,
      type: "formula",
    };
  }

  return {
    address,
    displayValue: formatted ?? formatRawValue(rawValue),
    formula,
    hasCachedValue,
    rawValue,
    sheetName,
    type: getCellType(cell, rawValue, formula),
  };
}

function mapRawCellValue(
  value: unknown,
): string | number | boolean | Date | null {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value instanceof Date
  ) {
    return value;
  }

  return null;
}

function getCellType(
  cell: Record<string, unknown>,
  rawValue: string | number | boolean | Date | null,
  formula: string | null,
): LocalWorkbookCellValue["type"] {
  if (formula) {
    return "formula";
  }

  if (cell.t === "e") {
    return "error";
  }

  if (rawValue === null) {
    return "blank";
  }

  if (rawValue instanceof Date) {
    return "date";
  }

  switch (typeof rawValue) {
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    default:
      return "unknown";
  }
}

function formatRawValue(
  value: string | number | boolean | Date | null,
): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value === null) {
    return "";
  }

  return String(value);
}

function normalizeRangeRef(ref: string): string {
  const normalized = normalizeWorkbookRef(`Sheet!${ref}`);
  return normalized?.split("!")[1] ?? ref;
}

function columnIndexToLabel(index: number): string {
  let value = index + 1;
  let label = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }
  return label;
}
