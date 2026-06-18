import type { JsonValue } from "@lemma/domain";
import {
  InvalidWorkbookSnapshotDataError,
  InvalidWorkbookSnapshotReferenceError,
} from "./errors.js";
import type {
  WorkbookCalculationId,
  WorkbookId,
  WorkbookSnapshotId,
} from "./ids.js";
import {
  type ValueSource,
  type WorkbookSparseSheet,
  type WorkbookSparseValues,
  workbookSparseValues,
} from "./workbook-values.js";

export const DEFAULT_WORKBOOK_SNAPSHOT_SHEET_PAGE_SIZE = 25;
export const MAX_WORKBOOK_SNAPSHOT_SHEET_PAGE_SIZE = 100;
export const MAX_WORKBOOK_SNAPSHOT_CELL_WINDOW_ROWS = 200;
export const MAX_WORKBOOK_SNAPSHOT_CELL_WINDOW_COLUMNS = 50;
export const MAX_WORKBOOK_SNAPSHOT_CELL_WINDOW_CELLS = 2_000;
export const MAX_WORKBOOK_SNAPSHOT_CELL_WINDOW_VALUE_BYTES = 256_000;

export type WorkbookSnapshot = {
  id: WorkbookSnapshotId;
  workbookId: WorkbookId;
  calculationId: WorkbookCalculationId;
  snapshotIndex: number;
  values: WorkbookSparseValues;
  createdAt: Date;
};

export type WorkbookSnapshotMetadata = {
  status: "ready";
  sheetCount: number;
  cellCount: number;
};

export type WorkbookSnapshotMetadataSheet = {
  sheetIndex: number;
  name: string;
  rowCount: number;
  columnCount: number;
  nonEmptyCellCount: number;
};

export type WorkbookSnapshotSheetsPage = {
  workbookSnapshotSheets: WorkbookSnapshotMetadataSheet[];
  nextCursor: string | null;
};

export type WorkbookSnapshotCells = {
  sheetIndex: number;
  sheetName: string;
  startRow: number;
  startColumn: number;
  rowCount: number;
  columnCount: number;
  rows: string[][];
  cellTypes: string[][];
};

export type WorkbookSnapshotRange = WorkbookSnapshotCells & {
  ref: string;
  startCellAddress: string;
  endCellAddress: string;
};

export function createWorkbookSnapshot(
  input: {
    id: WorkbookSnapshotId;
    workbookId: WorkbookId;
    calculationId: WorkbookCalculationId;
    snapshotIndex: number;
    values: WorkbookSparseValues;
  },
  at: Date,
): WorkbookSnapshot {
  if (!Number.isInteger(input.snapshotIndex) || input.snapshotIndex < 0) {
    throw new InvalidWorkbookSnapshotDataError(
      "snapshotIndex must be non-negative.",
    );
  }
  return {
    id: input.id,
    workbookId: input.workbookId,
    calculationId: input.calculationId,
    snapshotIndex: input.snapshotIndex,
    values: workbookSparseValues(input.values),
    createdAt: at,
  };
}

export function createWorkbookSnapshotMetadata(
  snapshot: WorkbookSnapshot,
): WorkbookSnapshotMetadata {
  return {
    status: "ready",
    sheetCount: snapshot.values.sheets.length,
    cellCount: snapshot.values.sheets.reduce(
      (total, sheet) => total + Object.keys(sheet.cells).length,
      0,
    ),
  };
}

export function listWorkbookSnapshotSheets(
  snapshot: WorkbookSnapshot,
  input?: {
    limit?: number;
    cursor?: string;
  },
): WorkbookSnapshotSheetsPage {
  const limit = normalizeSheetPageLimit(input?.limit);
  const cursor = decodeSheetCursor(input?.cursor);
  const sheetItems = snapshot.values.sheets.map(createWorkbookSnapshotSheet);
  const page = sheetItems.slice(cursor, cursor + limit + 1);
  const visible = page.slice(0, limit);
  const nextCursor =
    page.length > limit
      ? encodeSheetCursor(visible[visible.length - 1]?.sheetIndex)
      : null;

  return {
    workbookSnapshotSheets: visible,
    nextCursor,
  };
}

