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
                Replace source
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
