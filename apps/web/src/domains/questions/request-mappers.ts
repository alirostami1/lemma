import type {
  CreateQuestionBlueprintRequest,
  CreateQuestionGenerationRunRequest,
  UpdateQuestionBlueprintRequest,
} from "#/api/generated/model";
import type {
  CreateQuestionBlueprintInput,
  CreateQuestionGenerationRunInput,
  UpdateQuestionBlueprintInput,
} from "./model";
import { toQuestionBlueprintSources } from "./source-model";

export function toCreateQuestionBlueprintRequest(
  input: CreateQuestionBlueprintInput,
): CreateQuestionBlueprintRequest {
  return {
    description: input.description,
    document: input.document,
    name: input.name,
    sources: toQuestionBlueprintSources(input.sources),
    visibility: input.visibility,
  };
}

export function toUpdateQuestionBlueprintRequest(
  input: UpdateQuestionBlueprintInput,
): UpdateQuestionBlueprintRequest {
  return {
    description: input.description,
    document: input.document,
    name: input.name,
    sources: input.sources
      ? toQuestionBlueprintSources(input.sources)
      : undefined,
    status: input.status,
    visibility: input.visibility,
  };
}

export function toCreateQuestionGenerationRunRequest(
  input: CreateQuestionGenerationRunInput,
): CreateQuestionGenerationRunRequest {
  return {
    blueprintId: input.blueprintId,
    count: input.count,
    targetQuestionSetId: input.targetQuestionSetId,
  };
}
