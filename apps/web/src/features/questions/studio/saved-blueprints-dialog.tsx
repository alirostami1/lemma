import { AsyncPanel } from "@lemma/ui/components/async-panel";
import { Button } from "@lemma/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@lemma/ui/components/dialog";
import { EmptyState } from "@lemma/ui/components/empty-state";
import { InlineError } from "@lemma/ui/components/inline-error";
import { PaginatedList } from "@lemma/ui/components/paginated-list";
import {
  ResourceList,
  ResourceListItem,
} from "@lemma/ui/components/resource-list";
import { FolderOpen, PenLine } from "lucide-react";
import type { ReactNode } from "react";
import type {
  SavedBlueprintListItem,
  SavedDraftListItem,
} from "./saved-blueprints-view-model";

export type SavedBlueprintsDialogBlueprintAction = {
  label?: string;
  onEditAsDraft(id: string): void;
};

export type SavedBlueprintsDialogProps = {
  open: boolean;
  onOpenChange(open: boolean): void;
  drafts: SavedDraftListItem[];
  blueprints: SavedBlueprintListItem[];
  isDraftsInitialLoading: boolean;
  draftsErrorMessage: string | null;
  isInitialLoading: boolean;
  errorMessage: string | null;
  loadMoreErrorMessage: string | null;
  draftLoadMoreErrorMessage: string | null;
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

export function SavedBlueprintsDialog({
  open,
  onOpenChange,
  drafts,
  blueprints,
  isDraftsInitialLoading,
  draftsErrorMessage,
  isInitialLoading,
  errorMessage,
  loadMoreErrorMessage,
  draftLoadMoreErrorMessage,
  hasMoreBlueprints,
  hasMoreDrafts,
  isLoadingBlueprintsMore,
  isLoadingDraftsMore,
  onRetry,
  onLoadMoreDrafts,
  onLoadMoreBlueprints,
  onOpenDraft,
  blueprintAction,
}: SavedBlueprintsDialogProps) {
  const draftsDescription =
    drafts.length > 0
      ? `${drafts.length} recent draft${drafts.length === 1 ? "" : "s"}`
      : "Drafts in progress";
  const blueprintsDescription =
    blueprints.length > 0
      ? `${blueprints.length} saved blueprint${blueprints.length === 1 ? "" : "s"}`
      : "Published blueprints";

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Open</DialogTitle>
          <DialogDescription>
            Open a draft in progress or a saved blueprint to continue.
          </DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[65vh] gap-4 overflow-y-auto pr-1">
          <section
            aria-labelledby="recent-drafts-heading"
            className="grid gap-2"
          >
            <h2 className="text-sm font-medium" id="recent-drafts-heading">
              Recent drafts
            </h2>
            <p className="text-sm text-muted-foreground">{draftsDescription}</p>
            <AsyncPanel
              empty={<EmptyState description="No drafts yet." />}
              error={(message) => (
                <InlineError message={message} onRetry={onRetry} />
              )}
              errorMessage={draftsErrorMessage}
              isEmpty={drafts.length === 0}
              isLoading={isDraftsInitialLoading}
              loading={
                <p className="text-sm text-muted-foreground">
                  Loading recent drafts...
                </p>
              }
            >
              <PaginatedList
                hasMore={hasMoreDrafts}
                isLoadingMore={isLoadingDraftsMore}
                loadMoreErrorMessage={draftLoadMoreErrorMessage}
                onLoadMore={onLoadMoreDrafts}
                onRetryLoadMore={onLoadMoreDrafts}
              >
                <ResourceList variant="stacked">
                  {drafts.map((item) => (
                    <SavedBlueprintListRow
                      item={item}
                      key={item.id}
                      kind="draft"
                      onOpen={() => onOpenDraft(item.id)}
                    />
                  ))}
                </ResourceList>
              </PaginatedList>
            </AsyncPanel>
          </section>

          <section
            aria-labelledby="saved-blueprints-heading"
            className="grid gap-2"
          >
            <h2 className="text-sm font-medium" id="saved-blueprints-heading">
              Saved blueprints
            </h2>
            <p className="text-sm text-muted-foreground">
              {blueprintsDescription}
            </p>
            <AsyncPanel
              empty={<EmptyState description="No saved blueprints yet." />}
              error={(message) => (
                <InlineError message={message} onRetry={onRetry} />
              )}
              errorMessage={errorMessage}
              isEmpty={blueprints.length === 0}
              isLoading={isInitialLoading}
              loading={
                <p className="text-sm text-muted-foreground">
                  Loading saved blueprints...
                </p>
              }
            >
              <PaginatedList
                hasMore={hasMoreBlueprints}
                isLoadingMore={isLoadingBlueprintsMore}
                loadMoreErrorMessage={loadMoreErrorMessage}
                onLoadMore={onLoadMoreBlueprints}
                onRetryLoadMore={onLoadMoreBlueprints}
              >
                <ResourceList variant="stacked">
                  {blueprints.map((item) => (
                    <SavedBlueprintListRow
                      item={item}
                      key={item.id}
                      kind="blueprint"
                      primaryAction={getBlueprintRowAction(
                        item,
                        blueprintAction,
                      )}
                    />
                  ))}
                </ResourceList>
              </PaginatedList>
            </AsyncPanel>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SavedBlueprintListRow({
  item,
  onOpen,
  kind,
  primaryAction,
}: {
  item: SavedBlueprintListItem | SavedDraftListItem;
  onOpen?(): void;
  kind: "draft" | "blueprint";
  primaryAction?: {
    icon: ReactNode;
    label: string;
    onSelect(): void;
    variant?: "default" | "outline";
  };
}) {
  const openLabel = `Open draft ${item.title}`;
  const action =
    kind === "draft" && onOpen
      ? {
          icon: <FolderOpen />,
          label: openLabel,
          onSelect: onOpen,
          variant: "outline" as const,
        }
      : primaryAction;

  return (
    <ResourceListItem
      className="rounded-lg border bg-background"
      description={item.description ?? undefined}
      metadata={item.metadata}
      title={item.title}
      trailingAction={
        <div className="flex flex-wrap items-center gap-2">
          {action ? (
            <Button
              onClick={action.onSelect}
              size="sm"
              type="button"
              variant={action.variant}
            >
              {action.icon}
              {action.label}
            </Button>
          ) : null}
        </div>
      }
      variant="display"
    />
  );
}

function getBlueprintRowAction(
  item: SavedBlueprintListItem,
  action: SavedBlueprintsDialogBlueprintAction,
) {
  return {
    icon: <PenLine />,
    label: action.label ?? `Edit as draft ${item.title}`,
    onSelect: () => action.onEditAsDraft(item.id),
    variant: "outline" as const,
  };
}
