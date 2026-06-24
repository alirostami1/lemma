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
        columnId: "column_1",
        content: [{ text: "42", type: "text" }],
        id: "cell_1",
        rowId: "row_1",
        type: "content",
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
        columnId: "column_1",
        correctValueSource: { type: "literal", value: 7 },
        grading: { mode: "exact" },
        id: "cell_1",
        label: "Answer",
        placeholder: "Student answer",
        points: 1,
        responseFieldId: "answer_1",
        rowId: "row_1",
        type: "response",
      },
    ],
    responseFields: [
      { id: "answer_1", label: "Answer", required: true, type: "number" },
    ],
  };
}
