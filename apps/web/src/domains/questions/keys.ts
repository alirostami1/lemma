import type {
  ListQuestionBlueprintsInput,
  ListQuestionSetItemsInput,
  ListQuestionSetsInput,
} from "./model";

export const questionKeys = {
  all: ["questions"] as const,
  questionSets: () => [...questionKeys.all, "question-sets"] as const,
  questionSetLists: () => [...questionKeys.questionSets(), "list"] as const,
  questionSetList: (input?: ListQuestionSetsInput) =>
    [...questionKeys.questionSetLists(), input ?? {}] as const,
  questionSetInfiniteList: (input?: Omit<ListQuestionSetsInput, "cursor">) =>
    [...questionKeys.questionSets(), "infinite-list", input ?? {}] as const,
  questionSetDetails: () => [...questionKeys.questionSets(), "detail"] as const,
  questionSetDetail: (questionSetId: string) =>
    [...questionKeys.questionSetDetails(), questionSetId] as const,
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
  questionDetails: () => [...questionKeys.all, "detail"] as const,
  questionDetail: (questionId: string) =>
    [...questionKeys.questionDetails(), questionId] as const,
  questionBlueprints: () =>
    [...questionKeys.all, "question-blueprints"] as const,
  questionBlueprintsList: (input?: ListQuestionBlueprintsInput) =>
    [...questionKeys.questionBlueprints(), "list", input ?? {}] as const,
  questionBlueprintsInfiniteList: (
    input?: Omit<ListQuestionBlueprintsInput, "cursor">,
  ) =>
    [
      ...questionKeys.questionBlueprints(),
      "infinite-list",
      input ?? {},
    ] as const,
  questionBlueprintDetails: () =>
    [...questionKeys.questionBlueprints(), "detail"] as const,
  questionBlueprintDetail: (questionBlueprintId: string) =>
    [...questionKeys.questionBlueprintDetails(), questionBlueprintId] as const,
  questionBlueprintAuthoring: (questionBlueprintId: string) =>
    [
      ...questionKeys.questionBlueprintDetail(questionBlueprintId),
      "authoring",
    ] as const,
  questionBlueprintVersionAuthoring: (
    questionBlueprintId: string,
    questionBlueprintVersionId: string,
  ) =>
    [
      ...questionKeys.questionBlueprintDetail(questionBlueprintId),
      "versions",
      questionBlueprintVersionId,
      "authoring",
    ] as const,
  questionBlueprintVersions: (questionBlueprintId: string) =>
    [
      ...questionKeys.questionBlueprintDetail(questionBlueprintId),
      "versions",
    ] as const,
  generationRuns: () =>
    [...questionKeys.all, "question-generation-runs"] as const,
  generationRunDetails: () =>
    [...questionKeys.generationRuns(), "detail"] as const,
  generationRunDetail: (questionGenerationRunId: string) =>
    [...questionKeys.generationRunDetails(), questionGenerationRunId] as const,
};
