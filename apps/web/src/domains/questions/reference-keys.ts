import type { ReferenceSourceDraft } from "./authoring";
import { type ParsedWorkbookRef, parseWorkbookRef } from "./workbook-reference";

export type WorkbookReferenceKeyParts =
  | {
      kind: "cell";
      sourceId: string;
      sheetName: string;
      cell: string;
    }
  | {
      kind: "range";
      sourceId: string;
      sheetName: string;
      startCell: string;
      endCell: string;
    };

export type ParseWorkbookReferenceKeyResult =
  | { status: "parsed"; parts: WorkbookReferenceKeyParts }
  | { status: "invalid"; reason: string };

type WorkbookStructuredSource = Extract<
  ReferenceSourceDraft,
  { type: "workbook_cell" | "workbook_range" }
>;

type NormalizedWorkbookSource =
  | {
      type: "workbook_cell";
      sourceId: string;
      ref: string;
    }
  | {
      type: "workbook_range";
      sourceId: string;
      ref: string;
    };

const SIMPLE_REFERENCE_IDENTIFIER_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/u;
const SIMPLE_CELL_PATTERN = /^\$?[A-Za-z]{1,3}\$?[1-9][0-9]*$/u;

export function formatWorkbookReferenceKey(
  parts: WorkbookReferenceKeyParts,
): string {
  const sourceId = normalizeSourceId(parts.sourceId);
  const sheetName = normalizeSheetName(parts.sheetName);

  if (parts.kind === "cell") {
    return `workbook:${sourceId}:cell:${encodeURIComponent(sheetName)}:${normalizeCellAddress(parts.cell)}`;
  }

  const startCellPosition = parseCellPosition(parts.startCell);
  const endCellPosition = parseCellPosition(parts.endCell);
  if (!startCellPosition || !endCellPosition) {
    throw new Error("Range cells must be valid A1 references.");
  }
  const normalizedRange = normalizeRangePositions(
    startCellPosition,
    endCellPosition,
  );

  return `workbook:${sourceId}:range:${encodeURIComponent(sheetName)}:${formatCellPosition(normalizedRange.start)}:${formatCellPosition(normalizedRange.end)}`;
}

export function parseWorkbookReferenceKey(
  key: string,
): ParseWorkbookReferenceKeyResult {
  if (!key.startsWith("workbook:")) {
    return {
      reason: "Reference key must start with workbook:.",
      status: "invalid",
    };
  }

  const segments = key.split(":");
  if (segments.length !== 5 && segments.length !== 6) {
    return {
      reason: "Reference key has invalid shape.",
      status: "invalid",
    };
  }

  const [, sourceId, kind, encodedSheetName, startCell, endCell] = segments;
  let normalizedSourceId = "";
  try {
    normalizedSourceId = normalizeSourceId(sourceId ?? "");
  } catch (error) {
    return {
      reason:
        error instanceof Error
          ? error.message
          : "Reference key has invalid source id.",
      status: "invalid",
    };
  }

  let sheetName = "";
  try {
    sheetName = decodeURIComponent(encodedSheetName ?? "").trim();
  } catch {
    return { reason: "Sheet name encoding is invalid.", status: "invalid" };
  }
  if (sheetName.length === 0) {
    return {
      reason: "Reference key is missing sheet name.",
      status: "invalid",
    };
  }

  const normalizedStartCell = normalizeCellAddress(startCell ?? "");
  const startCellPosition = parseCellPosition(normalizedStartCell);
  if (!startCellPosition) {
    return {
      reason: "Reference key has invalid start cell.",
      status: "invalid",
    };
  }

  if (kind === "cell") {
    if (segments.length !== 5) {
      return { reason: "Reference key has invalid shape.", status: "invalid" };
    }

    return {
      parts: {
        cell: formatCellPosition(startCellPosition),
        kind: "cell",
        sheetName,
        sourceId: normalizedSourceId,
      },
      status: "parsed",
    };
  }

  if (kind === "range") {
    const endCellPosition = parseCellPosition(
      normalizeCellAddress(endCell ?? ""),
    );
    if (!endCellPosition) {
      return {
        reason: "Reference key has invalid end cell.",
        status: "invalid",
      };
    }
    const normalizedRange = normalizeRangePositions(
      startCellPosition,
      endCellPosition,
    );

    return {
      parts: {
        endCell: formatCellPosition(normalizedRange.end),
        kind: "range",
        sheetName,
        sourceId: normalizedSourceId,
        startCell: formatCellPosition(normalizedRange.start),
      },
      status: "parsed",
    };
  }

  return {
    reason: "Reference key kind must be cell or range.",
    status: "invalid",
  };
}

