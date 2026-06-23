import { Button } from "@lemma/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@lemma/ui/components/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import type { TableEditorModel } from "#/domains/questions/authoring";
import {
  addTableColumn,
  addTableRow,
  deleteTableColumn,
  deleteTableRow,
  makeContentCell,
  makeResponseCell,
  moveColumnLeft,
  moveColumnRight,
  moveRowDown,
  moveRowUp,
} from "./table-editor-operations";
import type { TableEditorSelection } from "./table-selection";

export function TableContextMenu({
  model,
  selection,
  disabled,
  onModelChange,
  onSelectionChange,
}: {
  model: TableEditorModel;
  selection: TableEditorSelection;
  disabled?: boolean;
  onModelChange(model: TableEditorModel): void;
  onSelectionChange(selection: TableEditorSelection): void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="Open table actions"
          disabled={disabled}
          size="icon"
          type="button"
          variant="ghost"
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {selection.type === "table" ? (
          <>
            <DropdownMenuItem
              onSelect={() => {
                const nextModel = addTableRow(model);
                onModelChange(nextModel);
                const row = nextModel.rows.at(-1);
                if (row) {
                  onSelectionChange({ rowId: row.id, type: "row" });
                }
              }}
            >
              Add row
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                const nextModel = addTableColumn(model);
                onModelChange(nextModel);
                const column = nextModel.columns.at(-1);
                if (column) {
                  onSelectionChange({ columnId: column.id, type: "column" });
                }
              }}
            >
              Add column
            </DropdownMenuItem>
          </>
        ) : null}
        {selection.type === "row" ? (
          <>
            <DropdownMenuItem
              onSelect={() => onModelChange(moveRowUp(model, selection.rowId))}
            >
              Move up
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                onModelChange(moveRowDown(model, selection.rowId))
              }
            >
              Move down
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                onModelChange(deleteTableRow(model, selection.rowId));
                onSelectionChange({ type: "table" });
              }}
            >
              Delete row
            </DropdownMenuItem>
          </>
        ) : null}
        {selection.type === "column" ? (
          <>
            <DropdownMenuItem
              onSelect={() =>
                onModelChange(moveColumnLeft(model, selection.columnId))
              }
            >
              Move left
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                onModelChange(moveColumnRight(model, selection.columnId))
              }
            >
              Move right
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                onModelChange(deleteTableColumn(model, selection.columnId));
                onSelectionChange({ type: "table" });
              }}
            >
              Delete column
            </DropdownMenuItem>
          </>
        ) : null}
        {selection.type === "cell" ? (
          <>
            <DropdownMenuItem
              onSelect={() =>
                onModelChange(makeContentCell(model, selection.cellId))
              }
            >
              Set as content
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                onModelChange(makeResponseCell(model, selection.cellId))
              }
            >
              Set as answer
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
