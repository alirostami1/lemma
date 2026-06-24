import { InvalidWorkbookFieldError } from "../domain/index.js";

export type WorkbookCalculationSource = {
  sourceId: string;
  workbookId: string;
};

const WORKBOOK_CALCULATION_SOURCE_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/u;

export function normalizeWorkbookCalculationSources(
  input: readonly WorkbookCalculationSource[] | null | undefined,
  fieldName: string,
): WorkbookCalculationSource[] {
  if (input === undefined || input === null || !Array.isArray(input)) {
    throw new InvalidWorkbookFieldError(`${fieldName} must be an array.`);
  }
  if (input.length === 0) {
    throw new InvalidWorkbookFieldError(
      `${fieldName} must not be an empty array.`,
    );
  }

  const sourceIds = new Set<string>();
  return input.map((source, index) => {
    if (typeof source !== "object" || source === null) {
      throw new InvalidWorkbookFieldError(
        `${fieldName}[${index}] must be an object.`,
      );
    }

    const record = source as Record<string, unknown>;
    if (
      typeof record.sourceId !== "string" ||
      !WORKBOOK_CALCULATION_SOURCE_ID_PATTERN.test(record.sourceId)
    ) {
      throw new InvalidWorkbookFieldError(
        `${fieldName}[${index}].sourceId must start with a letter and contain only letters, numbers, underscores, or hyphens.`,
      );
    }
    if (sourceIds.has(record.sourceId)) {
      throw new InvalidWorkbookFieldError(
        `${fieldName} sourceIds must be unique.`,
      );
    }
    sourceIds.add(record.sourceId);

    if (
      typeof record.workbookId !== "string" ||
      record.workbookId.length === 0
    ) {
      throw new InvalidWorkbookFieldError(
        `${fieldName}[${index}].workbookId must be a non-empty string.`,
      );
    }

    return {
      sourceId: record.sourceId,
      workbookId: record.workbookId,
    };
  });
}
