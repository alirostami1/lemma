import { presentDate, presentNullableDate } from "@lemma/http";
import type {
  GradeQuestionResult,
  PublishedQuestionBlueprintDraftResult,
  QuestionBlueprintAuthoringResult,
  QuestionBlueprintDraftResult,
  QuestionBlueprintDraftsResult,
  QuestionBlueprintResult,
  QuestionBlueprintsResult,
  QuestionGenerationRunResultDto,
  QuestionGenerationRunsResult,
  QuestionResult,
  QuestionSetResult,
  QuestionSetsResult,
  QuestionsResult,
} from "../application/index.js";
import type {
  GradeQuestionResponse,
  ListQuestionBlueprintDraftsResponse,
  ListQuestionBlueprintsResponse,
  ListQuestionGenerationRunsResponse,
  ListQuestionSetsResponse,
  ListQuestionsResponse,
  PublishQuestionBlueprintDraftResponse,
  QuestionBlueprintAuthoringResponse,
  QuestionBlueprintDraftResponse,
  QuestionBlueprint as QuestionBlueprintDto,
  QuestionBlueprintResponse,
  QuestionGenerationRun as QuestionGenerationRunDto,
  QuestionGenerationRunResponse,
  QuestionResponse,
  QuestionSetResponse,
} from "../generated/types/index.js";

export const presentQuestionBlueprintDraft = (
  result: QuestionBlueprintDraftResult,
): QuestionBlueprintDraftResponse => ({
  draft: {
    ...result.draft,
    createdAt: presentDate(result.draft.createdAt),
    lastSavedAt: presentDate(result.draft.lastSavedAt),
    sources: [...result.draft.sources],
    updatedAt: presentDate(result.draft.updatedAt),
  },
});

export const presentQuestionBlueprintDrafts = (
  result: QuestionBlueprintDraftsResult,
): ListQuestionBlueprintDraftsResponse => ({
  drafts: result.drafts.map(
    (draft) => presentQuestionBlueprintDraft({ draft }).draft,
  ),
  nextCursor: result.nextCursor,
});

export const presentPublishedQuestionBlueprintDraft = (
  result: PublishedQuestionBlueprintDraftResult,
): PublishQuestionBlueprintDraftResponse => ({
  ...presentQuestionBlueprintDraft({ draft: result.draft }),
  ...presentQuestionBlueprint({ questionBlueprint: result.questionBlueprint }),
});

export const presentQuestionSet = (
  result: QuestionSetResult,
): QuestionSetResponse => ({
  questionSet: {
    ...result.questionSet,
    createdAt: presentDate(result.questionSet.createdAt),
    updatedAt: presentDate(result.questionSet.updatedAt),
  },
});

export const presentQuestionSets = (
  result: QuestionSetsResult,
): ListQuestionSetsResponse => ({
  nextCursor: result.nextCursor,
  questionSets: result.questionSets.map(
    (questionSet) => presentQuestionSet({ questionSet }).questionSet,
  ),
});

export const presentQuestionBlueprint = (
  result: QuestionBlueprintResult,
): QuestionBlueprintResponse => ({
  questionBlueprint: {
    ...result.questionBlueprint,
    archivedAt: presentNullableDate(result.questionBlueprint.archivedAt),
    createdAt: presentDate(result.questionBlueprint.createdAt),
    document: toLearnerQuestionBlueprintDocumentDto(
      result.questionBlueprint.document,
    ),
    sources: [...result.questionBlueprint.sources],
    updatedAt: presentDate(result.questionBlueprint.updatedAt),
  },
});

export const presentQuestionBlueprintAuthoring = (
  result: QuestionBlueprintAuthoringResult,
): QuestionBlueprintAuthoringResponse => ({
  questionBlueprint: {
    ...result.questionBlueprint,
    archivedAt: presentNullableDate(result.questionBlueprint.archivedAt),
    createdAt: presentDate(result.questionBlueprint.createdAt),
    document: result.questionBlueprint.document,
    sources: [...result.questionBlueprint.sources],
    updatedAt: presentDate(result.questionBlueprint.updatedAt),
  },
});

export const presentQuestionBlueprints = (
  result: QuestionBlueprintsResult,
): ListQuestionBlueprintsResponse => ({
  nextCursor: result.nextCursor,
  questionBlueprints: result.questionBlueprints.map(
    (questionBlueprint) =>
      presentQuestionBlueprint({ questionBlueprint }).questionBlueprint,
  ),
});

