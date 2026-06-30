import { InvalidQuestionFieldError } from "./errors.js";
import { assertQuestionReferenceSourceId } from "./question-reference.js";

const SIMPLE_CELL_PATTERN = /^\$?[A-Za-z]{1,3}\$?[1-9][0-9]*$/u;

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

type StructuredWorkbookReferenceSource =
  | { type: "workbook_cell"; sourceId: string; ref: string }
  | { type: "workbook_range"; sourceId: string; ref: string };

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
    throw new InvalidQuestionFieldError(
      "workbook reference key range cells must be valid A1 references",
    );
  }
  const normalizedRange = {
    end: {
      column: Math.max(startCellPosition.column, endCellPosition.column),
      row: Math.max(startCellPosition.row, endCellPosition.row),
    },
    start: {
      column: Math.min(startCellPosition.column, endCellPosition.column),
      row: Math.min(startCellPosition.row, endCellPosition.row),
    },
  };

  return `workbook:${sourceId}:range:${encodeURIComponent(sheetName)}:${formatCellPosition(normalizedRange.start)}:${formatCellPosition(normalizedRange.end)}`;
}

export function parseWorkbookReferenceKey(
  key: string,
): ParseWorkbookReferenceKeyResult {
  if (!key.startsWith("workbook:")) {
    return {
      reason: "Workbook reference key must start with workbook:.",
      status: "invalid",
    };
  }

  const segments = key.split(":");
  if (segments.length !== 5 && segments.length !== 6) {
    return {
      reason: "Workbook reference key has invalid shape.",
      status: "invalid",
    };
  }

  const [, sourceId, kind, encodedSheetName, startCell, endCell] = segments;
  const sourceIdResult = validateSourceId(sourceId ?? "");
  if (sourceIdResult.status === "invalid") {
    return sourceIdResult;
  }

  const sheetNameResult = decodeSheetName(encodedSheetName ?? "");
  if (sheetNameResult.status === "invalid") {
    return sheetNameResult;
  }

  const normalizedStartCellResult = validateCell(startCell ?? "", "start cell");
  if (normalizedStartCellResult.status === "invalid") {
    return normalizedStartCellResult;
  }

  if (kind === "cell") {
    if (segments.length !== 5) {
      return {
        reason: "Workbook cell reference key has invalid shape.",
        status: "invalid",
      };
    }

    return {
      parts: {
        cell: normalizedStartCellResult.cell,
        kind: "cell",
        sheetName: sheetNameResult.sheetName,
        sourceId: sourceIdResult.sourceId,
      },
      status: "parsed",
    };
  }

  if (kind === "range") {
    if (segments.length !== 6) {
      return {
        reason: "Workbook range reference key has invalid shape.",
        status: "invalid",
      };
    }

    const normalizedEndCellResult = validateCell(endCell ?? "", "end cell");
    if (normalizedEndCellResult.status === "invalid") {
      return normalizedEndCellResult;
    }

    return {
      parts: {
        endCell: normalizedEndCellResult.cell,
        kind: "range",
        sheetName: sheetNameResult.sheetName,
        sourceId: sourceIdResult.sourceId,
        startCell: normalizedStartCellResult.cell,
      },
      status: "parsed",
    };
  }

  return {
    reason: "Workbook reference key kind must be cell or range.",
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

export function getWorkbookReferenceKeyForStructuredSource(input: {
  source: StructuredWorkbookReferenceSource;
}): string {
  const parsed = parseStructuredWorkbookReference(input.source);

  return parsed.kind === "cell"
    ? formatWorkbookReferenceKey({
        cell: parsed.startCell,
        kind: "cell",
        sheetName: parsed.sheetName,
        sourceId: input.source.sourceId,
      })
    : formatWorkbookReferenceKey({
        endCell: parsed.endCell,
        kind: "range",
        sheetName: parsed.sheetName,
        sourceId: input.source.sourceId,
        startCell: parsed.startCell,
      });
}

export function assertReferenceIdMatchesStructuredSource(input: {
  referenceId: string;
  source: StructuredWorkbookReferenceSource;
}): void {
  const expectedReferenceId = getWorkbookReferenceKeyForStructuredSource({
    source: input.source,
  });
  if (input.referenceId !== expectedReferenceId) {
    throw new InvalidQuestionFieldError(
      `workbook reference id must match structured source; expected ${expectedReferenceId}`,
    );
  }
}

export type ParsedStructuredWorkbookReference =
  | { kind: "cell"; sheetName: string; startCell: string }
  | { kind: "range"; sheetName: string; startCell: string; endCell: string };

export type ParseStructuredWorkbookReferenceResult =
  | { status: "parsed"; parts: ParsedStructuredWorkbookReference }
  | { status: "invalid"; reason: string };

export function parseQuestionReferenceSourceWorkbookRef(
  source: StructuredWorkbookReferenceSource,
): ParseStructuredWorkbookReferenceResult {
  try {
    return {
      parts: parseStructuredWorkbookReference(source),
      status: "parsed",
    };
  } catch (error) {
    return {
      reason:
        error instanceof Error
          ? error.message
          : "workbook reference source is invalid",
      status: "invalid",
    };
  }
}

function parseStructuredWorkbookReference(
  source: StructuredWorkbookReferenceSource,
): ParsedStructuredWorkbookReference {
  const split = splitWorkbookRef(source.ref);
  if (!split) {
    throw new InvalidQuestionFieldError(
      "workbook reference ref must be a sheet-qualified cell or range reference",
    );
  }

  const range = parseWorkbookRange(split.range);
  if (!range) {
    throw new InvalidQuestionFieldError(
      "workbook reference ref must be a valid A1 cell or range reference",
    );
  }

  if (source.type === "workbook_cell" && range.endCell !== null) {
    throw new InvalidQuestionFieldError(
      "workbook_cell ref must not be a range",
    );
  }
  if (source.type === "workbook_range" && range.endCell === null) {
    throw new InvalidQuestionFieldError("workbook_range ref must be a range");
  }

  return range.endCell === null
    ? {
        kind: "cell",
        sheetName: split.sheetName,
        startCell: range.startCell,
      }
    : {
        endCell: range.endCell,
        kind: "range",
        sheetName: split.sheetName,
        startCell: range.startCell,
      };
}

function splitWorkbookRef(
  ref: string,
): { sheetName: string; range: string } | null {
  if (!ref) {
    return null;
  }

  if (!ref.startsWith("'")) {
    const separatorIndex = ref.indexOf("!");
    if (
      separatorIndex <= 0 ||
      separatorIndex === ref.length - 1 ||
      ref.indexOf("!", separatorIndex + 1) >= 0
    ) {
      return null;
    }

    return {
      range: ref.slice(separatorIndex + 1),
      sheetName: ref.slice(0, separatorIndex),
    };
  }

  let index = 1;
  let sheetName = "";
  while (index < ref.length) {
    const char = ref[index];
    if (char === "'") {
      if (ref[index + 1] === "'") {
        sheetName += "'";
        index += 2;
        continue;
      }
      if (ref[index + 1] !== "!") {
        return null;
      }

      const range = ref.slice(index + 2);
      return range.length > 0 ? { range, sheetName } : null;
    }

    sheetName += char;
    index += 1;
  }

  return null;
}

function parseWorkbookRange(
  range: string,
): { startCell: string; endCell: string | null } | null {
  const cells = range.split(":");
  if (cells.length === 0 || cells.length > 2) {
    return null;
  }
  const [startCellRaw, endCellRaw] = cells;
  if (!startCellRaw) {
    return null;
  }

  const startCellPosition = parseCellPosition(startCellRaw);
  if (!startCellPosition) {
    return null;
  }

  if (!endCellRaw) {
    return {
      endCell: null,
      startCell: formatCellPosition(startCellPosition),
    };
  }

  const endCellPosition = parseCellPosition(endCellRaw);
  if (!endCellPosition) {
    return null;
  }

  const normalizedStartCellPosition = {
    column: Math.min(startCellPosition.column, endCellPosition.column),
    row: Math.min(startCellPosition.row, endCellPosition.row),
  };
  const normalizedEndCellPosition = {
    column: Math.max(startCellPosition.column, endCellPosition.column),
    row: Math.max(startCellPosition.row, endCellPosition.row),
  };

  return {
    endCell: formatCellPosition(normalizedEndCellPosition),
    startCell: formatCellPosition(normalizedStartCellPosition),
  };
}

function normalizeCellAddress(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeSourceId(sourceId: string): string {
  assertQuestionReferenceSourceId(sourceId, "sourceId", failField);
  return sourceId;
}

function normalizeSheetName(sheetName: string): string {
  const normalized = sheetName.trim();
  if (normalized.length === 0) {
    throw new InvalidQuestionFieldError("sheetName must be a non-empty string");
  }
  return normalized;
}

function validateSourceId(
  sourceId: string,
):
  | { status: "parsed"; sourceId: string }
  | { status: "invalid"; reason: string } {
  try {
    return {
      sourceId: normalizeSourceId(sourceId),
      status: "parsed",
    };
  } catch (error) {
    return {
      reason:
        error instanceof Error
          ? error.message
          : "Reference key has invalid source id.",
      status: "invalid",
    };
  }
}

function decodeSheetName(
  encodedSheetName: string,
):
  | { status: "parsed"; sheetName: string }
  | { status: "invalid"; reason: string } {
  let decodedSheetName = "";
  try {
    decodedSheetName = decodeURIComponent(encodedSheetName);
  } catch {
    return {
      reason: "Workbook reference key sheet name encoding is invalid.",
      status: "invalid",
    };
  }

  const sheetName = decodedSheetName.trim();
  if (sheetName.length === 0) {
    return {
      reason: "Workbook reference key is missing sheet name.",
      status: "invalid",
    };
  }

  return { sheetName, status: "parsed" };
}

function validateCell(
  cell: string,
  label: "start cell" | "end cell",
): { status: "parsed"; cell: string } | { status: "invalid"; reason: string } {
  const parsedCell = parseCellPosition(cell);
  if (!parsedCell) {
    return {
      reason: `Workbook reference key has invalid ${label}.`,
      status: "invalid",
    };
  }

  return { cell: formatCellPosition(parsedCell), status: "parsed" };
}

function failField(message: string): never {
  throw new InvalidQuestionFieldError(message);
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
    column: columnLabelToIndex(match[1]?.replace(/\$/gu, "") ?? ""),
    row: Number(match[2]?.replace(/\$/gu, "") ?? ""),
  };
}

function formatCellPosition(input: { column: number; row: number }): string {
  return `${columnIndexToLabel(input.column)}${input.row}`;
}

function columnLabelToIndex(label: string): number {
  let value = 0;
  for (const char of label) {
    value = value * 26 + char.charCodeAt(0) - 64;
  }
  return value - 1;
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
