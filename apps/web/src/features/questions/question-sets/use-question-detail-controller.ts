import { useEffect, useState } from "react";
import {
  createEmptyQuestionAnswer,
  type QuestionGrade,
  useQuestionQuery,
  useQuestionSetQuery,
  useGradeQuestion,
  type Question,
  type QuestionAnswer,
  type QuestionSet,
} from "#/domains/questions";
import {
  getApiErrorRequestId,
  isForbiddenError,
  isNotFoundError,
  isUnauthorizedError,
} from "#/lib/errors/api-error";

export type QuestionDetailPageError =
  | { kind: "sign_in_required"; requestId: string | null }
  | { kind: "forbidden"; requestId: string | null }
  | { kind: "not_found"; requestId: string | null }
  | { kind: "unexpected"; requestId: string | null };

export type QuestionDetailController = {
  question: Question | null;
  questionSet: QuestionSet | null;
  answer: QuestionAnswer;
  grade: QuestionGrade | null;
  isCheckingAnswer: boolean;
  checkAnswerError: string | null;
  canCheckAnswer: boolean;
  isLoading: boolean;
  pageError: QuestionDetailPageError | null;
  onAnswerChange(answer: QuestionAnswer): void;
  onCheckAnswer(): void;
};

export function useQuestionDetailController({
  questionId,
  questionSetId,
}: {
  questionId: string;
  questionSetId: string;
}): QuestionDetailController {
  const questionQuery = useQuestionQuery({ questionId });
  const questionSetQuery = useQuestionSetQuery(questionSetId);
  const gradeMutation = useGradeQuestion();
  const resetGrade = gradeMutation.reset;
  const [answer, setAnswer] = useState<QuestionAnswer>(createEmptyQuestionAnswer);

  useEffect(() => {
    setAnswer(createEmptyQuestionAnswer());
    resetGrade();
  }, [questionId, resetGrade]);

  const questionError = getQuestionDetailPageError(
    questionQuery.error,
    !questionQuery.isLoading && !questionQuery.data?.question,
  );
  const questionSetError = getQuestionDetailPageError(
    questionSetQuery.error,
    !questionSetQuery.isLoading && !questionSetQuery.data?.questionSet,
  );

  return {
    question: questionQuery.data?.question ?? null,
    questionSet: questionSetQuery.data?.questionSet ?? null,
    answer,
    grade: gradeMutation.data?.grade ?? null,
    isCheckingAnswer: gradeMutation.isPending,
    checkAnswerError: gradeMutation.isError
      ? "Answer could not be checked."
      : null,
    canCheckAnswer: answer.responses.length > 0 && !gradeMutation.isPending,
    isLoading: questionQuery.isLoading || questionSetQuery.isLoading,
    pageError: questionError ?? questionSetError,
    onAnswerChange: (nextAnswer) => {
      setAnswer(nextAnswer);
      resetGrade();
    },
    onCheckAnswer: () => {
      if (answer.responses.length === 0 || gradeMutation.isPending) {
        return;
      }
      gradeMutation.mutate({ questionId, answer });
    },
  };
}

function getQuestionDetailPageError(
  error: unknown,
  isMissing: boolean,
): QuestionDetailPageError | null {
  const requestId = getApiErrorRequestId(error);
  if (isUnauthorizedError(error)) {
    return { kind: "sign_in_required", requestId };
  }
  if (isForbiddenError(error)) {
    return { kind: "forbidden", requestId };
  }
  if (isNotFoundError(error) || (isMissing && !error)) {
    return { kind: "not_found", requestId };
  }
  if (error) {
    return { kind: "unexpected", requestId };
  }
  return null;
}
