import type { QuestionAnswer } from "#/domains/questions";
import { formatAnswerInputValue } from "#/domains/questions/authoring";

export function formatQuestionAnswerValue(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return formatAnswerInputValue(value);
  }
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

export function setQuestionAnswerResponse(
  answer: QuestionAnswer,
  responseFieldId: string,
  value: unknown,
): QuestionAnswer {
  return {
    ...answer,
    responses: [
      ...answer.responses.filter(
        (response) => response.responseFieldId !== responseFieldId,
      ),
      { responseFieldId, value },
    ],
  };
}
