import type {
  GradeResult,
  Question,
  QuestionBlueprint,
  QuestionBlueprintDraft,
  QuestionGenerationRun,
  QuestionSet,
} from "../domain/index.js";

export type QuestionSetResult = { questionSet: QuestionSet };
export type QuestionSetsResult = {
  questionSets: QuestionSet[];
  nextCursor: string | null;
};
export type QuestionBlueprintResult = {
  questionBlueprint: QuestionBlueprint;
};
export type QuestionBlueprintAuthoringResult = {
  questionBlueprint: QuestionBlueprint;
};
export type QuestionBlueprintsResult = {
  questionBlueprints: QuestionBlueprint[];
  nextCursor: string | null;
};
export type QuestionBlueprintDraftResult = {
  draft: QuestionBlueprintDraft;
};
export type QuestionBlueprintDraftsResult = {
  drafts: QuestionBlueprintDraft[];
  nextCursor: string | null;
};
export type PublishedQuestionBlueprintDraftResult = {
  draft: QuestionBlueprintDraft;
  questionBlueprint: QuestionBlueprint;
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
