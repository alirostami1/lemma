import { useEffect, useMemo } from "react";
import {
  type QuestionSet,
  useQuestionSetQuery,
  useQuestionSetQuestionsInfiniteQuery,
} from "#/domains/questions";
import {
  questionSetNotificationChannel,
  useRealtimeNotificationChannel,
} from "#/domains/realtime";
import { notifyGeneratedQuestionsLoadMoreFailed } from "#/features/notifications";
import {
  getApiErrorRequestId,
  isForbiddenError,
  isNotFoundError,
  isUnauthorizedError,
} from "#/lib/errors/api-error";
import {
  buildQuestionListViewModel,
  type QuestionListItemViewModel,
} from "./question-list-view-model";

type QuestionSetState =
  | { status: "loading" }
  | { status: "ready"; questionSet: QuestionSet };

export type QuestionSetDetailPageError =
  | { kind: "sign_in_required"; requestId: string | null }
  | { kind: "forbidden"; requestId: string | null }
  | { kind: "not_found"; requestId: string | null }
  | { kind: "unexpected"; requestId: string | null };

export type QuestionSetDetailController = {
  questionSetState: QuestionSetState;
  pageError: QuestionSetDetailPageError | null;
  questionItems: QuestionListItemViewModel[];
  questionsState: {
    isInitialLoading: boolean;
    initialErrorMessage: string | null;
    loadMoreErrorMessage: string | null;
    isLoadMorePending: boolean;
    hasMore: boolean;
    hasLoadedQuestions: boolean;
  };
  onLoadMore(): void;
  onRetryLoadMore(): void;
};

export function useQuestionSetDetailController({
  questionSetId,
}: {
  questionSetId: string;
}): QuestionSetDetailController {
  const questionSetQuery = useQuestionSetQuery(questionSetId);
  const questionsQuery = useQuestionSetQuestionsInfiniteQuery({
    questionSetId,
    limit: 25,
  });
  useRealtimeNotificationChannel(questionSetNotificationChannel(questionSetId));
  const questions = useMemo(
    () => questionsQuery.data?.pages.flatMap((page) => page.questions) ?? [],
    [questionsQuery.data?.pages],
  );
  const questionItems = useMemo(
    () => buildQuestionListViewModel(questions),
    [questions],
  );

  useEffect(() => {
    if (questionsQuery.isFetchNextPageError) {
      notifyGeneratedQuestionsLoadMoreFailed();
    }
  }, [questionsQuery.isFetchNextPageError]);

  const questionSetState: QuestionSetState = questionSetQuery.data?.questionSet
    ? {
        status: "ready",
        questionSet: questionSetQuery.data.questionSet,
      }
    : { status: "loading" };
  const initialQuestionsError =
    questions.length === 0 ? questionsQuery.error : null;
  const questionSetPageError = getQuestionSetDetailPageError(
    questionSetQuery.error,
    !questionSetQuery.isLoading && !questionSetQuery.data?.questionSet,
  );
  const initialQuestionsPageError =
    isUnauthorizedError(initialQuestionsError) ||
    isForbiddenError(initialQuestionsError)
      ? getQuestionSetDetailPageError(initialQuestionsError)
      : null;

  return {
    questionSetState,
    pageError: questionSetPageError ?? initialQuestionsPageError,
    questionItems,
    questionsState: {
      isInitialLoading: questionsQuery.isLoading && questions.length === 0,
      initialErrorMessage:
        questionsQuery.isError && questions.length === 0
          ? "Generated questions could not be loaded."
          : null,
      loadMoreErrorMessage: questionsQuery.isFetchNextPageError
        ? "More generated questions could not be loaded."
        : null,
      isLoadMorePending: questionsQuery.isFetchingNextPage,
      hasMore: Boolean(questionsQuery.hasNextPage),
      hasLoadedQuestions: questions.length > 0,
    },
    onLoadMore: () => {
      if (!questionsQuery.hasNextPage || questionsQuery.isFetchingNextPage) {
        return;
      }
      void questionsQuery.fetchNextPage();
    },
    onRetryLoadMore: () => {
      if (questionsQuery.isFetchingNextPage) {
        return;
      }
      void questionsQuery.fetchNextPage();
    },
  };
}

export function getQuestionSetDetailPageError(
  error: unknown,
  isMissing = false,
): QuestionSetDetailPageError | null {
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
