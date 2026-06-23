import type { Brand, JsonValue } from "@lemma/domain";
import {
  InvalidWorkbookFieldError,
  InvalidWorkbookInspectionError,
  InvalidWorkbookSparseValuesError,
} from "./errors.js";
import {
  assertJsonValue,
  assertMaxLength,
  assertNonEmptyString,
  oneOf,
} from "./primitives.js";

export const MAX_WORKBOOK_NAME_LENGTH = 160;
export const MAX_WORKBOOK_CALCULATION_COUNT = 1000;
export const WORKBOOK_XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const WORKBOOK_STATUS_ACCEPTED_VALUES = [
  "pending_validation",
  "valid",
  "invalid",
  "archived",
  "deleted",
] as const;

export const WORKBOOK_CALCULATION_STATUS_ACCEPTED_VALUES = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
] as const;

export const WORKBOOK_ENGINE_ACCEPTED_VALUES = [
  "cached",
  "libreoffice",
] as const;

export type WorkbookName = Brand<string, "WorkbookName">;
export type WorkbookStatus = (typeof WORKBOOK_STATUS_ACCEPTED_VALUES)[number];
export type WorkbookCalculationStatus =
  (typeof WORKBOOK_CALCULATION_STATUS_ACCEPTED_VALUES)[number];
export type WorkbookEngineName =
  (typeof WORKBOOK_ENGINE_ACCEPTED_VALUES)[number];

export type WorkbookInspection = {
  sheetCount: number;
  cellCount: number;
  formulaCount: number;
  forbiddenFeatureFindings: string[];
  libreOfficeVersion: string | null;
};

export type WorkbookSparseSheet = {
  name: string;
  cells: Record<string, string>;
  cellTypes?: Record<string, WorkbookCellType>;
  rowCount: number;
  columnCount: number;
};

export type WorkbookCellType =
  | "string"
  | "number"
  | "boolean"
  | "date_like"
  | "error"
  | "blank"
  | "formula_cached";

export type WorkbookSparseValues = {
  sheets: WorkbookSparseSheet[];
};

export type WorkbookEngineHealth = {
  ok: boolean;
  engine: WorkbookEngineName;
  version: string | null;
};

export type WorkbookSnapshotValue = JsonValue;
export type ValueSource =
  | { type: "cell"; ref: string }
  | { type: "range"; ref: string }
  | { type: "literal"; value: JsonValue };

const A1_CELL_ADDRESS_PATTERN = /^\$?[A-Z]+\$?[1-9][0-9]*$/i;
export const WORKBOOK_CELL_TYPE_ACCEPTED_VALUES = [
  "string",
  "number",
  "boolean",
  "date_like",
  "error",
  "blank",
  "formula_cached",
] as const;

export function workbookName(value: string): WorkbookName {
  return assertMaxLength(
    assertNonEmptyString(value, "name"),
    MAX_WORKBOOK_NAME_LENGTH,
    "name",
  ) as WorkbookName;
}

export function workbookStatus(value: string): WorkbookStatus {
  return oneOf(value, WORKBOOK_STATUS_ACCEPTED_VALUES, "workbook status");
}

export function workbookCalculationStatus(
  value: string,
): WorkbookCalculationStatus {
  return oneOf(
    value,
    WORKBOOK_CALCULATION_STATUS_ACCEPTED_VALUES,
    "workbook calculation status",
  );
}

export function workbookEngineName(value: string): WorkbookEngineName {
  return oneOf(value, WORKBOOK_ENGINE_ACCEPTED_VALUES, "workbook engine");
}

export function workbookInspection(value: unknown): WorkbookInspection {
  const json = assertJsonValue(value, "inspection");
  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    throw new InvalidWorkbookInspectionError("inspection must be an object.");
  }
  const inspection = json as Record<string, JsonValue | undefined>;
  const sheetCount = inspection.sheetCount;
  const cellCount = inspection.cellCount;
  const formulaCount = inspection.formulaCount;
  const forbiddenFeatureFindings = inspection.forbiddenFeatureFindings;
  const libreOfficeVersion = inspection.libreOfficeVersion;
  if (
    !isNonNegativeInteger(sheetCount) ||
    !isNonNegativeInteger(cellCount) ||
    !isNonNegativeInteger(formulaCount) ||
    !isStringArray(forbiddenFeatureFindings) ||
    !(libreOfficeVersion === null || typeof libreOfficeVersion === "string")
  ) {
    throw new InvalidWorkbookInspectionError("inspection has invalid shape.");
  }
  return {
    cellCount,
    forbiddenFeatureFindings,
    formulaCount,
    libreOfficeVersion,
    sheetCount,
  };
}