export function createWorkbookSnapshotCells(
  snapshot: WorkbookSnapshot,
  input: {
    sheetIndex: number;
    startRow: number;
    startColumn: number;
    rowCount: number;
    columnCount: number;
  },
): WorkbookSnapshotCells {
  const sheet = findSnapshotSheetByIndex(snapshot, input.sheetIndex);
  const startRow = normalizePositiveInteger(input.startRow, "startRow");
  const startColumn = normalizePositiveInteger(
    input.startColumn,
    "startColumn",
  );
  const rowCount = normalizePositiveInteger(input.rowCount, "rowCount");
  const columnCount = normalizePositiveInteger(
    input.columnCount,
    "columnCount",
  );

  return createWorkbookSnapshotCellsForWindow({
    sheet,
    sheetIndex: input.sheetIndex,
    startRow,
    startColumn,
    rowCount,
    columnCount,
  });
}

export function createWorkbookSnapshotRange(
  snapshot: WorkbookSnapshot,
  input: {
    ref: string;
  },
): WorkbookSnapshotRange {
  const ref = parseWorkbookRangeRef(input.ref);
  const sheetIndex = findSnapshotSheetIndex(snapshot, ref.sheetName);
  const sheet = findSnapshotSheetByIndex(snapshot, sheetIndex);
  const startCellAddress = parseCellAddress(ref.startCellAddress);
  const endCellAddress = parseCellAddress(ref.endCellAddress);
  const start = parseCellAddressParts(startCellAddress);
  const end = parseCellAddressParts(endCellAddress);

  const startRow = Math.min(start.row, end.row);
  const endRow = Math.max(start.row, end.row);
  const startColumn = Math.min(start.column, end.column);
  const endColumn = Math.max(start.column, end.column);
  const cells = createWorkbookSnapshotCellsForWindow({
    sheet,
    sheetIndex,
    startRow,
    startColumn,
    rowCount: endRow - startRow + 1,
    columnCount: endColumn - startColumn + 1,
  });

  return {
    ...cells,
    ref: `${formatSheetNameForRef(sheet.name)}!${columnNumberToName(
      startColumn,
    )}${startRow}:${columnNumberToName(endColumn)}${endRow}`,
    startCellAddress: `${columnNumberToName(startColumn)}${startRow}`,
    endCellAddress: `${columnNumberToName(endColumn)}${endRow}`,
  };
}

export function resolveWorkbookSnapshotValue(
  snapshot: WorkbookSnapshot,
  valueSource: ValueSource,
): JsonValue {
  if (typeof valueSource !== "object" || valueSource === null) {
    throw new InvalidWorkbookSnapshotReferenceError(
      "Unsupported value source type.",
    );
  }

  const valueSourceType = (valueSource as { type?: unknown }).type;

  if (valueSourceType === "literal") {
    return (valueSource as { type: "literal"; value: JsonValue }).value;
  }

  if (valueSourceType === "cell") {
    const ref = parseWorkbookCellRef(
      (valueSource as { type: "cell"; ref?: unknown }).ref,
    );

    const sheet = findSnapshotSheet(snapshot, ref.sheetName);

    return sheet.cells[ref.cellAddress] ?? "";
  }

  if (valueSourceType === "range") {
    const ref = parseWorkbookRangeRef(
      (valueSource as { type: "range"; ref?: unknown }).ref,
    );

    const sheet = findSnapshotSheet(snapshot, ref.sheetName);

    return cellsInRange(sheet.cells, ref.startCellAddress, ref.endCellAddress);
  }

  throw new InvalidWorkbookSnapshotReferenceError(
    "Unsupported value source type.",
  );
}

