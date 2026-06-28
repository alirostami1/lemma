import type { Brand } from "@lemma/domain";
import { assertUuid } from "./primitives.js";

export type QuestionSetId = Brand<string, "QuestionSetId">;
export type QuestionBlueprintId = Brand<string, "QuestionBlueprintId">;
export type QuestionBlueprintVersionId = Brand<
  string,
  "QuestionBlueprintVersionId"
>;
export type QuestionId = Brand<string, "QuestionId">;
export type QuestionGenerationRunId = Brand<string, "QuestionGenerationRunId">;
export type SourceDocumentId = Brand<string, "SourceDocumentId">;
export type SourceRevisionId = Brand<string, "SourceRevisionId">;
export type SourceArtifactId = Brand<string, "SourceArtifactId">;
export type UserId = Brand<string, "UserId">;
export type WorkbookId = Brand<string, "WorkbookId">;
export type WorkbookCalculationId = Brand<string, "WorkbookCalculationId">;
export type WorkbookSnapshotId = Brand<string, "WorkbookSnapshotId">;

export function questionSetId(value: unknown): QuestionSetId {
  return assertUuid(value, "questionSetId") as QuestionSetId;
}

export function questionBlueprintId(value: unknown): QuestionBlueprintId {
  return assertUuid(value, "questionBlueprintId") as QuestionBlueprintId;
}

export function questionBlueprintVersionId(
  value: unknown,
): QuestionBlueprintVersionId {
  return assertUuid(
    value,
    "questionBlueprintVersionId",
  ) as QuestionBlueprintVersionId;
}

export function questionId(value: unknown): QuestionId {
  return assertUuid(value, "questionId") as QuestionId;
}

export function questionGenerationRunId(
  value: unknown,
): QuestionGenerationRunId {
  return assertUuid(
    value,
    "questionGenerationRunId",
  ) as QuestionGenerationRunId;
}

export function sourceDocumentId(value: unknown): SourceDocumentId {
  return assertUuid(value, "sourceDocumentId") as SourceDocumentId;
}

export function sourceRevisionId(value: unknown): SourceRevisionId {
  return assertUuid(value, "sourceRevisionId") as SourceRevisionId;
}

export function sourceArtifactId(value: unknown): SourceArtifactId {
  return assertUuid(value, "sourceArtifactId") as SourceArtifactId;
}

export function userId(value: unknown): UserId {
  return assertUuid(value, "userId") as UserId;
}

export function workbookId(value: unknown): WorkbookId {
  return assertUuid(value, "workbookId") as WorkbookId;
}

export function workbookCalculationId(value: unknown): WorkbookCalculationId {
  return assertUuid(value, "workbookCalculationId") as WorkbookCalculationId;
}

export function workbookSnapshotId(value: unknown): WorkbookSnapshotId {
  return assertUuid(value, "workbookSnapshotId") as WorkbookSnapshotId;
}
