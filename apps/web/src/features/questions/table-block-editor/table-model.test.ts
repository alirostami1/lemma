import { describe, expect, it } from "vitest";
import {
  moveTableColumn,
  moveTableRow,
  reorderTableColumns,
  reorderTableRows,
  type TableCellFormatting,
  type TableEditorCell,
  type TableEditorModel,
  validateTableEditorModel,
} from "#/features/questions/table-block-editor";

const baseModel: TableEditorModel = {
  cells: [
    {
      blocks: [
        { content: [{ text: "A", type: "text" }], id: "text_1", type: "text" },
      ],
      columnId: "column_1",
      id: "cell_1",
      rowId: "row_1",
    },
    {
      blocks: [
        {
          correctValueSource: { type: "literal", value: "B" },
          grading: { mode: "exact" },
          id: "input_1",
          points: 1,
          responseFieldId: "answer_1",
          type: "input",
        },
      ],
      columnId: "column_2",
      id: "cell_2",
      rowId: "row_1",
    },
    {
      blocks: [
        { content: [{ text: "C", type: "text" }], id: "text_2", type: "text" },
      ],
      columnId: "column_1",
      id: "cell_3",
      rowId: "row_2",
    },
    {
      blocks: [
        { content: [{ text: "D", type: "text" }], id: "text_3", type: "text" },
      ],
      columnId: "column_2",
      id: "cell_4",
      rowId: "row_2",
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

describe("table model validation", () => {
  it("accepts the valid base model", () => {
    expect(() => validateTableEditorModel(baseModel)).not.toThrow();
  });

  it("rejects duplicate row and column ids", () => {
    expect(() =>
      validateTableEditorModel({
        ...baseModel,
        rows: [
          baseModel.rows[0] ?? missingAxis(),
          baseModel.rows[0] ?? missingAxis(),
        ],
      }),
    ).toThrow("Row id row_1 is duplicated.");
    expect(() =>
      validateTableEditorModel({
        ...baseModel,
        columns: [
          baseModel.columns[0] ?? missingAxis(),
          baseModel.columns[0] ?? missingAxis(),
        ],
      }),
    ).toThrow("Column id column_1 is duplicated.");
  });

  it("rejects duplicate cell ids and primitive ids", () => {
    const firstCell = requireCell(0);
    const secondCell = requireCell(1);

    expect(() =>
      validateTableEditorModel({
        ...baseModel,
        cells: [firstCell, { ...secondCell, id: firstCell.id }],
      }),
    ).toThrow("Table cell id cell_1 is duplicated.");
    expect(() =>
      validateTableEditorModel({
        ...baseModel,
        cells: [
          firstCell,
          {
            ...secondCell,
            blocks: [
              {
                content: [{ text: "Duplicate", type: "text" }],
                id: "text_1",
                type: "text",
              },
            ],
          },
        ],
      }),
    ).toThrow("Primitive block id text_1 is duplicated.");
  });

  it("rejects duplicate coordinates and missing axes", () => {
    const firstCell = requireCell(0);
    const secondCell = requireCell(1);

    expect(() =>
      validateTableEditorModel({
        ...baseModel,
        cells: [
          firstCell,
          {
            ...secondCell,
            columnId: firstCell.columnId,
            rowId: firstCell.rowId,
          },
        ],
      }),
    ).toThrow("Table cell coordinate row_1/column_1 is duplicated.");
    expect(() =>
      validateTableEditorModel({
        ...baseModel,
        cells: [{ ...firstCell, rowId: "missing_row" }],
      }),
    ).toThrow("Table cell cell_1 references missing row missing_row.");
    expect(() =>
      validateTableEditorModel({
        ...baseModel,
        cells: [{ ...firstCell, columnId: "missing_column" }],
      }),
    ).toThrow("Table cell cell_1 references missing column missing_column.");
  });

  it("rejects invalid formatting and missing response fields", () => {
    const firstCell = requireCell(0);
    const secondCell = requireCell(1);

    expect(() =>
      validateTableEditorModel(modelWithInvalidFormatting(firstCell)),
    ).toThrow("Table cell cell_1 has invalid text alignment.");
    expect(() =>
      validateTableEditorModel({
        ...baseModel,
        responseFields: [],
        cells: [secondCell],
      }),
    ).toThrow(
      "Input block input_1 in cell cell_2 references missing response field answer_1.",
    );
  });
});

function requireCell(index: number): TableEditorCell {
  const cell = baseModel.cells[index];
  if (!cell) {
    throw new Error("Expected base table cell.");
  }
  return cell;
}

function missingAxis() {
  throw new Error("Expected base axis.");
}

function createInvalidFormattingFixture(): TableCellFormatting {
  const formatting: TableCellFormatting = { textAlign: "left" };
  // Persisted/API JSON can contain invalid enum strings TypeScript would reject.
  Object.defineProperty(formatting, "textAlign", { value: "diagonal" });
  return formatting;
}

function modelWithInvalidFormatting(cell: TableEditorCell): TableEditorModel {
  const formatting = createInvalidFormattingFixture();

  return {
    ...baseModel,
    cells: [
      {
        ...cell,
        formatting,
      },
    ],
    responseFields: [],
  };
}
