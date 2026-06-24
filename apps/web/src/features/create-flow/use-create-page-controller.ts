import { useMemo } from "react";
import { useQuestionBlueprintsQuery } from "#/domains/questions/hooks";
import { isForbiddenError, isUnauthorizedError } from "#/lib/errors/api-error";
import type { SavedBlueprintChooserController } from "./create-chooser-controller";
import {
  buildCreatePageViewModel,
  CREATE_RECENT_ITEM_LIMIT,
  type CreatePageViewModel,
} from "./create-page-view-model";
import { useSavedBlueprintChooserController } from "./use-saved-blueprint-chooser-controller";

export type CreatePageController = {
  viewModel: CreatePageViewModel;
  isBlueprintsLoading: boolean;
  initialError: Error | null;
  blueprintsErrorMessage: string | null;
  onRetryBlueprints(): void;
  savedBlueprintChooser: SavedBlueprintChooserController;
};

export function useCreatePageController(): CreatePageController {
  const blueprintsQuery = useQuestionBlueprintsQuery({
    limit: CREATE_RECENT_ITEM_LIMIT,
    status: "active",
  });
  const savedBlueprintChooser = useSavedBlueprintChooserController();
  const blueprints = blueprintsQuery.data?.questionBlueprints ?? [];
  const viewModel = useMemo(
    () => buildCreatePageViewModel({ blueprints }),
    [blueprints],
  );
  const accessError =
    blueprintsQuery.error &&
    (isUnauthorizedError(blueprintsQuery.error) ||
      isForbiddenError(blueprintsQuery.error))
      ? blueprintsQuery.error
      : null;

  return {
    blueprintsErrorMessage: blueprintsQuery.isError
      ? "Some blueprints could not be loaded."
      : null,
    initialError:
      accessError ??
      (!blueprintsQuery.isLoading && blueprintsQuery.isError
        ? blueprintsQuery.error
        : null),
    isBlueprintsLoading: blueprintsQuery.isLoading,
    onRetryBlueprints: () => {
      void blueprintsQuery.refetch();
    },
    savedBlueprintChooser,
    viewModel,
  };
}
