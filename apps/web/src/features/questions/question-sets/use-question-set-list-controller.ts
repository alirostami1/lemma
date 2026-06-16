import { useMemo } from "react";
import {
  type QuestionSet,
  useQuestionSetsInfiniteQuery,
} from "#/domains/questions";
import {
  getApiErrorRequestId,
  isForbiddenError,
  isUnauthorizedError,
} from "#/lib/errors/api-error";
import {
  buildQuestionSetListViewModel,
  type QuestionSetListViewModel,
} from "./question-set-list-view-model";

export type QuestionSetListPageError =
  | { kind: "sign_in_required"; requestId: string | null }
  | { kind: "forbidden"; requestId: string | null }
  | { kind: "unexpected"; requestId: string | null };

export type QuestionSetListController = {
  viewModel: QuestionSetListViewModel;
  questionSets: QuestionSet[];
  pageError: QuestionSetListPageError | null;
  isInitialLoading: boolean;
  initialErrorMessage: string | null;
  loadMoreErrorMessage: string | null;
  isLoadingMore: boolean;
  hasMore: boolean;
  onRetry(): void;
  onLoadMore(): void;
  onRetryLoadMore(): void;
};

export function useQuestionSetListController(): QuestionSetListController {
  const query = useQuestionSetsInfiniteQuery({ limit: 25 });
  const questionSets = useMemo(
    () => query.data?.pages.flatMap((page) => page.questionSets) ?? [],
    [query.data?.pages],
  );

  return {
    viewModel: buildQuestionSetListViewModel({ questionSets }),
    questionSets,
    pageError: getQuestionSetListPageError(
      questionSets.length === 0 ? query.error : null,
    ),
    isInitialLoading: query.isLoading,
    initialErrorMessage:
      query.isError && questionSets.length === 0
        ? "Question sets could not be loaded."
        : null,
    loadMoreErrorMessage: query.isFetchNextPageError
      ? "More question sets could not be loaded."
      : null,
    isLoadingMore: query.isFetchingNextPage,
    hasMore: Boolean(query.hasNextPage),
    onRetry: () => {
      void query.refetch();
    },
    onLoadMore: () => {
      if (!query.hasNextPage || query.isFetchingNextPage) {
        return;
      }
      void query.fetchNextPage();
    },
    onRetryLoadMore: () => {
      if (query.isFetchingNextPage) {
        return;
      }
      void query.fetchNextPage();
    },
  };
}

function getQuestionSetListPageError(
  error: unknown,
): QuestionSetListPageError | null {
  const requestId = getApiErrorRequestId(error);
  if (isUnauthorizedError(error)) {
    return { kind: "sign_in_required", requestId };
  }
  if (isForbiddenError(error)) {
    return { kind: "forbidden", requestId };
  }
  if (error) {
    return { kind: "unexpected", requestId };
  }
  return null;
}
