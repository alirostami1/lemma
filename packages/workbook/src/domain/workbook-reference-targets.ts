import type { JsonValue } from "@lemma/domain";
import { InvalidWorkbookFieldError } from "./errors.js";
import type { WorkbookSparseValues } from "./workbook-values.js";

const CELL_ADDRESS_PATTERN = /^\$?[A-Z]{1,3}\$?[1-9][0-9]*$/iu;

export type WorkbookReferenceTargets = {
  schemaVersion: 1;
  sheets: readonly WorkbookReferenceTargetSheet[];
};

export type WorkbookReferenceTargetSheet = {
  name: string;
  dimensions: {
    rowCount: number;
    columnCount: number;
  };
  /**
   * V1 referenceable value/output cells. Sparse cached workbook values omit
   * blanks, so callers must not treat this as the complete sheet grid.
   */
  valueCells?: readonly string[];
};

export type WorkbookReferenceTargetAvailability =
  | { status: "available"; targets: WorkbookReferenceTargets }
  | {
      status: "unavailable";
      reason:
        | "pending_validation"
        | "invalid_workbook"
        | "inspection_unavailable";
    };

export type WorkbookSourceFileInspection = {
  schemaVersion: 1;
  byteSize: number;
  checksumSha256: string;
  contentType: string;
  fileId: string;
  referenceTargets: WorkbookReferenceTargets | null;
  referenceTargetAvailability: WorkbookReferenceTargetAvailability;
  validation:
    | { status: "valid" }
    | { status: "pending_validation" }
    | { status: "invalid"; validationError: string };
};

export function workbookSourceFileInspection(input: {
  byteSize: number;
  checksumSha256: string;
  contentType: string;
  fileId: string;
  referenceTargetAvailability: WorkbookReferenceTargetAvailability;
  validation?: WorkbookSourceFileInspection["validation"];
}): WorkbookSourceFileInspection {
  const referenceTargetAvailability = workbookReferenceTargetAvailability(
    input.referenceTargetAvailability,
  );
  const validation =
    input.validation ?? validationForAvailability(referenceTargetAvailability);
  return {
    byteSize: positiveInteger(input.byteSize, "inspection byteSize"),
    checksumSha256: checksumSha256Value(input.checksumSha256),
    contentType: nonEmptyString(input.contentType, "inspection contentType"),
    fileId: nonEmptyString(input.fileId, "inspection fileId"),
    referenceTargetAvailability,
    referenceTargets:
      referenceTargetAvailability.status === "available"
        ? referenceTargetAvailability.targets
        : null,
    schemaVersion: 1,
    validation,
  };
}

export function workbookReferenceTargets(
  input: WorkbookReferenceTargets,
): WorkbookReferenceTargets {
  return normalizeWorkbookReferenceTargets(input);
}

export function workbookReferenceTargetsFromSparseValues(
  values: WorkbookSparseValues,
): WorkbookReferenceTargets {
  return normalizeWorkbookReferenceTargets({
    schemaVersion: 1,
    sheets: values.sheets.map((sheet) => ({
      dimensions: {
        columnCount: Math.max(sheet.columnCount, 1),
        rowCount: Math.max(sheet.rowCount, 1),
      },
      name: sheet.name,
      valueCells: Object.keys(sheet.cells),
    })),
  });
}

export function workbookReferenceTargetAvailability(
  input: unknown,
): WorkbookReferenceTargetAvailability {
  if (!isPlainObject(input)) {
    throw new InvalidWorkbookFieldError(
      "workbook reference target availability is invalid.",
    );
  }
  if (input.status === "available") {
    return {
      status: "available",
      targets: workbookReferenceTargetsFromJson(input.targets),
    };
  }
  if (
    input.status === "unavailable" &&
    (input.reason === "pending_validation" ||
      input.reason === "invalid_workbook" ||
      input.reason === "inspection_unavailable")
  ) {
    return {
      reason: input.reason,
      status: "unavailable",
    };
  }
  throw new InvalidWorkbookFieldError(
    "workbook reference target availability is invalid.",
  );
}

