import {
  createQuestionGenerationRun as createQuestionGenerationRunGenerated,
  createQuestionSet as createQuestionSetGenerated,
  createQuestionBlueprint as createQuestionBlueprintGenerated,
  getQuestion as getQuestionGenerated,
  gradeQuestion as gradeQuestionGenerated,
  getQuestionGenerationRun as getQuestionGenerationRunGenerated,
  getQuestionSet as getQuestionSetGenerated,
  getQuestionBlueprintAuthoring as getQuestionBlueprintAuthoringGenerated,
  getQuestionBlueprint as getQuestionBlueprintGenerated,
  listQuestionBlueprints as listQuestionBlueprintsGenerated,
  listQuestionSetQuestions as listQuestionSetQuestionsGenerated,
  listQuestionSets as listQuestionSetsGenerated,
  retryQuestionGenerationRun as retryQuestionGenerationRunGenerated,
  updateQuestionBlueprint as updateQuestionBlueprintGenerated,
} from "#/api/generated/questions/questions";
import {
  mapQuestionGenerationRunResponse,
  mapQuestionResponse,
  mapQuestionSetResponse,
  mapQuestionSetsResponse,
  mapQuestionsResponse,
  mapQuestionBlueprintAuthoringResponse,
  mapQuestionBlueprintResponse,
  mapQuestionBlueprintsResponse,
} from "./mappers";
import type {
  CreateQuestionGenerationRunInput,
  CreateQuestionSetInput,
  CreateQuestionBlueprintInput,
  GetQuestionGenerationRunInput,
  GetQuestionInput,
  GradeQuestionInput,
  GetQuestionBlueprintInput,
  ListQuestionBlueprintsInput,
  ListQuestionSetItemsInput,
  ListQuestionSetsInput,
  QuestionGenerationRunResult,
  QuestionResult,
  QuestionGradeResult,
  QuestionSetResult,
  QuestionSetsPage,
  QuestionsPage,
  QuestionBlueprintAuthoringResult,
  QuestionBlueprintResult,
  QuestionBlueprintsPage,
  RetryQuestionGenerationRunInput,
  UpdateQuestionBlueprintInput,
} from "./model";
import {
  toCreateQuestionGenerationRunRequest,
  toCreateQuestionBlueprintRequest,
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