export function isCanonicalWorkbookReferenceKey(key: string): boolean {
  const parsed = parseWorkbookReferenceKey(key);
  return (
    parsed.status === "parsed" &&
    formatWorkbookReferenceKey(parsed.parts) === key
  );
}

export function normalizeWorkbookRefInput(input: {
  sourceId: string;
  rawRef: string;
  defaultSheetName: string | null;
}):
  | {
      status: "normalized";
      source: NormalizedWorkbookSource;
      referenceId: string;
    }
  | { status: "invalid"; reason: string } {
  const parsed = parseWorkbookRefWithDefaultSheet({
    defaultSheetName: input.defaultSheetName,
    rawRef: input.rawRef,
  });
  if (parsed.status === "invalid") {
    return parsed;
  }

  const referenceId = parsed.parsed.hasRange
    ? formatWorkbookReferenceKey({
        endCell: getCellAddress(
          parsed.parsed.endColumnIndex,
          parsed.parsed.endRowIndex,
        ),
        kind: "range",
        sheetName: parsed.parsed.sheetName,
        sourceId: input.sourceId,
        startCell: getCellAddress(
          parsed.parsed.startColumnIndex,
          parsed.parsed.startRowIndex,
        ),
      })
    : formatWorkbookReferenceKey({
        cell: getCellAddress(
          parsed.parsed.startColumnIndex,
          parsed.parsed.startRowIndex,
        ),
        kind: "cell",
        sheetName: parsed.parsed.sheetName,
        sourceId: input.sourceId,
      });
  const ref = formatStructuredWorkbookRef(parsed.parsed);

  return {
    referenceId,
    source: parsed.parsed.hasRange
      ? { ref, sourceId: input.sourceId, type: "workbook_range" }
      : { ref, sourceId: input.sourceId, type: "workbook_cell" },
    status: "normalized",
  };
}

export function getWorkbookReferenceKeyForSource(
  source: ReferenceSourceDraft,
): string | null {
  if (source.type !== "workbook_cell" && source.type !== "workbook_range") {
    return null;
  }

  const parsed = parseWorkbookRef(source.ref);
  if (!parsed) {
    return null;
  }

  return parsed.hasRange
    ? formatWorkbookReferenceKey({
        endCell: getCellAddress(parsed.endColumnIndex, parsed.endRowIndex),
        kind: "range",
        sheetName: parsed.sheetName,
        sourceId: source.sourceId,
        startCell: getCellAddress(
          parsed.startColumnIndex,
          parsed.startRowIndex,
        ),
      })
    : formatWorkbookReferenceKey({
        cell: getCellAddress(parsed.startColumnIndex, parsed.startRowIndex),
        kind: "cell",
        sheetName: parsed.sheetName,
        sourceId: source.sourceId,
      });
}

export function getWorkbookReferenceDisplayName(
  source: WorkbookStructuredSource,
): string {
  const parsed = parseWorkbookRef(source.ref);
  if (!parsed) {
    return source.ref;
  }

  const startCell = getCellAddress(
    parsed.startColumnIndex,
    parsed.startRowIndex,
  );
  const endCell = parsed.hasRange
    ? `:${getCellAddress(parsed.endColumnIndex, parsed.endRowIndex)}`
    : "";

  return `${parsed.sheetName}!${startCell}${endCell}`;
}

export function formatReferenceToken(
  referenceId: string,
  rangeCell?: { rowOffset: number; columnOffset: number },
): string {
  const rangeSuffix = rangeCell
    ? `[${rangeCell.rowOffset},${rangeCell.columnOffset}]`
    : "";

  if (isSimpleReferenceIdentifier(referenceId)) {
    return `{{ .${referenceId}${rangeSuffix} }}`;
  }

  return `{{ .[${JSON.stringify(referenceId)}]${rangeSuffix} }}`;
}

