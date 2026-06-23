import { useState } from "react";
import { useQuestionBlueprintsInfiniteQuery } from "#/domains/questions/hooks";
import type { SavedBlueprintChooserController } from "./create-chooser-controller";
import {
  buildBlueprintListItems,
  CREATE_CHOOSER_PAGE_SIZE,
} from "./create-page-view-model";

export function useSavedBlueprintChooserController(): SavedBlueprintChooserController {
  const [open, setOpen] = useState(false);
  const query = useQuestionBlueprintsInfiniteQuery(
    {
      limit: CREATE_CHOOSER_PAGE_SIZE,
      status: "active",
    },
    { enabled: open },
  );
  const items = buildBlueprintListItems(
    query.data?.pages.flatMap((page) => page.questionBlueprints) ?? [],
  );

  return {
    errorMessage:
      query.isError && items.length === 0
        ? "Some blueprints could not be loaded."
        : null,
    hasMore: Boolean(query.hasNextPage),
    isInitialLoading: query.isLoading && items.length === 0,
    isLoadingMore: query.isFetchingNextPage,
    items,
    loadMoreErrorMessage:
      query.isFetchNextPageError && items.length > 0
        ? "More blueprints could not be loaded."
        : null,
    onLoadMore: () => {
      void query.fetchNextPage();
    },
    onOpenChange: setOpen,
    onRetry: () => {
      if (items.length > 0) {
        void query.fetchNextPage();
        return;
      }
      void query.refetch();
    },
    open,
  };
}
