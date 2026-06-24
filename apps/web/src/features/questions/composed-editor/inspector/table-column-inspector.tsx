import { Button } from "@lemma/ui/components/button";
import { Input } from "@lemma/ui/components/input";
import { ArrowLeft, ArrowRight, Trash2 } from "lucide-react";
import type { TableEditorModel } from "#/domains/questions/authoring";
import {
  deleteTableColumn,
  moveColumnLeft,
  moveColumnRight,
  updateTableColumnLabel,
} from "#/features/questions/table-block-editor";
import { InspectorField } from "./inspector-field";
import { InspectorSection } from "./inspector-section";
import type { TableEditorSelection } from "./table-editor-selection";

export function TableColumnInspector({
  model,
  columnId,
  disabled,
  onModelChange,
  onSelectionChange,
}: {
  model: TableEditorModel;
  columnId: string;
  disabled?: boolean;
  onModelChange(model: TableEditorModel): void;
  onSelectionChange(selection: TableEditorSelection): void;
}) {
  const column = model.columns.find((candidate) => candidate.id === columnId);
  if (!column) {
    return <p className="text-sm text-muted-foreground">Select a column.</p>;
  }

  const columnIndex = model.columns.findIndex(
    (candidate) => candidate.id === column.id,
  );

  return (
    <div className="grid gap-5">
      <InspectorSection title="Column">
        <InspectorField label="Label">
          <Input
            disabled={disabled}
            id={`${column.id}-label`}
            onChange={(event) =>
              onModelChange(
                updateTableColumnLabel(
                  model,
                  column.id,
                  event.currentTarget.value,
                ),
              )
            }
            value={column.label}
          />
        </InspectorField>
      </InspectorSection>
      <InspectorSection title="Column actions">
        <div className="grid grid-cols-2 gap-2">
          <Button
            disabled={disabled || columnIndex === 0}
            onClick={() => onModelChange(moveColumnLeft(model, column.id))}
            type="button"
            variant="outline"
          >
            <ArrowLeft />
            Left
          </Button>
          <Button
            disabled={disabled || columnIndex === model.columns.length - 1}
            onClick={() => onModelChange(moveColumnRight(model, column.id))}
            type="button"
            variant="outline"
          >
            <ArrowRight />
            Right
          </Button>
        </div>
        <Button
          disabled={disabled}
          onClick={() => {
            onModelChange(deleteTableColumn(model, column.id));
            onSelectionChange({ type: "table" });
          }}
          type="button"
          variant="destructive"
        >
          <Trash2 />
          Delete column
        </Button>
      </InspectorSection>
    </div>
  );
}
