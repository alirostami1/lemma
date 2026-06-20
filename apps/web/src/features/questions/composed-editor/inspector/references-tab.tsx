import { Badge } from "@lemma/ui/components/badge";
import { Button } from "@lemma/ui/components/button";
import { cn } from "@lemma/ui/lib/utils";
import { Pencil, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import type { QuestionBlueprintWorkbookSource } from "#/domains/questions/model";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import type { EditorSelection } from "../editor-selection";
import { ReferenceEditor } from "./reference-editor";
import {
  getReferenceDisplayName,
  getReferenceSourceSummary,
} from "./reference-inspector-helpers";
import { ReferencePickerPopover } from "./reference-picker-popover";

export function ReferencesTab({
  model,
  selection,
  referencePreviewCache,
  workbookEnabled,
  sources,
  previewSourceId,
  disabled,
  onModelChange,
  onSelectionChange,
}: {
  model: ComposedEditorModel;
  selection: EditorSelection;
  referencePreviewCache: ReferencePreviewCache;
  workbookEnabled: boolean;
  sources: QuestionBlueprintWorkbookSource[];
  previewSourceId: string | null;
  disabled?: boolean;
  onModelChange(model: ComposedEditorModel): void;
  onSelectionChange(selection: EditorSelection): void;
}) {
  const [selectedReferenceId, setSelectedReferenceId] = useState<string | null>(
    selection.type === "reference" ? selection.referenceId : null,
  );

  useEffect(() => {
    if (selection.type === "reference") {
      setSelectedReferenceId(selection.referenceId);
    }
  }, [selection]);

  useEffect(() => {
    if (model.references.length === 0) {
      setSelectedReferenceId(null);
      return;
    }

    if (
      !selectedReferenceId ||
      !model.references.some(
        (reference) => reference.id === selectedReferenceId,
      )
    ) {
      setSelectedReferenceId(model.references[0]?.id ?? null);
    }
  }, [model.references, selectedReferenceId]);

  const selectedReference = selectedReferenceId
    ? (model.references.find(
        (reference) => reference.id === selectedReferenceId,
      ) ?? null)
    : null;

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">References</h3>
        <ReferencePickerPopover
          model={model}
          selectedReferenceId={
            selection.type === "reference" ? selection.referenceId : undefined
          }
          referencePreviewCache={referencePreviewCache}
          workbookEnabled={workbookEnabled}
          sources={sources}
          previewSourceId={previewSourceId}
          disabled={disabled}
          defaultMode="create"
          onModelChange={onModelChange}
          onSelectReference={(referenceId) => {
            setSelectedReferenceId(referenceId);
            onSelectionChange({ type: "reference", referenceId });
          }}
          trigger={
            <Button type="button" size="sm" disabled={disabled}>
              <Plus />
              Add reference
            </Button>
          }
        />
      </div>

      {model.references.length === 0 ? (
        <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          No references yet.
        </div>
      ) : (
        <div className="grid gap-2">
          {model.references.map((reference) => {
            const preview = referencePreviewCache[reference.id];
            const selected = selectedReferenceId === reference.id;

            return (
              <button
                key={reference.id}
                type="button"
                className={cn(
                  "flex w-full items-start justify-between gap-3 rounded-lg border bg-background p-3 text-left transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected && "border-primary bg-muted/40",
                )}
                onClick={() => {
                  setSelectedReferenceId(reference.id);
                  onSelectionChange({
                    type: "reference",
                    referenceId: reference.id,
                  });
                }}
              >
                <span className="grid min-w-0 gap-1">
                  <span className="truncate text-sm font-medium">
                    {getReferenceDisplayName(reference)}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {getReferenceSourceSummary(reference, sources)}
                    {preview?.status === "resolved"
                      ? ` | ${preview.displayValue}`
                      : ""}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <ReferenceStatusBadge
                    reference={reference}
                    preview={preview}
                  />
                  <Pencil className="size-4 text-muted-foreground" />
                </span>
              </button>
            );
          })}
        </div>
      )}

      {selectedReference ? (
        <section className="grid gap-3 rounded-lg border bg-background p-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Selected reference</h3>
            <Badge variant="outline">
              {getReferenceSourceLabel(selectedReference)}
            </Badge>
          </div>
          <ReferenceEditor
            model={model}
            referenceId={selectedReference.id}
            preview={referencePreviewCache[selectedReference.id]}
            workbookEnabled={workbookEnabled}
            sources={sources}
            previewSourceId={previewSourceId}
            disabled={disabled}
            onModelChange={onModelChange}
            onSelectionChange={onSelectionChange}
          />
        </section>
      ) : null}
    </div>
  );
}

function ReferenceStatusBadge({
  reference,
  preview,
}: {
  reference: ComposedEditorModel["references"][number];
  preview: ReferencePreviewCache[string] | undefined;
}) {
  if (preview?.status === "error") {
    return <Badge variant="destructive">Error</Badge>;
  }

  if (preview?.status === "resolved" || reference.source.type === "literal") {
    return <Badge variant="secondary">Ready</Badge>;
  }

  return <Badge variant="outline">Needs source</Badge>;
}