export function workbookReferenceTargetsFromJson(
  input: unknown,
): WorkbookReferenceTargets {
  if (!isPlainObject(input) || input.schemaVersion !== 1) {
    throw new InvalidWorkbookFieldError(
      "workbook reference targets must use schema version 1.",
    );
  }
  if (!Array.isArray(input.sheets)) {
    throw new InvalidWorkbookFieldError(
      "workbook reference targets sheets must be an array.",
    );
  }
  return workbookReferenceTargets({
    schemaVersion: 1,
    sheets: input.sheets.map((sheet) => {
      if (!isPlainObject(sheet)) {
        throw new InvalidWorkbookFieldError(
          "workbook reference target sheet must be an object.",
        );
      }
      return {
        dimensions: dimensionsValue(sheet.dimensions),
        name: stringValue(sheet.name, "sheet name"),
        ...(sheet.valueCells === undefined
          ? {}
          : {
              valueCells: stringArray(sheet.valueCells, "sheet valueCells"),
            }),
      };
    }),
  });
}

function normalizeWorkbookReferenceTargets(
  input: WorkbookReferenceTargets,
): WorkbookReferenceTargets {
  if (input.schemaVersion !== 1) {
    throw new InvalidWorkbookFieldError(
      "workbook reference targets must use schema version 1.",
    );
  }
  const sheetNames = new Set<string>();
  return {
    schemaVersion: 1,
    sheets: input.sheets.map((sheet) => {
      const name = normalizeSheetName(sheet.name);
      const normalizedName = name.toLowerCase();
      if (sheetNames.has(normalizedName)) {
        throw new InvalidWorkbookFieldError(
          "workbook reference targets must not contain duplicate sheet names.",
        );
      }
      sheetNames.add(normalizedName);

      const valueCells =
        sheet.valueCells === undefined
          ? undefined
          : normalizeCellAddresses(sheet.valueCells);
      return {
        dimensions: {
          columnCount: Math.max(
            positiveInteger(sheet.dimensions.columnCount, "sheet columnCount"),
            1,
          ),
          rowCount: Math.max(
            positiveInteger(sheet.dimensions.rowCount, "sheet rowCount"),
            1,
          ),
        },
        name,
        ...(valueCells === undefined ? {} : { valueCells }),
      };
    }),
  };
}

function validationForAvailability(
  availability: WorkbookReferenceTargetAvailability,
): WorkbookSourceFileInspection["validation"] {
  if (availability.status === "available") {
    return { status: "valid" };
  }
  if (availability.reason === "invalid_workbook") {
    return {
      status: "invalid",
      validationError: "Workbook could not be read.",
    };
  }
  return { status: "pending_validation" };
}

function normalizeSheetName(value: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new InvalidWorkbookFieldError("sheet name must be non-empty.");
  }
  return normalized;
}

function normalizeCellAddresses(cells: readonly string[]): readonly string[] {
  const normalized = new Set<string>();
  for (const cell of cells) {
    const address = normalizeCellAddress(cell);
    normalized.add(address);
  }
  return [...normalized].sort(compareCellAddresses);
}

function normalizeCellAddress(value: string): string {
  const normalized = value.replace(/\$/gu, "").trim().toUpperCase();
  if (!CELL_ADDRESS_PATTERN.test(normalized)) {
    throw new InvalidWorkbookFieldError(
      "workbook reference target cell address is invalid.",
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
    throw new InvalidWorkbookFieldError(
      "workbook reference target cell address is invalid.",
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

function isPlainObject(value: unknown): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new InvalidWorkbookFieldError(`${label} must be a string.`);
  }
  return value;
}

function nonEmptyString(value: unknown, label: string): string {
  const string = stringValue(value, label).trim();
  if (string.length === 0) {
    throw new InvalidWorkbookFieldError(`${label} must be non-empty.`);
  }
  return string;
}

function checksumSha256Value(value: unknown): string {
  const string = stringValue(value, "inspection checksumSha256").trim();
  if (!/^[a-f0-9]{64}$/u.test(string)) {
    throw new InvalidWorkbookFieldError(
      "inspection checksumSha256 must be a lowercase sha256 hex digest.",
    );
  }
  return string;
}

function stringArray(value: unknown, label: string): string[] {
  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === "string")
  ) {
    throw new InvalidWorkbookFieldError(`${label} must be a string array.`);
  }
  return value;
}

function dimensionsValue(value: unknown): {
  rowCount: number;
  columnCount: number;
} {
  if (!isPlainObject(value)) {
    throw new InvalidWorkbookFieldError(
      "workbook reference target sheet dimensions must be an object.",
    );
  }
  return {
    columnCount: positiveInteger(value.columnCount, "sheet columnCount"),
    rowCount: positiveInteger(value.rowCount, "sheet rowCount"),
  };
}

function positiveInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || typeof value !== "number" || value < 1) {
    throw new InvalidWorkbookFieldError(`${label} must be a positive integer.`);
  }
  return value;
}