export const presentQuestion = (result: QuestionResult): QuestionResponse => {
  const question = result.question;
  return {
    question: {
      blueprintId: question.blueprintId,
      body: question.body,
      createdAt: presentDate(question.createdAt),
      createdByUserId: question.createdByUserId,
      generationRunId: question.generationRunId,
      id: question.id,
      ownerUserId: question.ownerUserId,
      producer: question.producer,
      status: question.status,
      updatedAt: presentDate(question.updatedAt),
    },
  };
};

export const presentQuestions = (
  result: QuestionsResult,
): ListQuestionsResponse => ({
  nextCursor: result.nextCursor,
  questions: result.questions.map(
    (question) => presentQuestion({ question }).question,
  ),
});

export const presentGrade = (
  result: GradeQuestionResult,
): GradeQuestionResponse => result;

export const presentQuestionGenerationRun = (
  result: QuestionGenerationRunResultDto,
): QuestionGenerationRunResponse => ({
  questionGenerationRun: toQuestionGenerationRunDto(result),
});

export const presentQuestionGenerationRuns = (
  result: QuestionGenerationRunsResult,
): ListQuestionGenerationRunsResponse => ({
  nextCursor: result.nextCursor,
  questionGenerationRuns: result.questionGenerationRuns.map(
    (questionGenerationRun) =>
      presentQuestionGenerationRun({ questionGenerationRun })
        .questionGenerationRun,
  ),
});

function toLearnerQuestionBlueprintDocumentDto(
  document: QuestionBlueprintResult["questionBlueprint"]["document"],
): QuestionBlueprintDto["document"] {
  return {
    blocks: document.blocks.map((block) => {
      if (block.type === "text") {
        return {
          ...block,
          content: toPublicInlineContentDto(block.content),
        };
      }
      if (block.type === "response") {
        return {
          id: block.id,
          responseFieldId: block.responseFieldId,
          type: block.type,
          ...(block.label === undefined ? {} : { label: block.label }),
          ...(block.placeholder === undefined
            ? {}
            : { placeholder: block.placeholder }),
        };
      }
      if (block.type !== "table") {
        return block;
      }
      return {
        ...block,
        cells: block.cells.map((cell) => {
          if (cell.type === "content") {
            return {
              columnId: cell.columnId,
              content: toPublicInlineContentDto(cell.content),
              id: cell.id,
              rowId: cell.rowId,
              type: cell.type,
            };
          }
          return {
            columnId: cell.columnId,
            id: cell.id,
            responseFieldId: cell.responseFieldId,
            rowId: cell.rowId,
            type: cell.type,
            ...(cell.label === undefined ? {} : { label: cell.label }),
            ...(cell.placeholder === undefined
              ? {}
              : { placeholder: cell.placeholder }),
          };
        }),
      };
    }),
    responseFields: document.responseFields,
    schemaVersion: document.schemaVersion,
  };
}

function toPublicInlineContentDto(
  content: Array<
    | { type: "text"; text: string }
    | {
        type: "reference";
        referenceId: string;
        rangeCell?: { rowOffset: number; columnOffset: number };
        fallbackText?: string;
      }
  >,
) {
  return content.map((part) =>
    part.type === "text"
      ? part
      : { text: part.fallbackText ?? "", type: "text" as const },
  );
}

function toQuestionGenerationRunDto(
  result: QuestionGenerationRunResultDto,
): QuestionGenerationRunDto {
  const run = result.questionGenerationRun;
  return {
    attemptNumber: run.attemptNumber,
    attempts: run.attempts,
    blueprintId: run.blueprintId,
    createdAt: presentDate(run.createdAt),
    createdByUserId: run.createdByUserId,
    errorMessage: run.errorMessage,
    finishedAt: presentNullableDate(run.finishedAt),
    id: run.id,
    ownerUserId: run.ownerUserId,
    requestedCount: run.requestedCount,
    result: run.result,
    retryOfRunId: run.retryOfRunId,
    startedAt: presentNullableDate(run.startedAt),
    status: run.status,
    targetQuestionSetId: run.targetQuestionSetId,
    updatedAt: presentDate(run.updatedAt),
    workbookCalculationId: run.workbookCalculationId,
  };
}
