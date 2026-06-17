import type {
  GradeResult,
  Question,
  QuestionBlueprint,
  QuestionBlueprintVersion,
  QuestionGenerationRun,
  QuestionSet,
} from "../domain/index.js";

export type QuestionSetResult = { questionSet: QuestionSet };
export type QuestionSetsResult = {
  questionSets: QuestionSet[];
  nextCursor: string | null;
};
export type HydratedQuestionBlueprint = QuestionBlueprint & {
  currentVersion: QuestionBlueprintVersion;
};
export type QuestionBlueprintResult = {
  questionBlueprint: HydratedQuestionBlueprint;
};
export type QuestionBlueprintsResult = {
  questionBlueprints: HydratedQuestionBlueprint[];
  nextCursor: string | null;
};
export type QuestionResult = { question: Question };
export type QuestionsResult = {
  questions: Question[];
  nextCursor: string | null;
};
export type GradeQuestionResult = { grade: GradeResult };
export type QuestionGenerationRunResultDto = {
  questionGenerationRun: QuestionGenerationRun;
};
export type QuestionGenerationRunsResult = {
  questionGenerationRuns: QuestionGenerationRun[];
  nextCursor: string | null;
};
