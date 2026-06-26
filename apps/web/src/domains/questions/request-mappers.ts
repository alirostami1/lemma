import type { CreateQuestionGenerationRunRequest } from "#/api/generated/model";
import type { CreateQuestionGenerationRunInput } from "./model";

export function toCreateQuestionGenerationRunRequest(
  input: CreateQuestionGenerationRunInput,
): CreateQuestionGenerationRunRequest {
  return {
    blueprintId: input.blueprintId,
    count: input.count,
    targetQuestionSetId: input.targetQuestionSetId,
  };
}
