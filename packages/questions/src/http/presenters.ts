import { presentDate, presentNullableDate } from "@lemma/http";
import type {
  GradeQuestionResult,
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
  ListQuestionBlueprintsResponse,
  ListQuestionGenerationRunsResponse,
  ListQuestionSetsResponse,
  ListQuestionsResponse,
  QuestionBlueprintAuthoringResponse,
  QuestionBlueprint as QuestionBlueprintDto,
  QuestionBlueprintResponse,
  QuestionGenerationRun as QuestionGenerationRunDto,
  QuestionGenerationRunResponse,
  QuestionResponse,
  QuestionSetResponse,
} from "../gen/types/index.js";

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
  questionSets: result.questionSets.map(
    (questionSet) => presentQuestionSet({ questionSet }).questionSet,
  ),
  nextCursor: result.nextCursor,
});

export const presentQuestionBlueprint = (
  result: QuestionBlueprintResult,
): QuestionBlueprintResponse => {
  const currentVersion = result.questionBlueprint.currentVersion;
  return {
    questionBlueprint: {
      ...result.questionBlueprint,
      currentVersionId: currentVersion.id,
      currentVersionNumber: currentVersion.versionNumber,
      document: toLearnerQuestionBlueprintDocumentDto(currentVersion.document),
      currentVersion: {
        id: currentVersion.id,
        versionNumber: currentVersion.versionNumber,
        workbookId: currentVersion.workbookId,
        createdByUserId: currentVersion.createdByUserId,
        createdAt: presentDate(currentVersion.createdAt),
      },
      archivedAt: presentNullableDate(result.questionBlueprint.archivedAt),
      createdAt: presentDate(result.questionBlueprint.createdAt),
      updatedAt: presentDate(result.questionBlueprint.updatedAt),
    },
  };
};

export const presentQuestionBlueprintAuthoring = (
  result: QuestionBlueprintResult,
): QuestionBlueprintAuthoringResponse => {
  const currentVersion = result.questionBlueprint.currentVersion;
  return {
    questionBlueprint: {
      ...result.questionBlueprint,
      currentVersionId: currentVersion.id,
      currentVersionNumber: currentVersion.versionNumber,
      document: currentVersion.document,
      currentVersion: {
        id: currentVersion.id,
        versionNumber: currentVersion.versionNumber,
        workbookId: currentVersion.workbookId,
        createdByUserId: currentVersion.createdByUserId,
        createdAt: presentDate(currentVersion.createdAt),
      },
      archivedAt: presentNullableDate(result.questionBlueprint.archivedAt),
      createdAt: presentDate(result.questionBlueprint.createdAt),
      updatedAt: presentDate(result.questionBlueprint.updatedAt),
    },
  };
};

export const presentQuestionBlueprints = (
  result: QuestionBlueprintsResult,
): ListQuestionBlueprintsResponse => ({
  questionBlueprints: result.questionBlueprints.map(
    (questionBlueprint) =>
      presentQuestionBlueprint({ questionBlueprint }).questionBlueprint,
  ),
  nextCursor: result.nextCursor,
});

export const presentQuestion = (result: QuestionResult): QuestionResponse => {
  const question = result.question;
  return {
    question: {
      id: question.id,
      ownerUserId: question.ownerUserId,
      createdByUserId: question.createdByUserId,
      blueprintId: question.blueprintId,
      blueprintVersionId: question.blueprintVersionId,
      generationRunId: question.generationRunId,
      body: question.body,
      producer: question.producer,
      source: question.source,
      status: question.status,
      createdAt: presentDate(question.createdAt),
      updatedAt: presentDate(question.updatedAt),
    },
  };
};

export const presentQuestions = (
  result: QuestionsResult,
): ListQuestionsResponse => ({
  questions: result.questions.map(
    (question) => presentQuestion({ question }).question,
  ),
  nextCursor: result.nextCursor,
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
  questionGenerationRuns: result.questionGenerationRuns.map(
    (questionGenerationRun) =>
      presentQuestionGenerationRun({ questionGenerationRun })
        .questionGenerationRun,
  ),
  nextCursor: result.nextCursor,
});

function toLearnerQuestionBlueprintDocumentDto(
  document: NonNullable<
    QuestionBlueprintResult["questionBlueprint"]["currentVersion"]
  >["document"],
): QuestionBlueprintDto["document"] {
  return {
    schemaVersion: document.schemaVersion,
    responseFields: document.responseFields,
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
          type: block.type,
          responseFieldId: block.responseFieldId,
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
              id: cell.id,
              rowId: cell.rowId,
              columnId: cell.columnId,
              type: cell.type,
              content: toPublicInlineContentDto(cell.content),
            };
          }
          return {
            id: cell.id,
            rowId: cell.rowId,
            columnId: cell.columnId,
            type: cell.type,
            responseFieldId: cell.responseFieldId,
            ...(cell.label === undefined ? {} : { label: cell.label }),
            ...(cell.placeholder === undefined
              ? {}
              : { placeholder: cell.placeholder }),
          };
        }),
      };
    }),
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
      : { type: "text" as const, text: part.fallbackText ?? "" },
  );
}

function toQuestionGenerationRunDto(
  result: QuestionGenerationRunResultDto,
): QuestionGenerationRunDto {
  const run = result.questionGenerationRun;
  return {
    id: run.id,
    ownerUserId: run.ownerUserId,
    createdByUserId: run.createdByUserId,
    blueprintId: run.blueprintId,
    blueprintVersionId: run.blueprintVersionId,
    targetQuestionSetId: run.targetQuestionSetId,
    requestedCount: run.requestedCount,
    source: run.source,
    status: run.status,
    result: run.result,
    errorMessage: run.errorMessage,
    attempts: run.attempts,
    startedAt: presentNullableDate(run.startedAt),
    finishedAt: presentNullableDate(run.finishedAt),
    createdAt: presentDate(run.createdAt),
    updatedAt: presentDate(run.updatedAt),
  };
}
