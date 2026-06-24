import type { Brand } from "@lemma/domain";
import { assertUuid } from "./primitives.js";

export type QuestionSetId = Brand<string, "QuestionSetId">;
export type QuestionBlueprintId = Brand<string, "QuestionBlueprintId">;
export type QuestionId = Brand<string, "QuestionId">;
export type QuestionGenerationRunId = Brand<string, "QuestionGenerationRunId">;
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
