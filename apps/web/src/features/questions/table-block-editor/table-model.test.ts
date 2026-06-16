import { describe, expect, it } from "vitest";
import {
  moveTableColumn,
  moveTableRow,
  reorderTableColumns,
  reorderTableRows,
  type TableEditorModel,
} from "#/features/questions/table-block-editor";

const baseModel: TableEditorModel = {
  prompt: "",
  columns: [
    { id: "column_1", label: "Column 1" },
    { id: "column_2", label: "Column 2" },
  ],
  rows: [
    { id: "row_1", label: "Row 1" },
    { id: "row_2", label: "Row 2" },
  ],
  showColumnNames: true,
  showRowNames: true,
  responseFields: [
    {
      id: "answer_1",
      type: "text",
      required: true,
    },
  ],
  cells: [
    {
      id: "cell_1",
      rowId: "row_1",
      columnId: "column_1",
      type: "content",
      content: [{ type: "text", text: "A" }],
    },
    {
      id: "cell_2",
      rowId: "row_1",
      columnId: "column_2",
      type: "response",
      responseFieldId: "answer_1",
      correctValueSource: { type: "literal", value: "B" },
      points: 1,
      grading: { mode: "exact" },
    },
    {
      id: "cell_3",
      rowId: "row_2",
      columnId: "column_1",
      type: "content",
      content: [{ type: "text", text: "C" }],
    },
    {
      id: "cell_4",
      rowId: "row_2",
      columnId: "column_2",
      type: "content",
      content: [{ type: "text", text: "D" }],
    },
  ],
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
