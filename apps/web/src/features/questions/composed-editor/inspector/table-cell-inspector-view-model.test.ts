import { describe, expect, it } from "vitest";
import type { TableEditorModel } from "#/domains/questions/authoring";
import { getTableCellInspectorViewModel } from "./table-cell-inspector-view-model";

describe("getTableCellInspectorViewModel", () => {
  it("returns missing state when the selected cell is gone", () => {
    expect(
      getTableCellInspectorViewModel(createContentModel(), "missing"),
    ).toEqual({
      status: "missing_cell",
    });
  });

  it("builds content cell title and row-column context", () => {
    expect(
      getTableCellInspectorViewModel(createContentModel(), "cell_1"),
    ).toMatchObject({
      context: "Row 1 | Column 1",
      responseField: null,
      status: "selected",
      title: "Selected content cell",
    });
  });

  it("resolves the matching response field for answer cells", () => {
    expect(
      getTableCellInspectorViewModel(createAnswerModel(), "cell_1"),
    ).toMatchObject({
      responseField: {
        id: "answer_1",
        type: "number",
      },
      status: "selected",
      title: "Selected answer cell",
    });
  });
});

function createContentModel(): TableEditorModel {
  return {
    cells: [
      {
        blocks: [
          {
            content: [{ text: "42", type: "text" }],
            id: "text_1",
            type: "text",
          },
        ],
        columnId: "column_1",
        id: "cell_1",
        rowId: "row_1",
      },
    ],
    columns: [{ id: "column_1", label: "Column 1" }],
    prompt: "Prompt",
    responseFields: [],
    rows: [{ id: "row_1", label: "Row 1" }],
    showColumnNames: true,
    showRowNames: true,
  };
}

function createAnswerModel(): TableEditorModel {
  return {
    ...createContentModel(),
    cells: [
      {
        blocks: [
          {
            correctValueSource: { type: "literal", value: 7 },
            grading: { mode: "exact" },
            id: "input_1",
            label: "Answer",
            placeholder: "Student answer",
            points: 1,
            responseFieldId: "answer_1",
            type: "input",
          },
        ],
        columnId: "column_1",
        id: "cell_1",
        rowId: "row_1",
      },
    ],
    responseFields: [{ id: "answer_1", label: "Answer", type: "number" }],
  };
}
