import type {
  ListQuestionBlueprintDraftsInput,
  ListQuestionBlueprintsInput,
  ListQuestionSetItemsInput,
  ListQuestionSetsInput,
} from "./model";

export const questionKeys = {
  all: ["questions"] as const,
  generationRunDetail: (questionGenerationRunId: string) =>
    [...questionKeys.generationRunDetails(), questionGenerationRunId] as const,
  generationRunDetails: () =>
    [...questionKeys.generationRuns(), "detail"] as const,
  generationRuns: () =>
    [...questionKeys.all, "question-generation-runs"] as const,
  questionBlueprintAuthoring: (questionBlueprintId: string) =>
    [
      ...questionKeys.questionBlueprintDetail(questionBlueprintId),
      "authoring",
    ] as const,
  questionBlueprintDetail: (questionBlueprintId: string) =>
    [...questionKeys.questionBlueprintDetails(), questionBlueprintId] as const,
  questionBlueprintDetails: () =>
    [...questionKeys.questionBlueprints(), "detail"] as const,
  questionBlueprintDraftDetail: (draftId: string) =>
    [...questionKeys.questionBlueprintDrafts(), "detail", draftId] as const,
  questionBlueprintDrafts: () =>
    [...questionKeys.all, "question-blueprint-drafts"] as const,
  questionBlueprintDraftsInfiniteList: (
    input?: Omit<ListQuestionBlueprintDraftsInput, "cursor">,
  ) =>
    [
      ...questionKeys.questionBlueprintDrafts(),
      "infinite-list",
      input ?? {},
    ] as const,
  questionBlueprintDraftsList: (input?: ListQuestionBlueprintDraftsInput) =>
    [...questionKeys.questionBlueprintDrafts(), "list", input ?? {}] as const,
  questionBlueprints: () =>
    [...questionKeys.all, "question-blueprints"] as const,
  questionBlueprintsInfiniteList: (
    input?: Omit<ListQuestionBlueprintsInput, "cursor">,
  ) =>
    [
      ...questionKeys.questionBlueprints(),
      "infinite-list",
      input ?? {},
    ] as const,
  questionBlueprintsList: (input?: ListQuestionBlueprintsInput) =>
    [...questionKeys.questionBlueprints(), "list", input ?? {}] as const,
  questionDetail: (questionId: string) =>
    [...questionKeys.questionDetails(), questionId] as const,
  questionDetails: () => [...questionKeys.all, "detail"] as const,
  questionSetDetail: (questionSetId: string) =>
    [...questionKeys.questionSetDetails(), questionSetId] as const,
  questionSetDetails: () => [...questionKeys.questionSets(), "detail"] as const,
  questionSetInfiniteList: (input?: Omit<ListQuestionSetsInput, "cursor">) =>
    [...questionKeys.questionSets(), "infinite-list", input ?? {}] as const,
  questionSetList: (input?: ListQuestionSetsInput) =>
    [...questionKeys.questionSetLists(), input ?? {}] as const,
  questionSetLists: () => [...questionKeys.questionSets(), "list"] as const,
  questionSetQuestions: (questionSetId: string) =>
    [...questionKeys.questionSetDetail(questionSetId), "questions"] as const,
  questionSetQuestionsInfiniteList: (
    questionSetId: string,
    input?: Omit<ListQuestionSetItemsInput, "questionSetId" | "cursor">,
  ) =>
    [
      ...questionKeys.questionSetQuestions(questionSetId),
      "infinite-list",
      input ?? {},
    ] as const,
  questionSets: () => [...questionKeys.all, "question-sets"] as const,
};