type WorkbookCellRef = {
  sheetName: string;
  cellAddress: string;
};

function parseWorkbookCellRef(ref: unknown): WorkbookCellRef {
  if (typeof ref !== "string") {
    throw new InvalidWorkbookSnapshotReferenceError(
      "Cell ref must look like Sheet1!A1.",
    );
  }
  const separatorIndex = findSheetSeparatorIndex(ref);
  if (separatorIndex <= 0 || separatorIndex === ref.length - 1) {
    throw new InvalidWorkbookSnapshotReferenceError(
      "Cell ref must look like Sheet1!A1.",
    );
  }
  const sheetName = parseSheetName(ref.slice(0, separatorIndex));
  const cellAddress = parseCellAddress(ref.slice(separatorIndex + 1));
  return { sheetName, cellAddress };
}

function findSheetSeparatorIndex(ref: string): number {
  if (!ref.startsWith("'")) {
    return ref.indexOf("!");
  }
  for (let index = 1; index < ref.length; index += 1) {
    if (ref[index] !== "'") {
      continue;
    }
    if (ref[index + 1] === "'") {
      index += 1;
      continue;
    }
    return ref[index + 1] === "!" ? index + 1 : -1;
  }
  return -1;
}

function parseSheetName(value: string): string {
  if (value.startsWith("'")) {
    if (!value.endsWith("'")) {
      throw new InvalidWorkbookSnapshotReferenceError(
        "Cell ref must look like Sheet1!A1.",
      );
    }
    const sheetName = value.slice(1, -1).replaceAll("''", "'");
    if (sheetName.length === 0) {
      throw new InvalidWorkbookSnapshotReferenceError(
        "Cell ref must look like Sheet1!A1.",
      );
    }
    return sheetName;
  }
  if (value.length === 0 || value.includes("'")) {
    throw new InvalidWorkbookSnapshotReferenceError(
      "Cell ref must look like Sheet1!A1.",
    );
  }
  return value;
}

function parseCellAddress(value: string): string {
  const match = /^\$?([A-Z]+)\$?([1-9][0-9]*)$/i.exec(value);
  if (!match?.[1] || !match[2]) {
    throw new InvalidWorkbookSnapshotReferenceError(
      "Cell ref must look like Sheet1!A1.",
    );
  }
  return `${match[1].toUpperCase()}${match[2]}`;
}

type WorkbookRangeRef = {
  sheetName: string;
  startCellAddress: string;
  endCellAddress: string;
};

function parseWorkbookRangeRef(ref: unknown): WorkbookRangeRef {
  if (typeof ref !== "string") {
    throw new InvalidWorkbookSnapshotReferenceError(
      "Range ref must look like Sheet1!A1 or Sheet1!A1:B2.",
    );
  }

  const separatorIndex = findSheetSeparatorIndex(ref);
  if (separatorIndex <= 0 || separatorIndex === ref.length - 1) {
    throw new InvalidWorkbookSnapshotReferenceError(
      "Range ref must look like Sheet1!A1 or Sheet1!A1:B2.",
    );
  }

  const sheetName = parseSheetName(ref.slice(0, separatorIndex));
  const rangePart = ref.slice(separatorIndex + 1);
  const [start, end = start, extra] = rangePart.split(":");

  if (!start || !end || extra !== undefined) {
    throw new InvalidWorkbookSnapshotReferenceError(
      "Range ref must look like Sheet1!A1 or Sheet1!A1:B2.",
    );
  }

  const startCellAddress = parseCellAddress(start);
  const endCellAddress = parseCellAddress(end);

  return {
    sheetName,
    startCellAddress,
    endCellAddress,
  };
}

