import type {
  CreateQuestionBlueprintRequest,
  CreateQuestionGenerationRunRequest,
  UpdateQuestionBlueprintRequest,
} from "#/api/generated/model";
import { CreateWorkbookSourceType } from "#/api/generated/model";
import type {
  CreateQuestionBlueprintInput,
  CreateQuestionGenerationRunInput,
  UpdateQuestionBlueprintInput,
} from "./model";

export function toCreateQuestionBlueprintRequest(
  input: CreateQuestionBlueprintInput,
): CreateQuestionBlueprintRequest {
  return {
    name: input.name,
    description: input.description,
    visibility: input.visibility,
    document: input.document,
    workbookId: input.workbookId,
    workbookSources: input.workbookSources,
  };
}

export function toUpdateQuestionBlueprintRequest(
  input: UpdateQuestionBlueprintInput,
): UpdateQuestionBlueprintRequest {
  return {
    name: input.name,
    description: input.description,
    visibility: input.visibility,
    document: input.document,
    workbookId: input.workbookId,
    workbookSources: input.workbookSources,
    status: input.status,
  };
}

export function toCreateQuestionGenerationRunRequest(
  input: CreateQuestionGenerationRunInput,
): CreateQuestionGenerationRunRequest {
  return {
    count: input.count,
    targetQuestionSetId: input.targetQuestionSetId,
    source: input.source
      ? input.source
      : input.sourceWorkbookId
        ? {
            type: CreateWorkbookSourceType.workbook_snapshot,
            workbookId: input.sourceWorkbookId,
          }
        : null,
    blueprintId: input.blueprintId,
    blueprintVersionId: input.blueprintVersionId,
  };
}