export function isSimpleReferenceIdentifier(referenceId: string): boolean {
  return SIMPLE_REFERENCE_IDENTIFIER_PATTERN.test(referenceId);
}

function parseWorkbookRefWithDefaultSheet(input: {
  rawRef: string;
  defaultSheetName: string | null;
}):
  | { status: "parsed"; parsed: ParsedWorkbookRef }
  | { status: "invalid"; reason: string } {
  const rawRef = input.rawRef.trim();
  if (!rawRef) {
    return { reason: "Enter a workbook cell or range.", status: "invalid" };
  }

  const explicitRef = rawRef.includes("!")
    ? rawRef
    : input.defaultSheetName
      ? `${quoteWorkbookSheetName(input.defaultSheetName.trim())}!${rawRef}`
      : null;
  if (!explicitRef) {
    return {
      reason: "Select a sheet before entering a cell or range.",
      status: "invalid",
    };
  }

  const parsed = parseWorkbookRef(explicitRef);
  if (!parsed) {
    return { reason: "Enter a valid A1 cell or range.", status: "invalid" };
  }

  return { parsed, status: "parsed" };
}

function formatStructuredWorkbookRef(parsed: ParsedWorkbookRef): string {
  const startCell = getCellAddress(
    parsed.startColumnIndex,
    parsed.startRowIndex,
  );
  const endCell = getCellAddress(parsed.endColumnIndex, parsed.endRowIndex);
  const range = parsed.hasRange ? `${startCell}:${endCell}` : startCell;

  return `${quoteWorkbookSheetName(parsed.sheetName)}!${range}`;
}

function quoteWorkbookSheetName(sheetName: string): string {
  if (/^[A-Za-z0-9_]+$/u.test(sheetName)) {
    return sheetName;
  }

  return `'${sheetName.replace(/'/gu, "''")}'`;
}

function normalizeCellAddress(value: string): string {
  return value.trim().toUpperCase();
}

function getCellAddress(columnIndex: number, rowIndex: number): string {
  return `${columnIndexToLabel(columnIndex)}${rowIndex + 1}`;
}

function parseCellPosition(
  cell: string,
): { column: number; row: number } | null {
  const normalizedCell = normalizeCellAddress(cell);
  const match = normalizedCell.match(/^(\$?[A-Z]{1,3})(\$?[1-9][0-9]*)$/u);
  if (!match || !SIMPLE_CELL_PATTERN.test(normalizedCell)) {
    return null;
  }

  return {
    column: columnLabelToIndex(match[1].replace(/\$/gu, "")),
    row: Number(match[2].replace(/\$/gu, "")),
  };
}

function formatCellPosition(input: { column: number; row: number }): string {
  return `${columnIndexToLabel(input.column)}${input.row}`;
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

function columnLabelToIndex(label: string): number {
  let value = 0;
  for (const char of label) {
    value = value * 26 + char.charCodeAt(0) - 64;
  }
  return value - 1;
}

function normalizeRangePositions(
  start: { column: number; row: number },
  end: { column: number; row: number },
): {
  start: { column: number; row: number };
  end: { column: number; row: number };
} {
  return {
    end: {
      column: Math.max(start.column, end.column),
      row: Math.max(start.row, end.row),
    },
    start: {
      column: Math.min(start.column, end.column),
      row: Math.min(start.row, end.row),
    },
  };
}

function normalizeSourceId(sourceId: string): string {
  const normalizedSourceId = sourceId.trim();
  if (!SIMPLE_REFERENCE_IDENTIFIER_PATTERN.test(normalizedSourceId)) {
    throw new Error(
      "Source id must start with a letter and use letters, numbers, underscores, or hyphens.",
    );
  }
  return normalizedSourceId;
}

function normalizeSheetName(sheetName: string): string {
  const normalizedSheetName = sheetName.trim();
  if (normalizedSheetName.length === 0) {
    throw new Error("Sheet name must be a non-empty string.");
  }
  return normalizedSheetName;
}
