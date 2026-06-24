import type {
  QuestionAnswer,
  QuestionBlueprintDocument,
} from "#/api/generated/model";
import type { TableAnswerState, TableAnswerValue } from "./authoring";
import type {
  CreateQuestionBlueprintInput,
  CreateQuestionGenerationRunInput,
  QuestionBlueprintVisibility,
  UpdateQuestionBlueprintInput,
} from "./model";

export interface QuestionBlueprintDraft {
  description?: string | null;
  document: QuestionBlueprintDocument;
  name: string;
  questionBlueprintId?: string;
  sources: QuestionBlueprintDraftWorkbookSource[];
  visibility?: QuestionBlueprintVisibility;
}

export interface WorkbookQuestionGenerationSourceDraft {
  workbookId: string;
}

export interface QuestionBlueprintDraftWorkbookSource {
  name: string;
  sourceId: string;
  workbookId: string;
}

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

export function toCreateQuestionBlueprintInput(
  draft: QuestionBlueprintDraft,
): CreateQuestionBlueprintInput {
  return {
    description: draft.description,
    document: draft.document,
    name: draft.name,
    sources: draft.sources,
    visibility: draft.visibility,
  };
}

export function toUpdateQuestionBlueprintInput(
  draft: QuestionBlueprintDraft & { questionBlueprintId: string },
): UpdateQuestionBlueprintInput {
  return {
    description: draft.description,
    document: draft.document,
    name: draft.name,
    questionBlueprintId: draft.questionBlueprintId,
    sources: draft.sources,
    visibility: draft.visibility,
  };
}

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
