import type {
  TableEditorCell,
  TableEditorModel,
  TableResponseField,
} from "#/domains/questions/authoring";
import { getTableCell } from "#/features/questions/table-block-editor";

export type TableCellInspectorViewModel =
  | {
      status: "missing_cell";
    }
  | {
      status: "selected";
      cell: TableEditorCell;
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
  const responseField =
    cell.type === "response"
      ? (model.responseFields.find(
          (field) => field.id === cell.responseFieldId,
        ) ?? null)
      : null;

  return {
    status: "selected",
    cell,
    title:
      cell.type === "response"
        ? "Selected answer cell"
        : "Selected content cell",
    context: [row?.label, column?.label].filter(Boolean).join(" | "),
    responseField,
  };
}
