import type {
  TableEditorCell,
  TableEditorModel,
  TableResponseField,
} from "#/domains/questions/authoring";
import {
  getPrimaryTableInputBlock,
  getTableCellEditingKind,
} from "#/domains/questions/authoring";
import { getTableCell } from "#/features/questions/table-block-editor";

export type TableCellInspectorViewModel =
  | {
      status: "missing_cell";
    }
  | {
      status: "selected";
      cell: TableEditorCell;
      kind: "content" | "response";
      title: string;
      context: string;
      responseField: TableResponseField | null;
    };

export function getTableCellInspectorViewModel(
  model: TableEditorModel,
  cellId: string,
): TableCellInspectorViewModel {
  const cell = getTableCell(model, cellId);
  if (!cell) {
    return { status: "missing_cell" };
  }

  const row = model.rows.find((candidate) => candidate.id === cell.rowId);
  const column = model.columns.find(
    (candidate) => candidate.id === cell.columnId,
  );
  const inputBlock = getPrimaryTableInputBlock(cell);
  const kind = getTableCellEditingKind(cell);
  const responseField =
    inputBlock !== null
      ? (model.responseFields.find(
          (field) => field.id === inputBlock.responseFieldId,
        ) ?? null)
      : null;

  return {
    cell,
    context: [row?.label, column?.label].filter(Boolean).join(" | "),
    kind,
    responseField,
    status: "selected",
    title:
      kind === "response" ? "Selected answer cell" : "Selected content cell",
  };
}
