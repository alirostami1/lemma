import {
  useQuestionBlueprintsQuery,
  useQuestionSetsQuery,
} from "#/domains/questions/hooks";
import {
  getApiErrorRequestId,
  isForbiddenError,
  isUnauthorizedError,
} from "#/lib/errors/api-error";
import {
  buildHomePageViewModel,
  HOME_RECENT_ITEM_LIMIT,
  type HomePageViewModel,
} from "./home-page-view-model";

export type HomePageController = {
  viewModel: HomePageViewModel;
  pageError:
    | { kind: "sign_in_required"; requestId: string | null }
    | { kind: "forbidden"; requestId: string | null }
    | null;
  blueprints: {
    isLoading: boolean;
    errorMessage: string | null;
    onRetry(): void;
  };
  questionSets: {
    isLoading: boolean;
    errorMessage: string | null;
    onRetry(): void;
  };
};

export function useHomePageController(): HomePageController {
  const questionSetsQuery = useQuestionSetsQuery({
    limit: HOME_RECENT_ITEM_LIMIT,
  });
  const blueprintsQuery = useQuestionBlueprintsQuery({
    limit: HOME_RECENT_ITEM_LIMIT,
  });

  const questionSets = questionSetsQuery.data?.questionSets ?? [];
  const blueprints = blueprintsQuery.data?.questionBlueprints ?? [];
  const accessError = [blueprintsQuery.error, questionSetsQuery.error].find(
    (error) => isUnauthorizedError(error) || isForbiddenError(error),
  );

  return {
    viewModel: buildHomePageViewModel({ questionSets, blueprints }),
    pageError:
      questionSets.length === 0 && blueprints.length === 0 && accessError
        ? isUnauthorizedError(accessError)
          ? {
              kind: "sign_in_required",
              requestId: getApiErrorRequestId(accessError),
            }
          : {
              kind: "forbidden",
              requestId: getApiErrorRequestId(accessError),
            }
        : null,
    blueprints: {
      isLoading: blueprintsQuery.isLoading,
      errorMessage: blueprintsQuery.isError
        ? "Saved blueprints could not be loaded right now."
        : null,
      onRetry: () => {
        void blueprintsQuery.refetch();
      },
    },
    questionSets: {
      isLoading: questionSetsQuery.isLoading,
      errorMessage: questionSetsQuery.isError
        ? "Recent question sets could not be loaded right now."
        : null,
      onRetry: () => {
        void questionSetsQuery.refetch();
      },
    },
  };
}
