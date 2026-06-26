import {
  attachQuestionBlueprintDraftSourceFile as attachQuestionBlueprintDraftSourceFileGenerated,
  createQuestionBlueprintDraft as createQuestionBlueprintDraftGenerated,
  createQuestionBlueprintEditDraft as createQuestionBlueprintEditDraftGenerated,
  createQuestionGenerationRun as createQuestionGenerationRunGenerated,
  createQuestionSet as createQuestionSetGenerated,
  discardQuestionBlueprintDraft as discardQuestionBlueprintDraftGenerated,
  getQuestionBlueprintAuthoring as getQuestionBlueprintAuthoringGenerated,
  getQuestionBlueprintDraft as getQuestionBlueprintDraftGenerated,
  getQuestionBlueprint as getQuestionBlueprintGenerated,
  getQuestion as getQuestionGenerated,
  getQuestionGenerationRun as getQuestionGenerationRunGenerated,
  getQuestionSet as getQuestionSetGenerated,
  gradeQuestion as gradeQuestionGenerated,
  listQuestionBlueprintDrafts as listQuestionBlueprintDraftsGenerated,
  listQuestionBlueprints as listQuestionBlueprintsGenerated,
  listQuestionSetQuestions as listQuestionSetQuestionsGenerated,
  listQuestionSets as listQuestionSetsGenerated,
  publishQuestionBlueprintDraft as publishQuestionBlueprintDraftGenerated,
  retryQuestionGenerationRun as retryQuestionGenerationRunGenerated,
  updateQuestionBlueprintDraft as updateQuestionBlueprintDraftGenerated,
} from "#/api/generated/questions/questions";
import {
  mapPublishQuestionBlueprintDraftResponse,
  mapQuestionBlueprintAuthoringResponse,
  mapQuestionBlueprintDraftResponse,
  mapQuestionBlueprintDraftSummariesResponse,
  mapQuestionBlueprintDraftsResponse,
  mapQuestionBlueprintEditDraftResponse,
  mapQuestionBlueprintResponse,
  mapQuestionBlueprintsResponse,
  mapQuestionGenerationRunResponse,
  mapQuestionResponse,
  mapQuestionSetResponse,
  mapQuestionSetsResponse,
  mapQuestionsResponse,
} from "./mappers";
import type {
  AttachQuestionBlueprintDraftSourceFileInput,
  CreateQuestionBlueprintDraftInput,
  CreateQuestionBlueprintEditDraftInput,
  CreateQuestionGenerationRunInput,
  CreateQuestionSetInput,
  GetQuestionBlueprintInput,
  GetQuestionGenerationRunInput,
  GetQuestionInput,
  GradeQuestionInput,
  ListQuestionBlueprintDraftsInput,
  ListQuestionBlueprintsInput,
  ListQuestionSetItemsInput,
  ListQuestionSetsInput,
  PublishQuestionBlueprintDraftInput,
  PublishQuestionBlueprintDraftResult,
  QuestionBlueprintAuthoringResult,
  QuestionBlueprintDraftResult,
  QuestionBlueprintDraftSummariesPage,
  QuestionBlueprintDraftsPage,
  QuestionBlueprintEditDraftResult,
  QuestionBlueprintResult,
  QuestionBlueprintsPage,
  QuestionGenerationRunResult,
  QuestionGradeResult,
  QuestionResult,
  QuestionSetResult,
  QuestionSetsPage,
  QuestionsPage,
  RetryQuestionGenerationRunInput,
  UpdateQuestionBlueprintDraftInput,
} from "./model";

export async function listQuestionBlueprintDrafts(input?: {
  limit?: number;
  cursor?: string;
}): Promise<QuestionBlueprintDraftsPage> {
  return mapQuestionBlueprintDraftsResponse(
    await listQuestionBlueprintDraftsGenerated(input),
  );
}

export async function listQuestionBlueprintDraftSummaries(
  input?: ListQuestionBlueprintDraftsInput,
): Promise<QuestionBlueprintDraftSummariesPage> {
  const { status, ...query } = input ?? {};
  const response = await listQuestionBlueprintDraftsGenerated(query);
  const filteredDrafts = status
    ? response.drafts.filter((draft) => draft.status === status)
    : response.drafts;

  return mapQuestionBlueprintDraftSummariesResponse({
    ...response,
    drafts: filteredDrafts,
  });
}

export async function getQuestionBlueprintDraft(
  draftId: string,
): Promise<QuestionBlueprintDraftResult> {
  return mapQuestionBlueprintDraftResponse(
    await getQuestionBlueprintDraftGenerated(draftId),
  );
}

export async function createQuestionBlueprintDraft(
  input: CreateQuestionBlueprintDraftInput,
): Promise<QuestionBlueprintDraftResult> {
  return mapQuestionBlueprintDraftResponse(
    await createQuestionBlueprintDraftGenerated(input),
  );
}

