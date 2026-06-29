import {
  attachQuestionBlueprintDraftSourceFile as attachQuestionBlueprintDraftSourceFileGenerated,
  completeQuestionBlueprintDraftWorkbookEditorUpload as completeQuestionBlueprintDraftWorkbookEditorUploadGenerated,
  createQuestionBlueprintDraft as createQuestionBlueprintDraftGenerated,
  createQuestionBlueprintDraftWorkbookEditorUpload as createQuestionBlueprintDraftWorkbookEditorUploadGenerated,
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
  saveQuestionBlueprintDraftWorkbookSourceRevision as saveQuestionBlueprintDraftWorkbookSourceRevisionGenerated,
  updateQuestionBlueprintDraft as updateQuestionBlueprintDraftGenerated,
} from "#/api/generated/questions/questions";
import {
  mapCompleteQuestionBlueprintDraftWorkbookEditorUploadResponse,
  mapCreateQuestionBlueprintDraftWorkbookEditorUploadResponse,
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
  mapSaveQuestionBlueprintDraftWorkbookSourceRevisionResponse,
} from "./mappers";
import type {
  AttachQuestionBlueprintDraftSourceFileInput,
  CompleteQuestionBlueprintDraftWorkbookEditorUploadInput,
  CompleteQuestionBlueprintDraftWorkbookEditorUploadResult,
  CreateQuestionBlueprintDraftInput,
  CreateQuestionBlueprintDraftWorkbookEditorUploadInput,
  CreateQuestionBlueprintDraftWorkbookEditorUploadResult,
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
  SaveQuestionBlueprintDraftWorkbookSourceRevisionInput,
  SaveQuestionBlueprintDraftWorkbookSourceRevisionResult,
  UpdateQuestionBlueprintDraftInput,
} from "./model";

export async function listQuestionBlueprintDrafts(input?: {
  limit?: number;
  cursor?: string;
  status?: ListQuestionBlueprintDraftsInput["status"];
}): Promise<QuestionBlueprintDraftsPage> {
  return mapQuestionBlueprintDraftsResponse(
    await listQuestionBlueprintDraftsGenerated(input),
  );
}

export async function listQuestionBlueprintDraftSummaries(
  input?: ListQuestionBlueprintDraftsInput,
): Promise<QuestionBlueprintDraftSummariesPage> {
  const response = await listQuestionBlueprintDraftsGenerated(input);
  return mapQuestionBlueprintDraftSummariesResponse(response);
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

export async function saveQuestionBlueprintDraftWorkbookSourceRevision(
  input: SaveQuestionBlueprintDraftWorkbookSourceRevisionInput,
): Promise<SaveQuestionBlueprintDraftWorkbookSourceRevisionResult> {
  return mapSaveQuestionBlueprintDraftWorkbookSourceRevisionResponse(
    await saveQuestionBlueprintDraftWorkbookSourceRevisionGenerated(
      input.draftId,
      input.sourceId,
      {
        expectedRevision: input.expectedRevision,
        editorOutputFileId: input.editorOutputFileId,
      },
    ),
  );
}

export async function createQuestionBlueprintDraftWorkbookEditorUpload(
  input: CreateQuestionBlueprintDraftWorkbookEditorUploadInput,
): Promise<CreateQuestionBlueprintDraftWorkbookEditorUploadResult> {
  return mapCreateQuestionBlueprintDraftWorkbookEditorUploadResponse(
    await createQuestionBlueprintDraftWorkbookEditorUploadGenerated(
      input.draftId,
      input.sourceId,
      {
        byteSize: input.byteSize,
        checksumSha256: input.checksumSha256,
        contentType: input.contentType,
        expectedRevision: input.expectedRevision,
        originalName: input.originalName,
      },
    ),
  );
}

export async function completeQuestionBlueprintDraftWorkbookEditorUpload(
  input: CompleteQuestionBlueprintDraftWorkbookEditorUploadInput,
): Promise<CompleteQuestionBlueprintDraftWorkbookEditorUploadResult> {
  return mapCompleteQuestionBlueprintDraftWorkbookEditorUploadResponse(
    await completeQuestionBlueprintDraftWorkbookEditorUploadGenerated(
      input.draftId,
      input.sourceId,
      input.uploadId,
      { expectedRevision: input.expectedRevision },
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
