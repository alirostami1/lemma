import {
  createQuestionBlueprint as createQuestionBlueprintGenerated,
  createQuestionGenerationRun as createQuestionGenerationRunGenerated,
  createQuestionSet as createQuestionSetGenerated,
  getQuestionBlueprintAuthoring as getQuestionBlueprintAuthoringGenerated,
  getQuestionBlueprint as getQuestionBlueprintGenerated,
  getQuestionBlueprintVersionAuthoring as getQuestionBlueprintVersionAuthoringGenerated,
  getQuestion as getQuestionGenerated,
  getQuestionGenerationRun as getQuestionGenerationRunGenerated,
  getQuestionSet as getQuestionSetGenerated,
  gradeQuestion as gradeQuestionGenerated,
  listQuestionBlueprints as listQuestionBlueprintsGenerated,
  listQuestionBlueprintVersions as listQuestionBlueprintVersionsGenerated,
  listQuestionSetQuestions as listQuestionSetQuestionsGenerated,
  listQuestionSets as listQuestionSetsGenerated,
  retryQuestionGenerationRun as retryQuestionGenerationRunGenerated,
  updateQuestionBlueprint as updateQuestionBlueprintGenerated,
} from "#/api/generated/questions/questions";
import {
  mapQuestionBlueprintAuthoringResponse,
  mapQuestionBlueprintResponse,
  mapQuestionBlueprintsResponse,
  mapQuestionBlueprintVersionsResponse,
  mapQuestionGenerationRunResponse,
  mapQuestionResponse,
  mapQuestionSetResponse,
  mapQuestionSetsResponse,
  mapQuestionsResponse,
} from "./mappers";
import type {
  CreateQuestionBlueprintInput,
  CreateQuestionGenerationRunInput,
  CreateQuestionSetInput,
  GetQuestionBlueprintInput,
  GetQuestionBlueprintVersionInput,
  GetQuestionGenerationRunInput,
  GetQuestionInput,
  GradeQuestionInput,
  ListQuestionBlueprintsInput,
  ListQuestionSetItemsInput,
  ListQuestionSetsInput,
  QuestionBlueprintAuthoringResult,
  QuestionBlueprintResult,
  QuestionBlueprintsPage,
  QuestionBlueprintVersionsResult,
  QuestionGenerationRunResult,
  QuestionGradeResult,
  QuestionResult,
  QuestionSetResult,
  QuestionSetsPage,
  QuestionsPage,
  RetryQuestionGenerationRunInput,
  UpdateQuestionBlueprintInput,
} from "./model";
import {
  toCreateQuestionBlueprintRequest,
  toCreateQuestionGenerationRunRequest,
  toUpdateQuestionBlueprintRequest,
} from "./request-mappers";

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

export async function listQuestionBlueprintVersions({
  questionBlueprintId,
}: GetQuestionBlueprintInput): Promise<QuestionBlueprintVersionsResult> {
  return mapQuestionBlueprintVersionsResponse(
    await listQuestionBlueprintVersionsGenerated(questionBlueprintId),
  );
}

export async function getQuestionBlueprintVersionAuthoring({
  questionBlueprintId,
  questionBlueprintVersionId,
}: GetQuestionBlueprintVersionInput): Promise<QuestionBlueprintAuthoringResult> {
  return mapQuestionBlueprintAuthoringResponse(
    await getQuestionBlueprintVersionAuthoringGenerated(
      questionBlueprintId,
      questionBlueprintVersionId,
    ),
  );
}

export async function createQuestionBlueprint(
  input: CreateQuestionBlueprintInput,
): Promise<QuestionBlueprintResult> {
  return mapQuestionBlueprintResponse(
    await createQuestionBlueprintGenerated(
      toCreateQuestionBlueprintRequest(input),
    ),
  );
}

export async function updateQuestionBlueprint(
  input: UpdateQuestionBlueprintInput,
): Promise<QuestionBlueprintResult> {
  return mapQuestionBlueprintResponse(
    await updateQuestionBlueprintGenerated(
      input.questionBlueprintId,
      toUpdateQuestionBlueprintRequest(input),
    ),
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
