import type { TableEditorModel } from "./table-model";

export type TableCellCoordinate = {
  rowId: string;
  columnId: string;
};

export type TableCellRange = {
  start: TableCellCoordinate;
  end: TableCellCoordinate;
};

export type TableCellSelection = {
  type: "cells";
  activeCell: TableCellCoordinate;
  ranges: TableCellRange[];
};

export type TableEditorSelection =
  | { type: "table" }
  | { type: "row"; rowId: string }
  | { type: "column"; columnId: string }
  | { type: "cell"; cellId: string }
  | TableCellSelection;

export function selectTableCell(
  coordinate: TableCellCoordinate,
): TableCellSelection {
  return {
    activeCell: coordinate,
    ranges: [{ end: coordinate, start: coordinate }],
    type: "cells",
  };
}

export function selectTableRange(
  start: TableCellCoordinate,
  end: TableCellCoordinate,
): TableCellSelection {
  return {
    activeCell: end,
    ranges: [{ end, start }],
    type: "cells",
  };
}

export function addTableRangeToSelection(
  selection: TableEditorSelection,
  range: TableCellRange,
): TableCellSelection {
  const ranges = selection.type === "cells" ? selection.ranges : [];
  return {
    activeCell: range.end,
    ranges: [...ranges, range],
    type: "cells",
  };
}

export function extendTableSelection(
  selection: TableEditorSelection,
  end: TableCellCoordinate,
): TableCellSelection {
  const start = selection.type === "cells" ? selection.activeCell : end;
  const ranges =
    selection.type === "cells" ? selection.ranges.slice(0, -1) : [];
  return {
    activeCell: end,
    ranges: [...ranges, { end, start }],
    type: "cells",
  };
}

export function normalizeTableSelection(
  model: TableEditorModel,
  selection: TableEditorSelection,
): TableEditorSelection {
  if (selection.type === "table") {
    return selection;
  }
  if (selection.type === "row") {
    return model.rows.some((row) => row.id === selection.rowId)
      ? selection
      : { type: "table" };
  }
  if (selection.type === "column") {
    return model.columns.some((column) => column.id === selection.columnId)
      ? selection
      : { type: "table" };
  }
  if (selection.type === "cell") {
    return model.cells.some((cell) => cell.id === selection.cellId)
      ? selection
      : { type: "table" };
  }

  const ranges = selection.ranges
    .map((range) => normalizeRange(model, range))
    .filter((range) => range !== null);
  const activeCell = isCoordinateInTable(model, selection.activeCell)
    ? selection.activeCell
    : ranges.at(-1)?.end;

  return activeCell && ranges.length > 0
    ? { activeCell, ranges, type: "cells" }
    : { type: "table" };
}

export function getSelectedTableCoordinates(
  model: TableEditorModel,
  selection: TableEditorSelection,
): TableCellCoordinate[] {
  return [...getSelectedTableCoordinateMap(model, selection).values()];
}

export function getSelectedTableCoordinateKeySet(
  model: TableEditorModel,
  selection: TableEditorSelection,
): Set<string> {
  return new Set(getSelectedTableCoordinateMap(model, selection).keys());
}

export function tableCoordinateKey(coordinate: TableCellCoordinate): string {
  return `${coordinate.rowId}:${coordinate.columnId}`;
}

function getSelectedTableCoordinateMap(
  model: TableEditorModel,
  selection: TableEditorSelection,
): Map<string, TableCellCoordinate> {
  const normalizedSelection = normalizeTableSelection(model, selection);
  const coordinates = new Map<string, TableCellCoordinate>();

  const add = (coordinate: TableCellCoordinate) => {
    coordinates.set(tableCoordinateKey(coordinate), coordinate);
  };

  if (normalizedSelection.type === "cell") {
    const cell = model.cells.find(
      (candidate) => candidate.id === normalizedSelection.cellId,
    );
    if (
      cell &&
      isCoordinateInTable(model, { columnId: cell.columnId, rowId: cell.rowId })
    ) {
      add({ columnId: cell.columnId, rowId: cell.rowId });
    }
    return coordinates;
  }

  if (normalizedSelection.type === "row") {
    if (!model.rows.some((row) => row.id === normalizedSelection.rowId)) {
      return coordinates;
    }
    for (const column of model.columns) {
      add({ columnId: column.id, rowId: normalizedSelection.rowId });
    }
    return coordinates;
  }

  if (normalizedSelection.type === "column") {
    if (
      !model.columns.some(
        (column) => column.id === normalizedSelection.columnId,
      )
    ) {
      return coordinates;
    }
    for (const row of model.rows) {
      add({ columnId: normalizedSelection.columnId, rowId: row.id });
    }
    return coordinates;
  }

  if (normalizedSelection.type !== "cells") {
    return coordinates;
  }

  for (const range of normalizedSelection.ranges) {
    for (const coordinate of getCoordinatesInRange(model, range)) {
      add(coordinate);
    }
  }

  return coordinates;
}

