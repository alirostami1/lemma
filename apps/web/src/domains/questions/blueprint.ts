import type {
  QuestionAnswer,
  QuestionBlueprintDocument,
} from "#/api/generated/model";
import type { TableAnswerState, TableAnswerValue } from "./authoring";
import type {
  CreateQuestionGenerationRunInput,
  CreateQuestionBlueprintInput,
  QuestionBlueprintVisibility,
  UpdateQuestionBlueprintInput,
} from "./model";

export interface QuestionBlueprintDraft {
  questionBlueprintId?: string;
  name: string;
  description?: string | null;
  visibility?: QuestionBlueprintVisibility;
  document: QuestionBlueprintDocument;
  workbookId?: string | null;
}

export interface WorkbookQuestionGenerationSourceDraft {
  workbookId: string;
}

export function createEmptyQuestionAnswer(): QuestionAnswer {
  return {
    schemaVersion: 1,
    responses: [],
  };
}

export function tableAnswerStateToQuestionAnswer(
  answer: TableAnswerState,
): QuestionAnswer {
  return {
    schemaVersion: 1,
    responses: Object.entries(answer).map(([responseFieldId, value]) => ({
      responseFieldId,
      value,
    })),
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

export type QuestionGenerationDraft =
  {
    targetQuestionSetId: string;
    count: number;
    blueprintId: string;
    blueprintVersionId?: string | null;
    sourceWorkbookId?: string | null;
  };

export function toCreateQuestionBlueprintInput(
  draft: QuestionBlueprintDraft,
): CreateQuestionBlueprintInput {
  return {
    name: draft.name,
    description: draft.description,
    visibility: draft.visibility,
    document: draft.document,
    workbookId: draft.workbookId,
  };
}

export function toUpdateQuestionBlueprintInput(
  draft: QuestionBlueprintDraft & { questionBlueprintId: string },
): UpdateQuestionBlueprintInput {
  return {
    questionBlueprintId: draft.questionBlueprintId,
    name: draft.name,
    description: draft.description,
    visibility: draft.visibility,
    document: draft.document,
    workbookId: draft.workbookId,
  };
}

export function toCreateQuestionGenerationRunInput(
  draft: QuestionGenerationDraft,
): CreateQuestionGenerationRunInput {
  return {
    count: draft.count,
    targetQuestionSetId: draft.targetQuestionSetId,
    blueprintId: draft.blueprintId,
    blueprintVersionId: draft.blueprintVersionId,
    sourceWorkbookId: draft.sourceWorkbookId ?? null,
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
