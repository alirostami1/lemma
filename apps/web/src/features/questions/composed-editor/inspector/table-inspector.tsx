import { Button } from "@lemma/ui/components/button";
import { FieldGroup } from "@lemma/ui/components/field";
import { Plus, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import type {
  ComposedEditorModel,
  ReferenceSourceDraft,
  TableEditorModel,
} from "#/domains/questions/authoring";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import {
  addTableColumn,
  addTableRow,
  applyWorkbookRangeReferenceToTableBlock,
  resetTableLayout,
  updateTableLayout,
} from "#/features/questions/table-block-editor";
import { InspectorSwitchField } from "./inspector-field";
import { InspectorSection } from "./inspector-section";
import { ReferencePickerPopover } from "./reference-picker-popover";
import type { TableEditorSelection } from "./table-editor-selection";
import { getTableRangePreviewViewModel } from "./table-range-preview-view-model";

export function TableInspector({
  blockId,
  model,
  editorModel,
  referencePreviewCache,
  workbookEnabled,
  activeSourceId,
  disabled,
  onModelChange,
  onEditorModelChange,
  onSelectionChange,
}: {
  blockId: string;
  model: TableEditorModel;
  editorModel: ComposedEditorModel;
  referencePreviewCache: ReferencePreviewCache;
  workbookEnabled: boolean;
  activeSourceId: string | null;
  disabled?: boolean;
  onModelChange(model: TableEditorModel): void;
  onEditorModelChange(model: ComposedEditorModel): void;
  onSelectionChange(selection: TableEditorSelection): void;
}) {
  const [selectedRangeReferenceId, setSelectedRangeReferenceId] = useState<
    string | null
  >(null);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const selectedReference = useMemo(
    () =>
      selectedRangeReferenceId
        ? (editorModel.references.find(
            (reference) => reference.id === selectedRangeReferenceId,
          ) ?? null)
        : null,
    [editorModel.references, selectedRangeReferenceId],
  );
  const selectedPreview = selectedRangeReferenceId
    ? (referencePreviewCache[selectedRangeReferenceId] ?? null)
    : null;
  const selectedPreviewViewModel =
    getTableRangePreviewViewModel(selectedPreview);
  const canApplyRange =
    Boolean(selectedReference) && selectedPreviewViewModel.status === "ready";

  return (
    <div className="grid gap-4">
      <InspectorSection title="Layout">
        <FieldGroup>
          <InspectorSwitchField
            label="Show column labels"
            description="Display column labels above the table."
            checked={model.showColumnNames}
            disabled={disabled}
            onCheckedChange={(checked) =>
              onModelChange(
                updateTableLayout(model, {
                  showColumnNames: checked,
                  showRowNames: model.showRowNames,
                }),
              )
            }
          />
          <InspectorSwitchField
            label="Show row labels"
            description="Display row labels beside the table."
            checked={model.showRowNames}
            disabled={disabled}
            onCheckedChange={(checked) =>
              onModelChange(
                updateTableLayout(model, {
                  showColumnNames: model.showColumnNames,
                  showRowNames: checked,
                }),
              )
            }
          />
        </FieldGroup>
      </InspectorSection>
      <InspectorSection title="Source range">
        <ReferencePickerPopover
          model={editorModel}
          selectedReferenceId={selectedRangeReferenceId ?? undefined}
          referencePreviewCache={referencePreviewCache}
          workbookEnabled={workbookEnabled}
          activeSourceId={activeSourceId}
          disabled={disabled}
          allowedSourceTypes={["workbook_range"]}
          createSourceTypeDefault="workbook_range"
          defaultMode={selectedRangeReferenceId ? "existing" : "create"}
          onModelChange={onEditorModelChange}
          onSelectReference={(referenceId) => {
            setRangeError(null);
            setSelectedRangeReferenceId(referenceId);
          }}
          trigger={
            <Button type="button" variant="outline" disabled={disabled}>
              Choose range reference
            </Button>
          }
        />
        {selectedReference ? (
          <RangePreview
            reference={selectedReference}
            preview={selectedPreview}
          />
        ) : (
          <p className="text-xs text-muted-foreground">
            Select a workbook to preview this range.
          </p>
        )}
        {rangeError ? (
          <p className="text-xs text-destructive">{rangeError}</p>
        ) : null}
        <Button
          type="button"
          disabled={disabled || !canApplyRange}
          onClick={() => {
            if (!selectedReference) {
              return;
            }

            const result = applyWorkbookRangeReferenceToTableBlock({
              editorModel,
              tableBlockId: blockId,
              rangeReferenceId: selectedReference.id,
              referencePreviewCache,
            });

            if (result.ok) {
              setRangeError(null);
              onEditorModelChange(result.model);
              onSelectionChange({ type: "table" });
              return;
            }

            setRangeError(result.message);
          }}
        >
          <Plus />
          Create table from range
        </Button>
      </InspectorSection>
      <InspectorSection title="Table actions">
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={() => {
              const nextModel = addTableRow(model);
              onModelChange(nextModel);
              const row = nextModel.rows.at(-1);
              if (row) {
                onSelectionChange({ type: "row", rowId: row.id });
              }
            }}
          >
            <Plus />
            Row
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={() => {
              const nextModel = addTableColumn(model);
              onModelChange(nextModel);
              const column = nextModel.columns.at(-1);
              if (column) {
                onSelectionChange({ type: "column", columnId: column.id });
              }
            }}
          >
            <Plus />
            Column
          </Button>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => onModelChange(resetTableLayout(model))}
        >
          <RotateCcw />
          Reset layout
        </Button>
      </InspectorSection>
    </div>
  );
}

function RangePreview({
  reference,
  preview,
}: {
  reference: {
    id: string;
    source: ReferenceSourceDraft;
  };
  preview: NonNullable<ReferencePreviewCache[string]> | null;
}) {
  if (reference.source.type !== "workbook_range") {
    return (
      <p className="text-xs text-destructive">
        Selected source is not a workbook range.
      </p>
    );
  }

  const viewModel = getTableRangePreviewViewModel(preview);
  if (viewModel.status !== "ready") {
    return (
      <p
        className={
          viewModel.status === "not_ready"
            ? "text-xs text-muted-foreground"
            : "text-xs text-destructive"
        }
      >
        {viewModel.message}
      </p>
    );
  }
  return (
    <div className="grid gap-1">
      <p className="text-xs text-muted-foreground">
        {viewModel.rowCount} x {viewModel.columnCount} range
      </p>
      <p className="text-xs text-muted-foreground">{viewModel.displayValue}</p>
    </div>
  );
}
