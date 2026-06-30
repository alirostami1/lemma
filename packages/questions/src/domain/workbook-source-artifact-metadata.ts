import type { JsonObject } from "@lemma/domain";
import { InvalidQuestionFieldError } from "./errors.js";
import {
  type QuestionWorkbookReferenceTargets,
  type QuestionWorkbookSourceFileInspection,
  questionWorkbookReferenceTargetsFromJson,
} from "./workbook-reference-targets.js";

export type WorkbookSourceArtifactMetadata = {
  originalName: string;
  workbookReferenceTargets?: QuestionWorkbookReferenceTargets;
};

export function workbookSourceArtifactMetadata(input: {
  originalName: string;
  inspection: QuestionWorkbookSourceFileInspection;
}): JsonObject {
  const metadata: JsonObject = {
    originalName: normalizeOriginalName(input.originalName),
  };

  if (input.inspection.referenceTargetAvailability.status === "available") {
    metadata.workbookReferenceTargets = workbookReferenceTargetsToJson(
      input.inspection.referenceTargetAvailability.targets,
    );
  }

  return metadata;
}

export function workbookSourceArtifactMetadataFromJson(
  input: unknown,
): WorkbookSourceArtifactMetadata {
  if (!isPlainObject(input)) {
    throw new InvalidQuestionFieldError(
      "workbook source artifact metadata must be an object.",
    );
  }
  const originalName = normalizeOriginalName(input.originalName);
  if (input.workbookReferenceTargets === undefined) {
    return { originalName };
  }
  return {
    originalName,
    workbookReferenceTargets: questionWorkbookReferenceTargetsFromJson(
      input.workbookReferenceTargets,
    ),
  };
}

function normalizeOriginalName(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new InvalidQuestionFieldError(
      "workbook source artifact originalName must be a non-empty string.",
    );
  }
  return value.trim();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function workbookReferenceTargetsToJson(
  targets: QuestionWorkbookReferenceTargets,
): JsonObject {
  return {
    schemaVersion: targets.schemaVersion,
    sheets: targets.sheets.map((sheet) => ({
      dimensions: {
        columnCount: sheet.dimensions.columnCount,
        rowCount: sheet.dimensions.rowCount,
      },
      name: sheet.name,
      ...(sheet.valueCells === undefined
        ? {}
        : { valueCells: [...sheet.valueCells] }),
    })),
  };
}
