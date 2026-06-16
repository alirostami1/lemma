import { useMemo } from "react";
import { useQuestionBlueprintsInfiniteQuery } from "#/domains/questions";
import type { QuestionBlueprint } from "#/domains/questions/model";
import {
  buildSavedBlueprintsViewModel,
  type SavedBlueprintListItem,
} from "./saved-blueprints-view-model";

const PAGE_SIZE = 12;

export function useSavedBlueprintsController({
  onGenerateBlueprint,
}: {
  onGenerateBlueprint(blueprint: QuestionBlueprint): void;
}) {
  const blueprintsQuery = useQuestionBlueprintsInfiniteQuery({
    limit: PAGE_SIZE,
    status: "active",
  });

  const blueprints = useMemo(
    () =>
      blueprintsQuery.data?.pages.flatMap((page) => page.questionBlueprints) ??
      [],
    [blueprintsQuery.data?.pages],
  );
  const blueprintById = useMemo(
    () => new Map(blueprints.map((blueprint) => [blueprint.id, blueprint])),
    [blueprints],
  );
  const items = useMemo(
    () => buildSavedBlueprintsViewModel(blueprints),
    [blueprints],
  );

  return {
    items,
    isInitialLoading: blueprintsQuery.isLoading,
    errorMessage: blueprintsQuery.isError
      ? "Saved blueprints could not be loaded."
      : null,
    loadMoreErrorMessage: blueprintsQuery.isFetchNextPageError
      ? "More saved blueprints could not be loaded."
      : null,
    hasMore: Boolean(blueprintsQuery.hasNextPage),
    isLoadingMore: blueprintsQuery.isFetchingNextPage,
    onRetry: () => {
      void blueprintsQuery.refetch();
    },
    onLoadMore: () => {
      void blueprintsQuery.fetchNextPage();
    },
    onOpenBlueprint: (_id: string) => {},
    onGenerate: (id: string) => {
      const blueprint = blueprintById.get(id);
      if (blueprint) {
        onGenerateBlueprint(blueprint);
      }
    },
  } satisfies {
    items: SavedBlueprintListItem[];
    isInitialLoading: boolean;
    errorMessage: string | null;
    loadMoreErrorMessage: string | null;
    hasMore: boolean;
    isLoadingMore: boolean;
    onRetry(): void;
    onLoadMore(): void;
    onOpenBlueprint(id: string): void;
    onGenerate(id: string): void;
  };
}
