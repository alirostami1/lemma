import { AsyncPanel } from "@lemma/ui/components/async-panel";
import { EmptyState } from "@lemma/ui/components/empty-state";
import { InlineError } from "@lemma/ui/components/inline-error";
import { PaginatedList } from "@lemma/ui/components/paginated-list";
import type { CreateLauncherListItem } from "./create-page-view-model";
import {
  CreateLauncherItemList,
  CreateRecentListSkeleton,
} from "./create-page-sections";

export function CreatePaginatedList({
  items,
  isInitialLoading,
  isLoadingMore,
  errorMessage,
  loadMoreErrorMessage,
  hasMore,
  emptyMessage,
  onLoadMore,
  onRetry,
}: {
  items: CreateLauncherListItem[];
  isInitialLoading: boolean;
  isLoadingMore: boolean;
  errorMessage: string | null;
  loadMoreErrorMessage: string | null;
  hasMore: boolean;
  emptyMessage: string;
  onLoadMore(): void;
  onRetry(): void;
}) {
  return (
    <AsyncPanel
      isLoading={isInitialLoading}
      errorMessage={errorMessage}
      isEmpty={items.length === 0}
      loading={<CreateRecentListSkeleton />}
      error={(message) => <InlineError message={message} onRetry={onRetry} />}
      empty={<EmptyState description={emptyMessage} />}
    >
      <PaginatedList
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        loadMoreErrorMessage={loadMoreErrorMessage}
        onLoadMore={onLoadMore}
        onRetryLoadMore={onRetry}
      >
        <CreateLauncherItemList items={items} />
      </PaginatedList>
    </AsyncPanel>
  );
}
