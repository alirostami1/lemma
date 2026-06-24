import { describe, expect, it } from "vitest";
import {
  moveTableColumn,
  moveTableRow,
  reorderTableColumns,
  reorderTableRows,
  type TableEditorModel,
} from "#/features/questions/table-block-editor";

const baseModel: TableEditorModel = {
  cells: [
    {
      columnId: "column_1",
      content: [{ text: "A", type: "text" }],
      id: "cell_1",
      rowId: "row_1",
      type: "content",
    },
    {
      columnId: "column_2",
      correctValueSource: { type: "literal", value: "B" },
      grading: { mode: "exact" },
      id: "cell_2",
      points: 1,
      responseFieldId: "answer_1",
      rowId: "row_1",
      type: "response",
    },
    {
      columnId: "column_1",
      content: [{ text: "C", type: "text" }],
      id: "cell_3",
      rowId: "row_2",
      type: "content",
    },
    {
      columnId: "column_2",
      content: [{ text: "D", type: "text" }],
      id: "cell_4",
      rowId: "row_2",
      type: "content",
    },
  ],
  columns: [
    { id: "column_1", label: "Column 1" },
    { id: "column_2", label: "Column 2" },
  ],
  prompt: "",
  responseFields: [
    {
      id: "answer_1",
      required: true,
      type: "text",
    },
  ],
  rows: [
    { id: "row_1", label: "Row 1" },
    { id: "row_2", label: "Row 2" },
  ],
  showColumnNames: true,
  showRowNames: true,
};

describe("table reorder helpers", () => {
  it("moves row 2 above row 1 without changing cell row ids", () => {
    const moved = moveTableRow(baseModel, "row_2", "up");

    expect(moved.rows.map((row) => row.id)).toEqual(["row_2", "row_1"]);
    expect(moved.cells.map((cell) => cell.rowId)).toEqual([
      "row_1",
      "row_1",
      "row_2",
      "row_2",
    ]);
  });

  it("moves column 2 left without changing cell column ids", () => {
    const moved = moveTableColumn(baseModel, "column_2", "left");

    expect(moved.columns.map((column) => column.id)).toEqual([
      "column_2",
      "column_1",
    ]);
    expect(moved.cells.map((cell) => cell.columnId)).toEqual([
      "column_1",
      "column_2",
      "column_1",
      "column_2",
    ]);
  });

  it("reorders rows and columns by replacement lists", () => {
    const rows = reorderTableRows(baseModel, [...baseModel.rows].reverse());
    const columns = reorderTableColumns(
      baseModel,
      [...baseModel.columns].reverse(),
    );

    expect(rows.rows.map((row) => row.id)).toEqual(["row_2", "row_1"]);
    expect(columns.columns.map((column) => column.id)).toEqual([
      "column_2",
      "column_1",
    ]);
  });
});
