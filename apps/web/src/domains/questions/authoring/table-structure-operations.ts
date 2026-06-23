import {
  duplicateTableCell,
  pruneUnusedResponseFields,
} from "./table-cell-operations";
import {
  moveTableColumn,
  moveTableRow,
  nextAvailableId,
  type TableAxis,
  type TableEditorModel,
} from "./table-model";

export function addTableRow(
  model: TableEditorModel,
  label = `Row ${model.rows.length + 1}`,
): TableEditorModel {
  const row: TableAxis = {
    id: nextAvailableId(
      "row",
      model.rows.map((item) => item.id),
    ),
    label,
  };

  return {
    ...model,
    rows: [...model.rows, row],
  };
}

export function addTableColumn(
  model: TableEditorModel,
  label = `Column ${model.columns.length + 1}`,
): TableEditorModel {
  const column: TableAxis = {
    id: nextAvailableId(
      "column",
      model.columns.map((item) => item.id),
    ),
    label,
  };

  return {
    ...model,
    columns: [...model.columns, column],
  };
}

export function updateTableRowLabel(
  model: TableEditorModel,
  rowId: string,
  label: string,
): TableEditorModel {
  return {
    ...model,
    rows: model.rows.map((row) => (row.id === rowId ? { ...row, label } : row)),
  };
}

export function updateTableColumnLabel(
  model: TableEditorModel,
  columnId: string,
  label: string,
): TableEditorModel {
  return {
    ...model,
    columns: model.columns.map((column) =>
      column.id === columnId ? { ...column, label } : column,
    ),
  };
}

export function duplicateTableRow(
  model: TableEditorModel,
  rowId: string,
): TableEditorModel {
  const rowIndex = model.rows.findIndex((row) => row.id === rowId);
  if (rowIndex < 0) {
    return model;
  }

  const sourceRow = model.rows[rowIndex];
  const nextRow: TableAxis = {
    id: nextAvailableId(
      "row",
      model.rows.map((row) => row.id),
    ),
    label: `${sourceRow.label} copy`,
  };

  const usedCellIds = new Set(model.cells.map((cell) => cell.id));
  const responseFields = [...model.responseFields];

  const duplicatedCells = model.cells
    .filter((cell) => cell.rowId === rowId)
    .map((cell) =>
      duplicateTableCell({
        cell,
        responseFields,
        rowId: nextRow.id,
        usedCellIds,
      }),
    );

  const rows = [...model.rows];
  rows.splice(rowIndex + 1, 0, nextRow);

  return {
    ...model,
    cells: [...model.cells, ...duplicatedCells],
    responseFields,
    rows,
  };
}

export function duplicateTableColumn(
  model: TableEditorModel,
  columnId: string,
): TableEditorModel {
  const columnIndex = model.columns.findIndex(
    (column) => column.id === columnId,
  );
  if (columnIndex < 0) {
    return model;
  }

  const sourceColumn = model.columns[columnIndex];
  const nextColumn: TableAxis = {
    id: nextAvailableId(
      "column",
      model.columns.map((column) => column.id),
    ),
    label: `${sourceColumn.label} copy`,
  };

  const usedCellIds = new Set(model.cells.map((cell) => cell.id));
  const responseFields = [...model.responseFields];

  const duplicatedCells = model.cells
    .filter((cell) => cell.columnId === columnId)
    .map((cell) =>
      duplicateTableCell({
        cell,
        columnId: nextColumn.id,
        responseFields,
        usedCellIds,
      }),
    );

  const columns = [...model.columns];
  columns.splice(columnIndex + 1, 0, nextColumn);

  return {
    ...model,
    cells: [...model.cells, ...duplicatedCells],
    columns,
    responseFields,
  };
}

export function deleteTableRow(
  model: TableEditorModel,
  rowId: string,
): TableEditorModel {
  return pruneUnusedResponseFields({
    ...model,
    cells: model.cells.filter((cell) => cell.rowId !== rowId),
    rows: model.rows.filter((row) => row.id !== rowId),
  });
}

export function deleteTableColumn(
  model: TableEditorModel,
  columnId: string,
): TableEditorModel {
  return pruneUnusedResponseFields({
    ...model,
    cells: model.cells.filter((cell) => cell.columnId !== columnId),
    columns: model.columns.filter((column) => column.id !== columnId),
  });
}

export function moveRowUp(model: TableEditorModel, rowId: string) {
  return moveTableRow(model, rowId, "up");
}

export function moveRowDown(model: TableEditorModel, rowId: string) {
  return moveTableRow(model, rowId, "down");
}

export function moveColumnLeft(model: TableEditorModel, columnId: string) {
  return moveTableColumn(model, columnId, "left");
}

export function moveColumnRight(model: TableEditorModel, columnId: string) {
  return moveTableColumn(model, columnId, "right");
}

export function updateTableLayout(
  model: TableEditorModel,
  update: Pick<TableEditorModel, "showColumnNames" | "showRowNames">,
): TableEditorModel {
  return {
    ...model,
    showColumnNames: update.showColumnNames,
    showRowNames: update.showRowNames,
  };
}

export function resetTableLayout(model: TableEditorModel): TableEditorModel {
  return {
    ...model,
    showColumnNames: true,
    showRowNames: true,
  };
}
