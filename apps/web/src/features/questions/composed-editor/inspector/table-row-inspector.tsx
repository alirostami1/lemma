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
            disabled={disabled}
            id={`${row.id}-label`}
            onChange={(event) =>
              onModelChange(
                updateTableRowLabel(model, row.id, event.currentTarget.value),
              )
            }
            value={row.label}
          />
        </InspectorField>
      </InspectorSection>
      <InspectorSection title="Row actions">
        <div className="grid grid-cols-2 gap-2">
          <Button
            disabled={disabled || rowIndex === 0}
            onClick={() => onModelChange(moveRowUp(model, row.id))}
            type="button"
            variant="outline"
          >
            <ArrowUp />
            Up
          </Button>
          <Button
            disabled={disabled || rowIndex === model.rows.length - 1}
            onClick={() => onModelChange(moveRowDown(model, row.id))}
            type="button"
            variant="outline"
          >
            <ArrowDown />
            Down
          </Button>
        </div>
        <Button
          disabled={disabled}
          onClick={() => {
            onModelChange(deleteTableRow(model, row.id));
            onSelectionChange({ type: "table" });
          }}
          type="button"
          variant="destructive"
        >
          <Trash2 />
          Delete row
        </Button>
      </InspectorSection>
    </div>
  );
}
