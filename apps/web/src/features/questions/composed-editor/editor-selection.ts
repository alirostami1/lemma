import type { TableCellSelection } from "#/domains/questions/authoring";

export type EditorSelection =
  | { type: "document" }
  | { type: "block"; blockId: string }
  | { type: "table"; blockId: string }
  | { type: "table_row"; blockId: string; rowId: string }
  | { type: "table_column"; blockId: string; columnId: string }
  | { type: "table_cell"; blockId: string; cellId: string }
  | { type: "table_cells"; blockId: string; selection: TableCellSelection }
  | { type: "reference"; referenceId: string };

export function selectedBlockIdFromSelection(
  selection: EditorSelection,
): string | null {
  if (
    selection.type === "block" ||
    selection.type === "table" ||
    selection.type === "table_row" ||
    selection.type === "table_column" ||
    selection.type === "table_cell" ||
    selection.type === "table_cells"
  ) {
    return selection.blockId;
  }

  return null;
}