export function getCoordinatesInRange(
  model: TableEditorModel,
  range: TableCellRange,
): TableCellCoordinate[] {
  const rowStart = model.rows.findIndex((row) => row.id === range.start.rowId);
  const rowEnd = model.rows.findIndex((row) => row.id === range.end.rowId);
  const columnStart = model.columns.findIndex(
    (column) => column.id === range.start.columnId,
  );
  const columnEnd = model.columns.findIndex(
    (column) => column.id === range.end.columnId,
  );

  if (rowStart < 0 || rowEnd < 0 || columnStart < 0 || columnEnd < 0) {
    return [];
  }

  const firstRow = Math.min(rowStart, rowEnd);
  const lastRow = Math.max(rowStart, rowEnd);
  const firstColumn = Math.min(columnStart, columnEnd);
  const lastColumn = Math.max(columnStart, columnEnd);
  const coordinates: TableCellCoordinate[] = [];

  for (let rowIndex = firstRow; rowIndex <= lastRow; rowIndex += 1) {
    const row = model.rows[rowIndex];
    if (!row) {
      continue;
    }
    for (
      let columnIndex = firstColumn;
      columnIndex <= lastColumn;
      columnIndex += 1
    ) {
      const column = model.columns[columnIndex];
      if (column) {
        coordinates.push({ columnId: column.id, rowId: row.id });
      }
    }
  }

  return coordinates;
}

export function isCoordinateSelected(
  model: TableEditorModel,
  selection: TableEditorSelection,
  coordinate: TableCellCoordinate,
): boolean {
  return getSelectedTableCoordinateKeySet(model, selection).has(
    tableCoordinateKey(coordinate),
  );
}

export function isActiveTableCell(
  selection: TableEditorSelection,
  coordinate: TableCellCoordinate,
): boolean {
  return (
    selection.type === "cells" &&
    tableCoordinateKey(selection.activeCell) === tableCoordinateKey(coordinate)
  );
}

export function isTableSelectionEqual(
  left: TableEditorSelection,
  right: TableEditorSelection,
): boolean {
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

  if (left.type === "cells" && right.type === "cells") {
    return (
      tableCoordinateKey(left.activeCell) ===
        tableCoordinateKey(right.activeCell) &&
      left.ranges.length === right.ranges.length &&
      left.ranges.every((range, index) => {
        const other = right.ranges[index];
        return (
          other !== undefined &&
          tableCoordinateKey(range.start) === tableCoordinateKey(other.start) &&
          tableCoordinateKey(range.end) === tableCoordinateKey(other.end)
        );
      })
    );
  }

  return left.type === "table";
}

export type TableSelectionSummaryForDescription = {
  count: number;
};

export function describeTableSelection(
  model: TableEditorModel,
  selection: TableEditorSelection,
): string {
  return describeTableSelectionFromSummary(selection, {
    count: getSelectedTableCoordinates(model, selection).length,
  });
}

export function describeTableSelectionFromSummary(
  selection: TableEditorSelection,
  summary: TableSelectionSummaryForDescription,
): string {
  if (selection.type === "row") {
    return `${summary.count} cells in row`;
  }
  if (selection.type === "column") {
    return `${summary.count} cells in column`;
  }
  if (selection.type === "cells") {
    const ranges = selection.ranges.length;
    const cellCount =
      summary.count === 1
        ? "1 selected cell"
        : `${summary.count} selected cells`;
    return ranges === 1
      ? cellCount
      : `${summary.count} selected cells in ${ranges} ranges`;
  }
  if (selection.type === "cell") {
    return summary.count === 1 ? "1 selected cell" : "No cells selected";
  }
  return "No cells selected";
}

function normalizeRange(
  model: TableEditorModel,
  range: TableCellRange,
): TableCellRange | null {
  return isCoordinateInTable(model, range.start) &&
    isCoordinateInTable(model, range.end)
    ? range
    : null;
}

function isCoordinateInTable(
  model: TableEditorModel,
  coordinate: TableCellCoordinate,
) {
  return (
    model.rows.some((row) => row.id === coordinate.rowId) &&
    model.columns.some((column) => column.id === coordinate.columnId)
  );
}
