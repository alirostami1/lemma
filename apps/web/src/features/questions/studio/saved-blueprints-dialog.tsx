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
import { FolderOpen, Sparkles } from "lucide-react";
import type {
  SavedBlueprintListItem,
  SavedDraftListItem,
} from "./saved-blueprints-view-model";

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
  onOpenBlueprint(id: string): void;
  onGenerate(id: string): void;
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
  onOpenBlueprint,
  onGenerate,
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
              empty={
                <EmptyState description="No saved blueprints yet. Save your first blueprint to generate questions from it." />
              }
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
                      onGenerate={() => onGenerate(item.id)}
                      onOpen={() => onOpenBlueprint(item.id)}
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
  onGenerate,
  kind,
}: {
  item: SavedBlueprintListItem | SavedDraftListItem;
  onOpen(): void;
  onGenerate?(): void;
  kind: "draft" | "blueprint";
}) {
  const openLabel =
    kind === "draft"
      ? `Open draft ${item.title}`
      : `Open blueprint ${item.title}`;
  const generateLabel = `Generate from ${item.title}`;

  return (
    <ResourceListItem
      className="rounded-lg border bg-background"
      description={item.description ?? undefined}
      metadata={item.metadata}
      variant="display"
      title={item.title}
      trailingAction={
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={onOpen} size="sm" type="button" variant="outline">
            <FolderOpen />
            {openLabel}
          </Button>
          {onGenerate ? (
            <Button onClick={onGenerate} size="sm" type="button">
              <Sparkles />
              {generateLabel}
            </Button>
          ) : null}
        </div>
      }
    />
  );
}
