import { InvalidWorkbookFieldError } from "../domain/index.js";

export type WorkbookCalculationSource = {
  sourceId: string;
  workbookId: string;
};

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
    if (typeof record.sourceId !== "string" || record.sourceId.length === 0) {
      throw new InvalidWorkbookFieldError(
        `${fieldName}[${index}].sourceId must be a non-empty string.`,
      );
    }
    if (sourceIds.has(record.sourceId)) {
      throw new InvalidWorkbookFieldError(
        `${fieldName} sourceIds must be unique.`,
      );
    }
    sourceIds.add(record.sourceId);

    if (typeof record.workbookId !== "string" || record.workbookId.length === 0) {
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
