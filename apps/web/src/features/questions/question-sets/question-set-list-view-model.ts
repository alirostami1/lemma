import type { QuestionSet } from "#/domains/questions";
import { formatStableDateTime } from "#/lib/date-format";

export type QuestionSetListItemViewModel = {
  id: string;
  title: string;
  metadata: string;
};

export type QuestionSetListViewModel = {
  title: string;
  description: string;
  sectionTitle: string;
  sectionDescription: string;
  emptyDescription: string;
  items: QuestionSetListItemViewModel[];
};

export function buildQuestionSetListViewModel(input: {
  questionSets: QuestionSet[];
}): QuestionSetListViewModel {
  return {
    description: "Organize generated questions by question set.",
    emptyDescription: "Question sets group generated questions for reuse.",
    items: input.questionSets.map((questionSet) => ({
      id: questionSet.id,
      metadata: `Updated ${formatStableDateTime(questionSet.updatedAt)}`,
      title: questionSet.name,
    })),
    sectionDescription: `${input.questionSets.length} question set${input.questionSets.length === 1 ? "" : "s"}`,
    sectionTitle: "Question sets",
    title: "Question sets",
  };
}
