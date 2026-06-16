import { Button } from "@lemma/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@lemma/ui/components/dialog";
import { AsyncPanel } from "@lemma/ui/components/async-panel";
import { EmptyState } from "@lemma/ui/components/empty-state";
import { InlineError } from "@lemma/ui/components/inline-error";
import { PaginatedList } from "@lemma/ui/components/paginated-list";
import {
  ResourceList,
  ResourceListItem,
} from "@lemma/ui/components/resource-list";
import { Link } from "@tanstack/react-router";
import { FolderOpen, Sparkles } from "lucide-react";
import type { SavedBlueprintListItem } from "./saved-blueprints-view-model";

export type SavedBlueprintsDialogProps = {
  open: boolean;
  onOpenChange(open: boolean): void;
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

export function SavedBlueprintsDialog({
  open,
  onOpenChange,
  items,
  isInitialLoading,
  errorMessage,
  loadMoreErrorMessage,
  hasMore,
  isLoadingMore,
  onRetry,
  onLoadMore,
  onOpenBlueprint,
  onGenerate,
}: SavedBlueprintsDialogProps) {
  const description =
    items.length > 0
      ? `${items.length} saved blueprint${items.length === 1 ? "" : "s"}`
      : "No saved blueprints yet.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Saved blueprints</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[65vh] gap-4 overflow-y-auto pr-1">
          <AsyncPanel
            isLoading={isInitialLoading}
            errorMessage={errorMessage}
            isEmpty={items.length === 0}
            loading={
              <p className="text-sm text-muted-foreground">
                Loading saved blueprints...
              </p>
            }
            error={(message) => (
              <EmptyState
                description={message}
                action={
                  <Button type="button" variant="outline" onClick={onRetry}>
                    Retry
                  </Button>
                }
              />
            )}
            empty={
              <EmptyState description="No saved blueprints yet. Save your first blueprint to generate questions from it." />
            }
          >
            <PaginatedList
              hasMore={hasMore}
              isLoadingMore={isLoadingMore}
              loadMoreErrorMessage={loadMoreErrorMessage}
              onLoadMore={onLoadMore}
              onRetryLoadMore={onLoadMore}
            >
              <ResourceList variant="stacked">
                {items.map((item) => (
                  <SavedBlueprintListRow
                    key={item.id}
                    item={item}
                    onOpenBlueprint={() => onOpenBlueprint(item.id)}
                    onGenerate={() => onGenerate(item.id)}
                  />
                ))}
              </ResourceList>
            </PaginatedList>
          </AsyncPanel>
          {errorMessage && items.length > 0 ? (
            <InlineError
              message="Saved blueprints could not be refreshed."
              onRetry={onRetry}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SavedBlueprintListRow({
  item,
  onOpenBlueprint,
  onGenerate,
}: {
  item: SavedBlueprintListItem;
  onOpenBlueprint(): void;
  onGenerate(): void;
}) {
  return (
    <ResourceListItem
      variant="display"
      className="rounded-lg border bg-background"
      title={item.title}
      description={item.description ?? undefined}
      metadata={item.metadata}
      trailingAction={
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link
              to="/studio"
              search={{ blueprintId: item.id }}
              onClick={onOpenBlueprint}
            >
              <FolderOpen />
              Open blueprint
            </Link>
          </Button>
          <Button type="button" size="sm" onClick={onGenerate}>
            <Sparkles />
            Generate
          </Button>
        </div>
      }
    />
  );
}
