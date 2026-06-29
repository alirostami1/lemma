import { Button } from "@lemma/ui/components/button";
import { FieldGroup } from "@lemma/ui/components/field";
import { Plus, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import type {
  ComposedEditorModel,
  ReferenceSourceDraft,
  TableEditorModel,
} from "#/domains/questions/authoring";
import type { QuestionBlueprintWorkbookSource } from "#/domains/questions/model";
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
  sources,
  workbookSheetNamesBySourceId,
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
  sources: QuestionBlueprintWorkbookSource[];
  workbookSheetNamesBySourceId?: Readonly<Record<string, readonly string[]>>;
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
            checked={model.showColumnNames}
            description="Display column labels above the table."
            disabled={disabled}
            label="Show column labels"
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
            checked={model.showRowNames}
            description="Display row labels beside the table."
            disabled={disabled}
            label="Show row labels"
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
      <InspectorSection title="Workbook range">
        <ReferencePickerPopover
          allowedSourceTypes={["workbook_range"]}
          createSourceTypeDefault="workbook_range"
          disabled={disabled}
          model={editorModel}
          onModelChange={onEditorModelChange}
          onSelectReference={(referenceId) => {
            setRangeError(null);
            setSelectedRangeReferenceId(referenceId);
          }}
          referencePreviewCache={referencePreviewCache}
          sources={sources}
          trigger={
            <Button disabled={disabled} type="button" variant="outline">
              Add reference
            </Button>
          }
          workbookEnabled={workbookEnabled}
          workbookSheetNamesBySourceId={workbookSheetNamesBySourceId}
        />
        {selectedReference ? (
          <RangePreview
            preview={selectedPreview}
            reference={selectedReference}
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
          disabled={disabled || !canApplyRange}
          onClick={() => {
            if (!selectedReference) {
              return;
            }

            const result = applyWorkbookRangeReferenceToTableBlock({
              editorModel,
              rangeReferenceId: selectedReference.id,
              referencePreviewCache,
              tableBlockId: blockId,
            });

            if (result.ok) {
              setRangeError(null);
              onEditorModelChange(result.model);
              onSelectionChange({ type: "table" });
              return;
            }

            setRangeError(result.message);
          }}
          type="button"
        >
          <Plus />
          Create table from range
        </Button>
      </InspectorSection>
      <InspectorSection title="Table actions">
        <div className="grid grid-cols-2 gap-2">
          <Button
            disabled={disabled}
            onClick={() => {
              const nextModel = addTableRow(model);
              onModelChange(nextModel);
              const row = nextModel.rows.at(-1);
              if (row) {
                onSelectionChange({ rowId: row.id, type: "row" });
              }
            }}
            type="button"
            variant="outline"
          >
            <Plus />
            Row
          </Button>
          <Button
            disabled={disabled}
            onClick={() => {
              const nextModel = addTableColumn(model);
              onModelChange(nextModel);
              const column = nextModel.columns.at(-1);
              if (column) {
                onSelectionChange({ columnId: column.id, type: "column" });
              }
            }}
            type="button"
            variant="outline"
          >
            <Plus />
            Column
          </Button>
        </div>
        <Button
          disabled={disabled}
          onClick={() => onModelChange(resetTableLayout(model))}
          type="button"
          variant="outline"
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
        Chosen reference is not a workbook range.
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
