import type { QuestionAnswer } from "#/api/generated/model";
import type { TableAnswerState, TableAnswerValue } from "./authoring";
import type { CreateQuestionGenerationRunInput } from "./model";

export function createEmptyQuestionAnswer(): QuestionAnswer {
  return {
    responses: [],
    schemaVersion: 1,
  };
}

export function tableAnswerStateToQuestionAnswer(
  answer: TableAnswerState,
): QuestionAnswer {
  return {
    responses: Object.entries(answer).map(([responseFieldId, value]) => ({
      responseFieldId,
      value,
    })),
    schemaVersion: 1,
  };
}

export function questionAnswerToTableAnswerState(
  answer: QuestionAnswer,
): TableAnswerState {
  return Object.fromEntries(
    answer.responses.map((response) => [
      response.responseFieldId,
      toTableAnswerValue(response.value),
    ]),
  );
}

export type QuestionGenerationDraft = {
  targetQuestionSetId: string;
  count: number;
  blueprintId: string;
};

export function toCreateQuestionGenerationRunInput(
  draft: QuestionGenerationDraft,
): CreateQuestionGenerationRunInput {
  return {
    blueprintId: draft.blueprintId,
    count: draft.count,
    targetQuestionSetId: draft.targetQuestionSetId,
  };
}

function toTableAnswerValue(value: unknown): TableAnswerValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(toTableAnswerValue);
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        toTableAnswerValue(nested),
      ]),
    );
  }
  return null;
}
