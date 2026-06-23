import { describe, expect, it } from "vitest";
import type { TableEditorModel } from "#/domains/questions/authoring";
import { validateTableEditorModelAnswers } from "#/domains/questions/authoring";
import {
  duplicateTableColumn,
  duplicateTableRow,
  makeContentCell,
  makeResponseCell,
  repairMissingAnswerFieldForCell,
} from "./table-editor-operations";

function createBaseModel(): TableEditorModel {
  return {
    cells: [
      {
        columnId: "column_1",
        content: [{ text: "Alpha", type: "text" }],
        id: "cell_1",
        rowId: "row_1",
        type: "content",
      },
      {
        columnId: "column_2",
        content: [{ text: "Beta", type: "text" }],
        id: "cell_2",
        rowId: "row_1",
        type: "content",
      },
      {
        columnId: "column_1",
        content: [{ text: "Gamma", type: "text" }],
        id: "cell_3",
        rowId: "row_2",
        type: "content",
      },
      {
        columnId: "column_2",
        content: [{ text: "Delta", type: "text" }],
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
    responseFields: [],
    rows: [
      { id: "row_1", label: "Row 1" },
      { id: "row_2", label: "Row 2" },
    ],
    showColumnNames: true,
    showRowNames: true,
  };
}

function createAnswerModel(): TableEditorModel {
  return {
    ...createBaseModel(),
    cells: [
      {
        columnId: "column_1",
        correctValueSource: { type: "literal", value: "Alpha" },
        grading: { mode: "exact" },
        id: "cell_1",
        label: "Student answer",
        placeholder: "Student answer",
        points: 2,
        responseFieldId: "answer_1",
        rowId: "row_1",
        type: "response",
      },
      {
        columnId: "column_2",
        content: [{ text: "Beta", type: "text" }],
        id: "cell_2",
        rowId: "row_1",
        type: "content",
      },
      {
        columnId: "column_1",
        content: [{ text: "Gamma", type: "text" }],
        id: "cell_3",
        rowId: "row_2",
        type: "content",
      },
      {
        columnId: "column_2",
        content: [{ text: "Delta", type: "text" }],
        id: "cell_4",
        rowId: "row_2",
        type: "content",
      },
    ],
    responseFields: [
      {
        id: "answer_1",
        label: "Student answer",
        required: false,
        type: "text",
      },
    ],
  };
}

describe("table editor operations", () => {
  it("creates fresh answer IDs for multiple converted cells", () => {
    const first = makeResponseCell(createBaseModel(), "cell_1");
    const second = makeResponseCell(first, "cell_2");

    expect(second.responseFields.map((field) => field.id)).toEqual([
      "answer_1",
      "answer_2",
    ]);
    expect(
      second.cells
        .filter((cell) => cell.type === "response")
        .map((cell) => cell.responseFieldId),
    ).toEqual(["answer_1", "answer_2"]);
    expect(() => validateTableEditorModelAnswers(second)).not.toThrow();
  });

  it("prunes unused answer fields when converting to content", () => {
    const nextModel = makeContentCell(createAnswerModel(), "cell_1");

    expect(nextModel.responseFields).toEqual([]);
    expect(nextModel.cells[0]).toMatchObject({ type: "content" });
    expect(() => validateTableEditorModelAnswers(nextModel)).not.toThrow();
  });

  it("keeps an answer field when another cell still uses it", () => {
    const sourceCell = createAnswerModel().cells[0];
    if (!sourceCell) {
      throw new Error("Expected source cell.");
    }
    const model: TableEditorModel = {
      ...createAnswerModel(),
      cells: [
        sourceCell,
        {
          columnId: "column_2",
          correctValueSource: { type: "literal", value: "Delta" },
          grading: { mode: "exact" },
          id: "cell_5",
          label: "Student answer",
          placeholder: "Student answer",
          points: 2,
          responseFieldId: "answer_1",
          rowId: "row_2",
          type: "response",
        },
      ],
    };

    const nextModel = makeContentCell(model, "cell_1");

    expect(nextModel.responseFields).toHaveLength(1);
    expect(nextModel.responseFields[0]?.id).toBe("answer_1");
  });

  it("repairs a missing answer field explicitly", () => {
    const model: TableEditorModel = {
      ...createAnswerModel(),
      responseFields: [],
    };

    const nextModel = repairMissingAnswerFieldForCell(model, "cell_1");

    expect(nextModel.responseFields).toEqual([
      expect.objectContaining({
        id: "answer_1",
        label: "Student answer",
        required: true,
        type: "number",
      }),
    ]);
    expect(() => validateTableEditorModelAnswers(nextModel)).not.toThrow();
  });

  it("duplicates a row answer cell with a fresh field and metadata", () => {
    const model: TableEditorModel = {
      ...createBaseModel(),
      cells: [
        {
          columnId: "column_1",
          correctValueSource: { type: "literal", value: { a: 1 } },
          grading: { mode: "exact" },
          id: "cell_1",
          label: "Payload",
          placeholder: "Student answer",
          points: 2,
          responseFieldId: "answer_1",
          rowId: "row_1",
          type: "response",
        },
      ],
      responseFields: [
        { id: "answer_1", label: "Payload", required: false, type: "text" },
      ],
    };

    const nextModel = duplicateTableRow(model, "row_1");
    const duplicate = nextModel.cells.find((cell) => cell.id !== "cell_1");

    expect(duplicate).toMatchObject({
      responseFieldId: "answer_2",
      type: "response",
    });
    expect(nextModel.responseFields).toEqual([
      { id: "answer_1", label: "Payload", required: false, type: "text" },
      { id: "answer_2", label: "Payload", required: false, type: "text" },
    ]);
  });

  it("duplicates a column answer cell with a fresh field and metadata", () => {
    const model: TableEditorModel = {
      ...createBaseModel(),
      cells: [
        {
          columnId: "column_1",
          correctValueSource: { type: "literal", value: true },
          grading: { mode: "exact" },
          id: "cell_1",
          label: "Checked",
          placeholder: "Student answer",
          points: 1,
          responseFieldId: "answer_1",
          rowId: "row_1",
          type: "response",
        },
      ],
      columns: [
        { id: "column_1", label: "Column 1" },
        { id: "column_2", label: "Column 2" },
      ],
      responseFields: [
        { id: "answer_1", label: "Checked", required: true, type: "boolean" },
      ],
    };

    const nextModel = duplicateTableColumn(model, "column_1");
    const duplicate = nextModel.cells.find((cell) => cell.id !== "cell_1");

    expect(duplicate).toMatchObject({
      responseFieldId: "answer_2",
      type: "response",
    });
    expect(nextModel.responseFields).toEqual([
      { id: "answer_1", label: "Checked", required: true, type: "boolean" },
      { id: "answer_2", label: "Checked", required: true, type: "boolean" },
    ]);
    expect(() => validateTableEditorModelAnswers(nextModel)).not.toThrow();
  });
});