export async function createQuestionBlueprintEditDraft({
  questionBlueprintId,
}: CreateQuestionBlueprintEditDraftInput): Promise<QuestionBlueprintEditDraftResult> {
  return mapQuestionBlueprintEditDraftResponse(
    await createQuestionBlueprintEditDraftGenerated(questionBlueprintId, {
      mode: "resume_or_create",
    }),
  );
}

export async function updateQuestionBlueprintDraft(
  input: UpdateQuestionBlueprintDraftInput,
): Promise<QuestionBlueprintDraftResult> {
  const { draftId, ...request } = input;
  return mapQuestionBlueprintDraftResponse(
    await updateQuestionBlueprintDraftGenerated(draftId, request),
  );
}

export async function attachQuestionBlueprintDraftSourceFile(
  input: AttachQuestionBlueprintDraftSourceFileInput,
): Promise<QuestionBlueprintDraftResult> {
  return mapQuestionBlueprintDraftResponse(
    await attachQuestionBlueprintDraftSourceFileGenerated(
      input.draftId,
      input.sourceId,
      {
        expectedRevision: input.expectedRevision,
        fileId: input.fileId,
      },
    ),
  );
}

export async function publishQuestionBlueprintDraft(
  input: PublishQuestionBlueprintDraftInput,
): Promise<PublishQuestionBlueprintDraftResult> {
  return mapPublishQuestionBlueprintDraftResponse(
    await publishQuestionBlueprintDraftGenerated(input.draftId, {
      expectedRevision: input.expectedRevision,
      idempotencyKey: input.idempotencyKey,
    }),
  );
}

export async function discardQuestionBlueprintDraft(input: {
  draftId: string;
  expectedRevision: number;
}): Promise<void> {
  await discardQuestionBlueprintDraftGenerated(input.draftId, {
    expectedRevision: input.expectedRevision,
  });
}

import { toCreateQuestionGenerationRunRequest } from "./request-mappers";

export async function listQuestionSets(
  input?: ListQuestionSetsInput,
): Promise<QuestionSetsPage> {
  return mapQuestionSetsResponse(await listQuestionSetsGenerated(input));
}

export async function createQuestionSet(
  input: CreateQuestionSetInput,
): Promise<QuestionSetResult> {
  return mapQuestionSetResponse(await createQuestionSetGenerated(input));
}

export async function getQuestionSet(
  questionSetId: string,
): Promise<QuestionSetResult> {
  return mapQuestionSetResponse(await getQuestionSetGenerated(questionSetId));
}

export async function listQuestionSetQuestions({
  questionSetId,
  ...input
}: ListQuestionSetItemsInput): Promise<QuestionsPage> {
  return mapQuestionsResponse(
    await listQuestionSetQuestionsGenerated(questionSetId, input),
  );
}

export async function getQuestion({
  questionId,
}: GetQuestionInput): Promise<QuestionResult> {
  return mapQuestionResponse(await getQuestionGenerated(questionId));
}

export async function gradeQuestion({
  questionId,
  answer,
}: GradeQuestionInput): Promise<QuestionGradeResult> {
  return gradeQuestionGenerated(questionId, { answer });
}

export async function listQuestionBlueprints(
  input?: ListQuestionBlueprintsInput,
): Promise<QuestionBlueprintsPage> {
  return mapQuestionBlueprintsResponse(
    await listQuestionBlueprintsGenerated(input),
  );
}

export async function getQuestionBlueprint({
  questionBlueprintId,
}: GetQuestionBlueprintInput): Promise<QuestionBlueprintResult> {
  return mapQuestionBlueprintResponse(
    await getQuestionBlueprintGenerated(questionBlueprintId),
  );
}

export async function getQuestionBlueprintAuthoring({
  questionBlueprintId,
}: GetQuestionBlueprintInput): Promise<QuestionBlueprintAuthoringResult> {
  return mapQuestionBlueprintAuthoringResponse(
    await getQuestionBlueprintAuthoringGenerated(questionBlueprintId),
  );
}

export async function createQuestionGenerationRun(
  input: CreateQuestionGenerationRunInput,
): Promise<QuestionGenerationRunResult> {
  return mapQuestionGenerationRunResponse(
    await createQuestionGenerationRunGenerated(
      toCreateQuestionGenerationRunRequest(input),
    ),
  );
}

export async function getQuestionGenerationRun({
  questionGenerationRunId,
}: GetQuestionGenerationRunInput): Promise<QuestionGenerationRunResult> {
  return mapQuestionGenerationRunResponse(
    await getQuestionGenerationRunGenerated(questionGenerationRunId),
  );
}

export async function retryQuestionGenerationRun({
  questionGenerationRunId,
}: RetryQuestionGenerationRunInput): Promise<QuestionGenerationRunResult> {
  return mapQuestionGenerationRunResponse(
    await retryQuestionGenerationRunGenerated(questionGenerationRunId),
  );
}
