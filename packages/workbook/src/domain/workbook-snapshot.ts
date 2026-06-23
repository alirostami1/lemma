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
  type WorkbookCellType,
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
export const MAX_WORKBOOK_SNAPSHOT_RANGE_BATCH_REFS = 50;
export const MAX_WORKBOOK_SNAPSHOT_RANGE_BATCH_CELLS = 5_000;
export const MAX_WORKBOOK_SNAPSHOT_RANGE_BATCH_VALUE_BYTES = 512_000;

export type WorkbookSnapshot = {
  id: WorkbookSnapshotId;
  sourceId: string;
  workbookId: WorkbookId;
  calculationId: WorkbookCalculationId;
  questionIndex: number;
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
  cellTypes: WorkbookCellType[][];
};

export type WorkbookSnapshotRange = WorkbookSnapshotCells & {
  ref: string;
  startCellAddress: string;
  endCellAddress: string;
};

export type WorkbookSnapshotRangeBatchItem =
  | {
      ref: string;
      status: "ok";
      range: WorkbookSnapshotRange;
      errorMessage: null;
    }
  | {
      ref: string;
      status: "error";
      range: null;
      errorMessage: string;
    };

export type WorkbookSnapshotRangeBatch = {
  ranges: WorkbookSnapshotRangeBatchItem[];
};

export function createWorkbookSnapshot(
  input: {
    id: WorkbookSnapshotId;
    sourceId: string;
    workbookId: WorkbookId;
    calculationId: WorkbookCalculationId;
    questionIndex: number;
    snapshotIndex: number;
    values: WorkbookSparseValues;
  },
  at: Date,
): WorkbookSnapshot {
  if (
    typeof input.sourceId !== "string" ||
    !/^[A-Za-z][A-Za-z0-9_-]*$/u.test(input.sourceId)
  ) {
    throw new InvalidWorkbookSnapshotDataError(
      "sourceId must start with a letter and contain only letters, numbers, underscores, or hyphens.",
    );
  }
  if (!Number.isInteger(input.questionIndex) || input.questionIndex < 0) {
    throw new InvalidWorkbookSnapshotDataError(
      "questionIndex must be non-negative.",
    );
  }
  if (!Number.isInteger(input.snapshotIndex) || input.snapshotIndex < 0) {
    throw new InvalidWorkbookSnapshotDataError(
      "snapshotIndex must be non-negative.",
    );
  }
  return {
    calculationId: input.calculationId,
    createdAt: at,
    id: input.id,
    questionIndex: input.questionIndex,
    snapshotIndex: input.snapshotIndex,
    sourceId: input.sourceId,
    values: workbookSparseValues(input.values),
    workbookId: input.workbookId,
  };
}

export function createWorkbookSnapshotMetadata(
  snapshot: WorkbookSnapshot,
): WorkbookSnapshotMetadata {
  return {
    cellCount: snapshot.values.sheets.reduce(
      (total, sheet) => total + Object.keys(sheet.cells).length,
      0,
    ),
    sheetCount: snapshot.values.sheets.length,
    status: "ready",
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
    nextCursor,
    workbookSnapshotSheets: visible,
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
    columnCount,
    rowCount,
    sheet,
    sheetIndex: input.sheetIndex,
    startColumn,
    startRow,
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
    columnCount: endColumn - startColumn + 1,
    rowCount: endRow - startRow + 1,
    sheet,
    sheetIndex,
    startColumn,
    startRow,
  });

  return {
    ...cells,
    endCellAddress: `${columnNumberToName(endColumn)}${endRow}`,
    ref: `${formatSheetNameForRef(sheet.name)}!${columnNumberToName(
      startColumn,
    )}${startRow}:${columnNumberToName(endColumn)}${endRow}`,
    startCellAddress: `${columnNumberToName(startColumn)}${startRow}`,
  };
}

export function createWorkbookSnapshotRangeBatch(
  snapshot: WorkbookSnapshot,
  input: {
    refs: string[];
  },
): WorkbookSnapshotRangeBatch {
  if (
    !Array.isArray(input.refs) ||
    input.refs.length < 1 ||
    input.refs.length > MAX_WORKBOOK_SNAPSHOT_RANGE_BATCH_REFS
  ) {
    throw new InvalidWorkbookSnapshotReferenceError(
      `refs must contain 1 to ${MAX_WORKBOOK_SNAPSHOT_RANGE_BATCH_REFS} items.`,
    );
  }

  const ranges: WorkbookSnapshotRangeBatchItem[] = [];
  let totalCells = 0;
  let totalValueBytes = 0;

  for (const ref of input.refs) {
    try {
      const range = createWorkbookSnapshotRange(snapshot, { ref });
      const nextTotalCells = totalCells + range.rowCount * range.columnCount;
      const nextTotalValueBytes =
        totalValueBytes + workbookSnapshotRangeValueBytes(range);

      if (nextTotalCells > MAX_WORKBOOK_SNAPSHOT_RANGE_BATCH_CELLS) {
        ranges.push({
          errorMessage: `Batch ranges must return at most ${MAX_WORKBOOK_SNAPSHOT_RANGE_BATCH_CELLS} cells.`,
          range: null,
          ref,
          status: "error",
        });
        continue;
      }

      if (nextTotalValueBytes > MAX_WORKBOOK_SNAPSHOT_RANGE_BATCH_VALUE_BYTES) {
        ranges.push({
          errorMessage: `Batch range values must be at most ${MAX_WORKBOOK_SNAPSHOT_RANGE_BATCH_VALUE_BYTES} bytes.`,
          range: null,
          ref,
          status: "error",
        });
        continue;
      }

      totalCells = nextTotalCells;
      totalValueBytes = nextTotalValueBytes;
      ranges.push({ errorMessage: null, range, ref, status: "ok" });
    } catch (error) {
      ranges.push({
        errorMessage:
          error instanceof InvalidWorkbookSnapshotReferenceError
            ? error.message
            : "Range could not be loaded.",
        range: null,
        ref,
        status: "error",
      });
    }
  }

  return { ranges };
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
  return { cellAddress, sheetName };
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
    endCellAddress,
    sheetName,
    startCellAddress,
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
    columnCount: sheet.columnCount,
    name: sheet.name,
    nonEmptyCellCount: Object.keys(sheet.cells).length,
    rowCount: sheet.rowCount,
    sheetIndex,
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
  const cellTypes: WorkbookCellType[][] = [];
  let valueBytes = 0;

  for (
    let row = input.startRow;
    row < input.startRow + input.rowCount;
    row += 1
  ) {
    const values: string[] = [];
    const types: WorkbookCellType[] = [];

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
    cellTypes,
    columnCount: input.columnCount,
    rowCount: input.rowCount,
    rows,
    sheetIndex: input.sheetIndex,
    sheetName: input.sheet.name,
    startColumn: input.startColumn,
    startRow: input.startRow,
  };
}

function workbookSnapshotRangeValueBytes(range: WorkbookSnapshotRange): number {
  return range.rows.reduce(
    (total, row) =>
      total +
      row.reduce(
        (rowTotal, value) => rowTotal + Buffer.byteLength(value, "utf8"),
        0,
      ),
    0,
  );
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
