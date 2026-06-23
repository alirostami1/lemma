import type { QuestionSet } from "#/domains/questions";

export type QuestionSetDetailViewModel = {
  title: string;
  description: string;
  summaryTitle: string;
  summaryDescription: string;
  generatedQuestionsTitle: string;
  generatedQuestionsDescription: string;
  backLabel: string;
  createLabel: string;
  loadMoreLabel: string;
  loadingMoreLabel: string;
  endOfListLabel: string;
};

export function getQuestionSetDetailViewModel(input: {
  questionSet: QuestionSet | null;
}): QuestionSetDetailViewModel {
  const questionSetName = input.questionSet?.name ?? "Question set";

  return {
    backLabel: "Back to question sets",
    createLabel: "Create blueprint",
    description: "See generated questions in this question set.",
    endOfListLabel: "All generated questions are shown.",
    generatedQuestionsDescription:
      "Generated questions stay here after generation finishes.",
    generatedQuestionsTitle: "Generated questions",
    loadingMoreLabel: "Loading more questions...",
    loadMoreLabel: "Load more questions",
    summaryDescription: "Question set details and generated question history.",
    summaryTitle: "Question set",
    title: questionSetName,
  };
}
