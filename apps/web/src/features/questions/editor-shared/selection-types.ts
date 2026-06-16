export type TableEditorSelection =
  | { type: "table" }
  | { type: "row"; rowId: string }
  | { type: "column"; columnId: string }
  | { type: "cell"; cellId: string };

export function isTableSelectionEqual(
  left: TableEditorSelection,
  right: TableEditorSelection,
) {
  if (left.type !== right.type) {
    return false;
  }

  if (left.type === "row" && right.type === "row") {
    return left.rowId === right.rowId;
  }

  if (left.type === "column" && right.type === "column") {
    return left.columnId === right.columnId;
  }

  if (left.type === "cell" && right.type === "cell") {
    return left.cellId === right.cellId;
  }

  return left.type === "table";
}
