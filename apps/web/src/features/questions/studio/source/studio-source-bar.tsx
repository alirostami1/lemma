import { Button } from "@lemma/ui/components/button";
import {
  AlertTriangle,
  FileSpreadsheet,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import type { StudioSourceViewState } from "./source-state";

export function StudioSourceBar({
  sourceCard,
  onAddSource,
  onChangeSource,
  onRemoveSource,
}: {
  sourceCard: StudioSourceViewState;
  onAddSource(): void;
  onChangeSource(): void;
  onRemoveSource(): void;
}) {
  const sources = sourceCard.sources ?? [];
  const activeSourceId = sourceCard.activeSourceId ?? null;
  const onActivateSourceId = sourceCard.onActivateSourceId;
  const icon =
    sourceCard.status === "required_missing" ||
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
              <div className="mt-1 flex flex-wrap gap-1">
                {sources.map((source) => (
                  <button
                    type="button"
                    key={source.sourceId}
                    className={
                      source.sourceId === activeSourceId
                        ? "rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary"
                        : "rounded border bg-muted/40 px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted"
                    }
                    disabled={
                      !onActivateSourceId || source.sourceId === activeSourceId
                    }
                    onClick={() => onActivateSourceId?.(source.sourceId)}
                    title={source.workbookName ?? source.sourceName}
                  >
                    {source.sourceName}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {sourceCard.status === "not_required_empty" ||
          sourceCard.status === "required_missing" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onAddSource}
            >
              <Plus />
              Attach source
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onChangeSource}
              >
                <Upload />
                Attach source
              </Button>
              {sourceCard.canRemove ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onRemoveSource}
                >
                  <Trash2 />
                  Remove source
                </Button>
              ) : null}
            </>
          )}
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
