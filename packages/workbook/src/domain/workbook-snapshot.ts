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
  type WorkbookSparseValues,
  workbookSparseValues,
} from "./workbook-values.js";

export type WorkbookSnapshot = {
  id: WorkbookSnapshotId;
  workbookId: WorkbookId;
  calculationId: WorkbookCalculationId;
  snapshotIndex: number;
  values: WorkbookSparseValues;
  createdAt: Date;
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
      "Range ref must look like Sheet1!A1:B2.",
    );
  }

  const separatorIndex = findSheetSeparatorIndex(ref);
  if (separatorIndex <= 0 || separatorIndex === ref.length - 1) {
    throw new InvalidWorkbookSnapshotReferenceError(
      "Range ref must look like Sheet1!A1:B2.",
    );
  }

  const sheetName = parseSheetName(ref.slice(0, separatorIndex));
  const rangePart = ref.slice(separatorIndex + 1);
  const [start, end, extra] = rangePart.split(":");

  if (!start || !end || extra !== undefined) {
    throw new InvalidWorkbookSnapshotReferenceError(
      "Range ref must look like Sheet1!A1:B2.",
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
