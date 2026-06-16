import type { ReactNode } from "react";
import { Button } from "#/components/ui/button";
import { InlineError } from "#/components/ui/inline-error";

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
        <InlineError
          message={loadMoreErrorMessage}
          onRetry={onRetryLoadMore}
        />
      ) : null}
      {hasMore && !loadMoreErrorMessage ? (
        <Button
          type="button"
          variant="outline"
          disabled={isLoadingMore}
          onClick={onLoadMore}
        >
          {isLoadingMore ? "Loading more..." : "Load more"}
        </Button>
      ) : null}
    </div>
  );
}

export { PaginatedList };
