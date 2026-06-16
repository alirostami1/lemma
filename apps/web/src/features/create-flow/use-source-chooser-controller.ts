import { useState } from "react";
import { useWorkbooksInfiniteQuery } from "#/domains/workbooks/hooks";
import type { SourceChooserController } from "./create-chooser-controller";
import {
  buildSourceListItems,
  CREATE_CHOOSER_PAGE_SIZE,
} from "./create-page-view-model";

export function useSourceChooserController(input: {
  onUploadSource(): void;
}): SourceChooserController {
  const [open, setOpen] = useState(false);
  const query = useWorkbooksInfiniteQuery(
    { limit: CREATE_CHOOSER_PAGE_SIZE, status: "valid" },
    { enabled: open },
  );
  const items = buildSourceListItems(
    query.data?.pages.flatMap((page) => page.workbooks) ?? [],
  );

  return {
    open,
    items,
    isInitialLoading: query.isLoading && items.length === 0,
    isLoadingMore: query.isFetchingNextPage,
    errorMessage:
      query.isError && items.length === 0
        ? "Some sources could not be loaded."
        : null,
    loadMoreErrorMessage:
      query.isFetchNextPageError && items.length > 0
        ? "More sources could not be loaded."
        : null,
    hasMore: Boolean(query.hasNextPage),
    onOpenChange: setOpen,
    onLoadMore: () => {
      void query.fetchNextPage();
    },
    onRetry: () => {
      if (items.length > 0) {
        void query.fetchNextPage();
        return;
      }
      void query.refetch();
    },
    onUploadSource: () => {
      setOpen(false);
      input.onUploadSource();
    },
  };
}
