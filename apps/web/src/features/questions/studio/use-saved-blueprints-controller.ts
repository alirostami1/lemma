import { useMemo } from "react";
import {
  useQuestionBlueprintDraftsInfiniteQuery,
  useQuestionBlueprintsInfiniteQuery,
} from "#/domains/questions";
import type { QuestionBlueprint } from "#/domains/questions/model";
import type { SavedBlueprintsDialogBlueprintAction } from "./saved-blueprints-dialog";
import {
  buildSavedBlueprintsViewModel,
  buildSavedDraftsViewModel,
  type SavedBlueprintListItem,
  type SavedDraftListItem,
} from "./saved-blueprints-view-model";
import {
  buildStudioContinueCardViewModel,
  type StudioContinueCardViewModel,
} from "./unfinished-work-view-model";

const BLUEPRINT_PAGE_SIZE = 12;
const DRAFT_PAGE_SIZE = 10;

export function useSavedBlueprintsController({
  onOpenDraft,
  onEditBlueprintAsDraft,
}: {
  onOpenDraft(draftId: string): void;
  onEditBlueprintAsDraft(blueprint: QuestionBlueprint): void;
}) {
  const draftsQuery = useQuestionBlueprintDraftsInfiniteQuery({
    limit: DRAFT_PAGE_SIZE,
    status: "draft",
  });
  const blueprintsQuery = useQuestionBlueprintsInfiniteQuery({
    limit: BLUEPRINT_PAGE_SIZE,
    status: "active",
  });

  const drafts = useMemo(
    () => draftsQuery.data?.pages.flatMap((page) => page.drafts) ?? [],
    [draftsQuery.data?.pages],
  );
  const blueprints = useMemo(
    () =>
      blueprintsQuery.data?.pages.flatMap((page) => page.questionBlueprints) ??
      [],
    [blueprintsQuery.data?.pages],
  );
  const draftItems = useMemo(() => buildSavedDraftsViewModel(drafts), [drafts]);
  const latestDraft = useMemo(
    () => buildStudioContinueCardViewModel(drafts),
    [drafts],
  );
  const blueprintItems = useMemo(
    () => buildSavedBlueprintsViewModel(blueprints),
    [blueprints],
  );
  const blueprintById = useMemo(
    () => new Map(blueprints.map((blueprint) => [blueprint.id, blueprint])),
    [blueprints],
  );

  return {
    blueprints: blueprintItems,
    draftLoadMoreErrorMessage: draftsQuery.isFetchNextPageError
      ? "More recent work could not be loaded."
      : null,
    drafts: draftItems,
    draftsErrorMessage: draftsQuery.isError
      ? "Recent work could not be loaded."
      : null,
    errorMessage: blueprintsQuery.isError
      ? "Saved blueprints could not be loaded."
      : null,
    hasMoreBlueprints: Boolean(blueprintsQuery.hasNextPage),
    hasMoreDrafts: Boolean(draftsQuery.hasNextPage),
    isDraftsInitialLoading: draftsQuery.isLoading,
    isInitialLoading: blueprintsQuery.isLoading,
    isLoadingBlueprintsMore: blueprintsQuery.isFetchingNextPage,
    isLoadingDraftsMore: draftsQuery.isFetchingNextPage,
    latestDraft,
    loadMoreErrorMessage: blueprintsQuery.isFetchNextPageError
      ? "More saved blueprints could not be loaded."
      : null,
    blueprintAction: {
      onEditAsDraft: (id: string) => {
        const blueprint = blueprintById.get(id);
        if (blueprint) {
          onEditBlueprintAsDraft(blueprint);
        }
      },
    },
    onLoadMoreBlueprints: () => {
      void blueprintsQuery.fetchNextPage();
    },
    onLoadMoreDrafts: () => {
      void draftsQuery.fetchNextPage();
    },
    onOpenDraft,
    onRetry: () => {
      void draftsQuery.refetch();
      void blueprintsQuery.refetch();
    },
  } satisfies {
    drafts: SavedDraftListItem[];
    isDraftsInitialLoading: boolean;
    draftsErrorMessage: string | null;
    draftLoadMoreErrorMessage: string | null;
    latestDraft: StudioContinueCardViewModel | null;
    blueprints: SavedBlueprintListItem[];
    isInitialLoading: boolean;
    errorMessage: string | null;
    loadMoreErrorMessage: string | null;
    hasMoreBlueprints: boolean;
    hasMoreDrafts: boolean;
    isLoadingBlueprintsMore: boolean;
    isLoadingDraftsMore: boolean;
    onRetry(): void;
    onLoadMoreDrafts(): void;
    onLoadMoreBlueprints(): void;
    onOpenDraft(id: string): void;
    blueprintAction: SavedBlueprintsDialogBlueprintAction;
  };
}
