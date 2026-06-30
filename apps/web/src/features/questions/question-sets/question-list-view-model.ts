import { getQuestionSummaryText, type Question } from "#/domains/questions";
import { formatStableDateTime } from "#/lib/date-format";

export type QuestionListItemViewModel = {
  id: string;
  title: string;
  description: string;
  metadata: string;
};

export function buildQuestionListViewModel(
  questions: Question[],
): QuestionListItemViewModel[] {
  return questions.map((question, index) => ({
    description: getQuestionSummaryText(question),
    id: question.id,
    metadata: `Generated ${formatStableDateTime(question.createdAt)}`,
    title: `Question ${index + 1}`,
  }));
}
