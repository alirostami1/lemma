import { Button } from "@lemma/ui/components/button";
import {
  AlertTriangle,
  FileSpreadsheet,
  Plus,
  Trash2,
} from "lucide-react";
import type { StudioSourceViewState } from "./source-state";

export function StudioSourceBar({
  sourceCard,
  onAddSource,
  onPreviewSourceChange,
  onRemoveSource,
}: {
  sourceCard: StudioSourceViewState;
  onAddSource(): void;
  onPreviewSourceChange(sourceId: string): void;
  onRemoveSource(sourceId: string): void;
}) {
  const sources = sourceCard.sources ?? [];
  const icon =
    sourceCard.status === "loading" ||
    sourceCard.status === "invalid" ||
    sourceCard.status === "error" ? (
      <AlertTriangle className="size-4 text-destructive" />
    ) : (
      <FileSpreadsheet className="size-4 text-muted-foreground" />
    );

  return (
    <section className="rounded-lg border bg-background/95 shadow-sm">
      <div className="flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          {icon}
          <div className="grid min-w-0 gap-0.5">
            <h2 className="truncate text-sm font-medium">{sourceCard.title}</h2>
            <p className="text-xs text-muted-foreground md:truncate">
              {sourceCard.description}
            </p>
            {sources.length > 0 ? (
              <div className="mt-1 flex flex-wrap gap-2">
                {sources.map((source) => {
                  const selected = source.sourceId === sourceCard.previewSourceId;
                  return (
                    <div key={source.sourceId} className="flex items-center gap-1">
                      <button
                        type="button"
                        className={
                          selected
                            ? "grid rounded border border-primary/40 bg-primary/10 px-2 py-1 text-left text-[11px] font-medium text-primary"
                            : "grid rounded border bg-muted/40 px-2 py-1 text-left text-[11px] text-muted-foreground hover:bg-muted"
                        }
                        title={source.name}
                        onClick={() => onPreviewSourceChange(source.sourceId)}
                      >
                        <span className="truncate">{source.name}</span>
                        {source.removeIssue ? (
                          <span className="truncate text-[10px] text-destructive">
                            {source.removeIssue}
                          </span>
                        ) : (
                          <span className="truncate text-[10px] text-muted-foreground">
                            {selected ? "Preview source" : "Attached source"}
                          </span>
                        )}
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        disabled={!source.canRemove}
                        title={source.removeIssue ?? "Remove source"}
                        onClick={() => onRemoveSource(source.sourceId)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAddSource}
          >
            <Plus />
            Add local source
          </Button>
        </div>
      </div>
      {"issue" in sourceCard ? (
        <p className="border-t px-3 py-2 text-sm text-destructive">
          {sourceCard.issue}
        </p>
      ) : null}
    </section>
  );
}
