import { InvalidQuestionFieldError } from "./errors.js";

const CELL_ADDRESS_PATTERN = /^\$?[A-Z]{1,3}\$?[1-9][0-9]*$/iu;

export type QuestionWorkbookReferenceTargets = {
  schemaVersion: 1;
  sheets: readonly QuestionWorkbookReferenceTargetSheet[];
};

export type QuestionWorkbookReferenceTargetSheet = {
  name: string;
  dimensions: {
    rowCount: number;
    columnCount: number;
  };
  valueCells?: readonly string[];
};

export type QuestionWorkbookReferenceTargetAvailability =
  | {
      status: "available";
      targets: QuestionWorkbookReferenceTargets;
    }
  | {
      status: "unavailable";
      reason:
        | "inspection_unavailable"
        | "pending_validation"
        | "invalid_workbook";
    };

export type QuestionWorkbookSourceFileInspection = {
  schemaVersion: 1;
  fileId: string;
  byteSize: number;
  checksumSha256: string;
  contentType: string;
  validation:
    | { status: "valid" }
    | { status: "pending_validation" }
    | { status: "invalid"; validationError: string };
  referenceTargetAvailability: QuestionWorkbookReferenceTargetAvailability;
  referenceTargets: QuestionWorkbookReferenceTargets | null;
};

export function questionWorkbookReferenceTargetsFromJson(
  input: unknown,
): QuestionWorkbookReferenceTargets {
  if (!isPlainObject(input) || input.schemaVersion !== 1) {
    throw new InvalidQuestionFieldError(
      "workbook reference targets are invalid.",
    );
  }
  if (!Array.isArray(input.sheets)) {
    throw new InvalidQuestionFieldError(
      "workbook reference targets sheets are invalid.",
    );
  }
  const sheetNames = new Set<string>();
  return {
    schemaVersion: 1,
    sheets: input.sheets.map((sheet) =>
      questionWorkbookReferenceTargetSheetFromJson(sheet, sheetNames),
    ),
  };
}

function questionWorkbookReferenceTargetSheetFromJson(
  input: unknown,
  sheetNames: Set<string>,
): QuestionWorkbookReferenceTargetSheet {
  if (!isPlainObject(input) || typeof input.name !== "string") {
    throw new InvalidQuestionFieldError(
      "workbook reference target sheet is invalid.",
    );
  }
  const name = input.name.trim();
  if (name.length === 0) {
    throw new InvalidQuestionFieldError(
      "workbook reference target sheet name is invalid.",
    );
  }
  const normalizedName = name.toLowerCase();
  if (sheetNames.has(normalizedName)) {
    throw new InvalidQuestionFieldError(
      "workbook reference targets must not contain duplicate sheet names.",
    );
  }
  sheetNames.add(normalizedName);

  const dimensions = input.dimensions;
  if (
    !isPlainObject(dimensions) ||
    !isPositiveInteger(dimensions.rowCount) ||
    !isPositiveInteger(dimensions.columnCount)
  ) {
    throw new InvalidQuestionFieldError(
      "workbook reference target sheet dimensions are invalid.",
    );
  }
  if (input.valueCells !== undefined && !Array.isArray(input.valueCells)) {
    throw new InvalidQuestionFieldError(
      "workbook reference target value cells are invalid.",
    );
  }
  return {
    dimensions: {
      columnCount: dimensions.columnCount,
      rowCount: dimensions.rowCount,
    },
    name,
    ...(input.valueCells === undefined
      ? {}
      : { valueCells: normalizeCellAddresses(input.valueCells) }),
  };
}

function normalizeCellAddresses(cells: readonly unknown[]): string[] {
  const normalized = new Set<string>();
  for (const cell of cells) {
    if (typeof cell !== "string") {
      throw new InvalidQuestionFieldError(
        "workbook reference target value cells are invalid.",
      );
    }
    normalized.add(normalizeCellAddress(cell));
  }
  return [...normalized].sort(compareCellAddresses);
}

function normalizeCellAddress(value: string): string {
  const normalized = value.replace(/\$/gu, "").trim().toUpperCase();
  if (!CELL_ADDRESS_PATTERN.test(normalized)) {
    throw new InvalidQuestionFieldError(
      "workbook reference target value cell is invalid.",
    );
  }
  return normalized;
}

function compareCellAddresses(left: string, right: string): number {
  const leftPosition = cellPosition(left);
  const rightPosition = cellPosition(right);
  return (
    leftPosition.row - rightPosition.row ||
    leftPosition.column - rightPosition.column
  );
}

function cellPosition(cell: string): { row: number; column: number } {
  const match = cell.match(/^([A-Z]{1,3})([1-9][0-9]*)$/u);
  if (!match) {
    throw new InvalidQuestionFieldError(
      "workbook reference target value cell is invalid.",
    );
  }
  return {
    column: [...(match[1] ?? "")].reduce(
      (total, char) => total * 26 + char.charCodeAt(0) - 64,
      0,
    ),
    row: Number(match[2] ?? "0"),
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}