function isNonNegativeInteger(value: JsonValue | undefined): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isStringArray(value: JsonValue | undefined): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

export function requestedCalculationCount(value: number): number {
  if (
    !Number.isInteger(value) ||
    value <= 0 ||
    value > MAX_WORKBOOK_CALCULATION_COUNT
  ) {
    throw new InvalidWorkbookFieldError(
      `requestedCount must be > 0 and <= ${MAX_WORKBOOK_CALCULATION_COUNT}.`,
    );
  }
  return value;
}

export function workbookSparseValues(value: unknown): WorkbookSparseValues {
  const json = assertJsonValue(value, "values");
  if (!isPlainObject(json)) {
    throw new InvalidWorkbookSparseValuesError("values must be an object.");
  }
  const values = json as Record<string, JsonValue | undefined>;
  if (!Array.isArray(values.sheets)) {
    throw new InvalidWorkbookSparseValuesError(
      "values.sheets must be an array.",
    );
  }
  return {
    sheets: values.sheets.map((sheet, index) => {
      if (!isPlainObject(sheet)) {
        throw new InvalidWorkbookSparseValuesError(
          `values.sheets[${index}] must be an object.`,
        );
      }
      const sparseSheet = sheet as Record<string, JsonValue | undefined>;
      if (
        typeof sparseSheet.name !== "string" ||
        sparseSheet.name.trim().length === 0
      ) {
        throw new InvalidWorkbookSparseValuesError(
          `values.sheets[${index}].name must be non-empty.`,
        );
      }
      if (!isPlainObject(sparseSheet.cells)) {
        throw new InvalidWorkbookSparseValuesError(
          `values.sheets[${index}].cells must be an object.`,
        );
      }
      if (!isNonNegativeInteger(sparseSheet.rowCount)) {
        throw new InvalidWorkbookSparseValuesError(
          `values.sheets[${index}].rowCount must be a non-negative integer.`,
        );
      }
      if (!isNonNegativeInteger(sparseSheet.columnCount)) {
        throw new InvalidWorkbookSparseValuesError(
          `values.sheets[${index}].columnCount must be a non-negative integer.`,
        );
      }
      const cells = Object.fromEntries(
        Object.entries(sparseSheet.cells).map(([address, cellValue]) => {
          if (!A1_CELL_ADDRESS_PATTERN.test(address)) {
            throw new InvalidWorkbookSparseValuesError(
              `values.sheets[${index}].cells has invalid cell address.`,
            );
          }
          if (typeof cellValue !== "string") {
            throw new InvalidWorkbookSparseValuesError(
              `values.sheets[${index}].cells values must be strings.`,
            );
          }
          return [address.toUpperCase().replaceAll("$", ""), cellValue];
        }),
      );
      const cellTypes = sparseSheet.cellTypes
        ? parseCellTypes(sparseSheet.cellTypes, index)
        : undefined;
      return {
        cells,
        name: sparseSheet.name,
        ...(cellTypes ? { cellTypes } : {}),
        columnCount: sparseSheet.columnCount,
        rowCount: sparseSheet.rowCount,
      };
    }),
  };
}

function isPlainObject(
  value: unknown,
): value is Record<string, JsonValue | undefined> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function parseCellTypes(
  value: JsonValue,
  sheetIndex: number,
): Record<string, WorkbookCellType> {
  if (!isPlainObject(value)) {
    throw new InvalidWorkbookSparseValuesError(
      `values.sheets[${sheetIndex}].cellTypes must be an object.`,
    );
  }
  return Object.fromEntries(
    Object.entries(value).map(([address, cellType]) => {
      if (!A1_CELL_ADDRESS_PATTERN.test(address)) {
        throw new InvalidWorkbookSparseValuesError(
          `values.sheets[${sheetIndex}].cellTypes has invalid cell address.`,
        );
      }
      if (
        typeof cellType !== "string" ||
        !WORKBOOK_CELL_TYPE_ACCEPTED_VALUES.includes(
          cellType as WorkbookCellType,
        )
      ) {
        throw new InvalidWorkbookSparseValuesError(
          `values.sheets[${sheetIndex}].cellTypes has invalid cell type.`,
        );
      }
      return [
        address.toUpperCase().replaceAll("$", ""),
        cellType as WorkbookCellType,
      ];
    }),
  );
}
