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
      status: "selected",
      title: "Selected content cell",
      context: "Row 1 | Column 1",
      responseField: null,
    });
  });

  it("resolves the matching response field for answer cells", () => {
    expect(
      getTableCellInspectorViewModel(createAnswerModel(), "cell_1"),
    ).toMatchObject({
      status: "selected",
      title: "Selected answer cell",
      responseField: {
        id: "answer_1",
        type: "number",
      },
    });
  });
});

function createContentModel(): TableEditorModel {
  return {
    prompt: "Prompt",
    columns: [{ id: "column_1", label: "Column 1" }],
    rows: [{ id: "row_1", label: "Row 1" }],
    showColumnNames: true,
    showRowNames: true,
    responseFields: [],
    cells: [
      {
        id: "cell_1",
        rowId: "row_1",
        columnId: "column_1",
        type: "content",
        content: [{ type: "text", text: "42" }],
      },
    ],
  };
}

function createAnswerModel(): TableEditorModel {
  return {
    ...createContentModel(),
    responseFields: [
      { id: "answer_1", type: "number", label: "Answer", required: true },
    ],
    cells: [
      {
        id: "cell_1",
        rowId: "row_1",
        columnId: "column_1",
        type: "response",
        responseFieldId: "answer_1",
        label: "Answer",
        placeholder: "Student answer",
        correctValueSource: { type: "literal", value: 7 },
        points: 1,
        grading: { mode: "exact" },
      },
    ],
  };
}