function normalizeSheetPageLimit(value: number | undefined): number {
  if (value === undefined) {
    return DEFAULT_WORKBOOK_SNAPSHOT_SHEET_PAGE_SIZE;
  }
  if (
    !Number.isInteger(value) ||
    value < 1 ||
    value > MAX_WORKBOOK_SNAPSHOT_SHEET_PAGE_SIZE
  ) {
    throw new InvalidWorkbookSnapshotReferenceError(
      `limit must be between 1 and ${MAX_WORKBOOK_SNAPSHOT_SHEET_PAGE_SIZE}.`,
    );
  }
  return value;
}

function decodeSheetCursor(cursor: string | undefined): number {
  if (cursor === undefined) {
    return 0;
  }
  const value = Number(cursor);
  if (!Number.isInteger(value) || value < 0) {
    throw new InvalidWorkbookSnapshotReferenceError(
      "cursor must be a non-negative sheet index.",
    );
  }
  return value;
}

function encodeSheetCursor(sheetIndex: number | undefined): string | null {
  return sheetIndex === undefined ? null : String(sheetIndex + 1);
}

function createWorkbookSnapshotSheet(
  sheet: WorkbookSparseSheet,
  sheetIndex: number,
): WorkbookSnapshotMetadataSheet {
  return {
    sheetIndex,
    name: sheet.name,
    rowCount: sheet.rowCount,
    columnCount: sheet.columnCount,
    nonEmptyCellCount: Object.keys(sheet.cells).length,
  };
}

function normalizePositiveInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new InvalidWorkbookSnapshotReferenceError(
      `${name} must be a positive integer.`,
    );
  }
  return value;
}

function createWorkbookSnapshotCellsForWindow(input: {
  sheet: WorkbookSparseSheet;
  sheetIndex: number;
  startRow: number;
  startColumn: number;
  rowCount: number;
  columnCount: number;
}): WorkbookSnapshotCells {
  enforceCellWindowBounds(input.rowCount, input.columnCount);
  const rows: string[][] = [];
  const cellTypes: string[][] = [];
  let valueBytes = 0;

  for (
    let row = input.startRow;
    row < input.startRow + input.rowCount;
    row += 1
  ) {
    const values: string[] = [];
    const types: string[] = [];

    for (
      let column = input.startColumn;
      column < input.startColumn + input.columnCount;
      column += 1
    ) {
      const cellAddress = `${columnNumberToName(column)}${row}`;
      const value = input.sheet.cells[cellAddress] ?? "";
      valueBytes += Buffer.byteLength(value, "utf8");
      if (valueBytes > MAX_WORKBOOK_SNAPSHOT_CELL_WINDOW_VALUE_BYTES) {
        throw new InvalidWorkbookSnapshotReferenceError(
          `Cell window values must be at most ${MAX_WORKBOOK_SNAPSHOT_CELL_WINDOW_VALUE_BYTES} bytes.`,
        );
      }
      values.push(value);
      types.push(input.sheet.cellTypes?.[cellAddress] ?? "blank");
    }

    rows.push(values);
    cellTypes.push(types);
  }

  return {
    sheetIndex: input.sheetIndex,
    sheetName: input.sheet.name,
    startRow: input.startRow,
    startColumn: input.startColumn,
    rowCount: input.rowCount,
    columnCount: input.columnCount,
    rows,
    cellTypes,
  };
}

function enforceCellWindowBounds(rowCount: number, columnCount: number): void {
  if (rowCount > MAX_WORKBOOK_SNAPSHOT_CELL_WINDOW_ROWS) {
    throw new InvalidWorkbookSnapshotReferenceError(
      `rowCount must be at most ${MAX_WORKBOOK_SNAPSHOT_CELL_WINDOW_ROWS}.`,
    );
  }
  if (columnCount > MAX_WORKBOOK_SNAPSHOT_CELL_WINDOW_COLUMNS) {
    throw new InvalidWorkbookSnapshotReferenceError(
      `columnCount must be at most ${MAX_WORKBOOK_SNAPSHOT_CELL_WINDOW_COLUMNS}.`,
    );
  }
  if (rowCount * columnCount > MAX_WORKBOOK_SNAPSHOT_CELL_WINDOW_CELLS) {
    throw new InvalidWorkbookSnapshotReferenceError(
      `Cell window must be at most ${MAX_WORKBOOK_SNAPSHOT_CELL_WINDOW_CELLS} cells.`,
    );
  }
}

