import type { ReactNode } from "react";
import { Button } from "#components/button";
import { InlineError } from "#components/inline-error";

export type PaginatedListProps = {
  children: ReactNode;
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMoreErrorMessage: string | null;
  onLoadMore(): void;
  onRetryLoadMore(): void;
};

function PaginatedList({
  children,
  hasMore,
  isLoadingMore,
  loadMoreErrorMessage,
  onLoadMore,
  onRetryLoadMore,
}: PaginatedListProps) {
  return (
    <div className="grid gap-3">
      {children}
      {loadMoreErrorMessage ? (
        <InlineError message={loadMoreErrorMessage} onRetry={onRetryLoadMore} />
      ) : null}
      {hasMore && !loadMoreErrorMessage ? (
        <Button
          disabled={isLoadingMore}
          onClick={onLoadMore}
          type="button"
          variant="outline"
        >
          {isLoadingMore ? "Loading more..." : "Load more"}
        </Button>
      ) : null}
    </div>
  );
}

export { PaginatedList };
