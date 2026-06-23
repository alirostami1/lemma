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
  getReferenceSourceLabel,
  getReferenceSourceSummary,
} from "./reference-inspector-helpers";
import { ReferencePickerPopover } from "./reference-picker-popover";

export function ReferencesTab({
  model,
  selection,
  referencePreviewCache,
  workbookEnabled,
  sources,
  workbookSheetNamesBySourceId,
  disabled,
  onModelChange,
  onSelectionChange,
}: {
  model: ComposedEditorModel;
  selection: EditorSelection;
  referencePreviewCache: ReferencePreviewCache;
  workbookEnabled: boolean;
  sources: QuestionBlueprintWorkbookSource[];
  workbookSheetNamesBySourceId?: Readonly<Record<string, readonly string[]>>;
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
  const selectedReferenceSourceLabel = selectedReference
    ? getReferenceSourceLabel(selectedReference)
    : null;

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">References</h3>
        <ReferencePickerPopover
          defaultMode="create"
          disabled={disabled}
          model={model}
          onModelChange={onModelChange}
          onSelectReference={(referenceId) => {
            setSelectedReferenceId(referenceId);
            onSelectionChange({ referenceId, type: "reference" });
          }}
          referencePreviewCache={referencePreviewCache}
          selectedReferenceId={
            selection.type === "reference" ? selection.referenceId : undefined
          }
          sources={sources}
          trigger={
            <Button disabled={disabled} size="sm" type="button">
              <Plus />
              Add reference
            </Button>
          }
          workbookEnabled={workbookEnabled}
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
                className={cn(
                  "flex w-full items-start justify-between gap-3 rounded-lg border bg-background p-3 text-left transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected && "border-primary bg-muted/40",
                )}
                key={reference.id}
                onClick={() => {
                  setSelectedReferenceId(reference.id);
                  onSelectionChange({
                    referenceId: reference.id,
                    type: "reference",
                  });
                }}
                type="button"
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
                    preview={preview}
                    reference={reference}
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
            <Badge variant="outline">{selectedReferenceSourceLabel}</Badge>
          </div>
          <ReferenceEditor
            disabled={disabled}
            model={model}
            onModelChange={onModelChange}
            onSelectionChange={onSelectionChange}
            preview={referencePreviewCache[selectedReference.id]}
            referenceId={selectedReference.id}
            sources={sources}
            workbookEnabled={workbookEnabled}
            workbookSheetNamesBySourceId={workbookSheetNamesBySourceId}
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
