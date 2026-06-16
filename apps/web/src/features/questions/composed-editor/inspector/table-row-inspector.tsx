import { Button } from "@lemma/ui/components/button";
import { Input } from "@lemma/ui/components/input";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import type { TableEditorModel } from "#/domains/questions/authoring";
import {
  deleteTableRow,
  moveRowDown,
  moveRowUp,
  updateTableRowLabel,
} from "#/features/questions/table-block-editor";
import { InspectorField } from "./inspector-field";
import { InspectorSection } from "./inspector-section";
import type { TableEditorSelection } from "./table-editor-selection";

export function TableRowInspector({
  model,
  rowId,
  disabled,
  onModelChange,
  onSelectionChange,
}: {
  model: TableEditorModel;
  rowId: string;
  disabled?: boolean;
  onModelChange(model: TableEditorModel): void;
  onSelectionChange(selection: TableEditorSelection): void;
}) {
  const row = model.rows.find((candidate) => candidate.id === rowId);
  if (!row) {
    return <p className="text-sm text-muted-foreground">Select a row.</p>;
  }

  const rowIndex = model.rows.findIndex((candidate) => candidate.id === row.id);

  return (
    <div className="grid gap-5">
      <InspectorSection title="Row">
        <InspectorField label="Label">
          <Input
            id={`${row.id}-label`}
            value={row.label}
            disabled={disabled}
            onChange={(event) =>
              onModelChange(
                updateTableRowLabel(model, row.id, event.currentTarget.value),
              )
            }
          />
        </InspectorField>
      </InspectorSection>
      <InspectorSection title="Row actions">
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={disabled || rowIndex === 0}
            onClick={() => onModelChange(moveRowUp(model, row.id))}
          >
            <ArrowUp />
            Up
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={disabled || rowIndex === model.rows.length - 1}
            onClick={() => onModelChange(moveRowDown(model, row.id))}
          >
            <ArrowDown />
            Down
          </Button>
        </div>
        <Button
          type="button"
          variant="destructive"
          disabled={disabled}
          onClick={() => {
            onModelChange(deleteTableRow(model, row.id));
            onSelectionChange({ type: "table" });
          }}
        >
          <Trash2 />
          Delete row
        </Button>
      </InspectorSection>
    </div>
  );
}