function findSnapshotSheetIndex(
  snapshot: WorkbookSnapshot,
  sheetName: string,
): number {
  const index = snapshot.values.sheets.findIndex(
    (candidate) => candidate.name.toLowerCase() === sheetName.toLowerCase(),
  );
  if (index < 0) {
    throw new InvalidWorkbookSnapshotReferenceError(
      "Sheet not found in workbook snapshot.",
    );
  }
  return index;
}

function findSnapshotSheetByIndex(
  snapshot: WorkbookSnapshot,
  sheetIndex: number,
): WorkbookSparseSheet {
  if (!Number.isInteger(sheetIndex) || sheetIndex < 0) {
    throw new InvalidWorkbookSnapshotReferenceError(
      "sheetIndex must be a non-negative integer.",
    );
  }
  const sheet = snapshot.values.sheets[sheetIndex];
  if (!sheet) {
    throw new InvalidWorkbookSnapshotReferenceError(
      "Sheet not found in workbook snapshot.",
    );
  }
  return sheet;
}

function formatSheetNameForRef(sheetName: string): string {
  return `'${sheetName.replaceAll("'", "''")}'`;
}

function findSnapshotSheet(
  snapshot: WorkbookSnapshot,
  sheetName: string,
): WorkbookSparseValues["sheets"][number] {
  const sheet = snapshot.values.sheets.find(
    (candidate) => candidate.name.toLowerCase() === sheetName.toLowerCase(),
  );

  if (!sheet) {
    throw new InvalidWorkbookSnapshotReferenceError(
      "Sheet not found in workbook snapshot.",
    );
  }

  return sheet;
}

function cellsInRange(
  cells: Record<string, string>,
  startCellAddress: string,
  endCellAddress: string,
): JsonValue {
  const start = parseCellAddressParts(startCellAddress);
  const end = parseCellAddressParts(endCellAddress);

  const startRow = Math.min(start.row, end.row);
  const endRow = Math.max(start.row, end.row);
  const startColumn = Math.min(start.column, end.column);
  const endColumn = Math.max(start.column, end.column);

  const values: string[][] = [];

  for (let row = startRow; row <= endRow; row += 1) {
    const rowValues: string[] = [];

    for (let column = startColumn; column <= endColumn; column += 1) {
      rowValues.push(cells[`${columnNumberToName(column)}${row}`] ?? "");
    }

    values.push(rowValues);
  }

  return values;
}

function parseCellAddressParts(cellAddress: string): {
  column: number;
  row: number;
} {
  const match = /^([A-Z]+)([1-9][0-9]*)$/u.exec(cellAddress);

  if (!match?.[1] || !match[2]) {
    throw new InvalidWorkbookSnapshotReferenceError(
      "Cell ref must look like Sheet1!A1.",
    );
  }

  return {
    column: columnNameToNumber(match[1]),
    row: Number(match[2]),
  };
}

function columnNameToNumber(columnName: string): number {
  let column = 0;

  for (const char of columnName) {
    column = column * 26 + (char.charCodeAt(0) - 64);
  }

  return column;
}

function columnNumberToName(column: number): string {
  if (!Number.isInteger(column) || column < 1) {
    throw new InvalidWorkbookSnapshotReferenceError(
      "Cell ref must look like Sheet1!A1.",
    );
  }

  let current = column;
  let name = "";

  while (current > 0) {
    const remainder = (current - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    current = Math.floor((current - 1) / 26);
  }

  return name;
}
