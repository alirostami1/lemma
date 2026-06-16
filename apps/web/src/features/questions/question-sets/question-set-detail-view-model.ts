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
    title: questionSetName,
    description: "See generated questions in this question set.",
    summaryTitle: "Question set",
    summaryDescription: "Question set details and generated question history.",
    generatedQuestionsTitle: "Generated questions",
    generatedQuestionsDescription:
      "Generated questions stay here after generation finishes.",
    backLabel: "Back to question sets",
    createLabel: "Create blueprint",
    loadMoreLabel: "Load more questions",
    loadingMoreLabel: "Loading more questions...",
    endOfListLabel: "All generated questions are shown.",
  };
}
