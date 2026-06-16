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
    responseFields: [],
    cells: [
    {
      id: "cell_1",
      rowId: "row_1",
      columnId: "column_1",
      type: "content",
      content: [{ type: "text", text: "Alpha" }],
    },
    {
      id: "cell_2",
      rowId: "row_1",
      columnId: "column_2",
      type: "content",
      content: [{ type: "text", text: "Beta" }],
    },
    {
      id: "cell_3",
      rowId: "row_2",
      columnId: "column_1",
      type: "content",
      content: [{ type: "text", text: "Gamma" }],
    },
    {
      id: "cell_4",
      rowId: "row_2",
      columnId: "column_2",
      type: "content",
      content: [{ type: "text", text: "Delta" }],
    },
    ],
  };
}

function createAnswerModel(): TableEditorModel {
  return {
    ...createBaseModel(),
    responseFields: [
      { id: "answer_1", type: "text", label: "Student answer", required: false },
    ],
    cells: [
      {
        id: "cell_1",
        rowId: "row_1",
        columnId: "column_1",
        type: "response",
        responseFieldId: "answer_1",
        label: "Student answer",
        placeholder: "Student answer",
        correctValueSource: { type: "literal", value: "Alpha" },
        points: 2,
        grading: { mode: "exact" },
      },
      {
        id: "cell_2",
        rowId: "row_1",
        columnId: "column_2",
        type: "content",
        content: [{ type: "text", text: "Beta" }],
      },
      {
        id: "cell_3",
        rowId: "row_2",
        columnId: "column_1",
        type: "content",
        content: [{ type: "text", text: "Gamma" }],
      },
      {
        id: "cell_4",
        rowId: "row_2",
        columnId: "column_2",
        type: "content",
        content: [{ type: "text", text: "Delta" }],
      },
    ],
  };
}

describe("table editor operations", () => {
  it("creates fresh answer IDs for multiple converted cells", () => {
    const first = makeResponseCell(createBaseModel(), "cell_1");
    const second = makeResponseCell(first, "cell_2");

    expect(
      second.responseFields.map((field) => field.id),
    ).toEqual(["answer_1", "answer_2"]);
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
          id: "cell_5",
          rowId: "row_2",
          columnId: "column_2",
          type: "response",
          responseFieldId: "answer_1",
          label: "Student answer",
          placeholder: "Student answer",
          correctValueSource: { type: "literal", value: "Delta" },
          points: 2,
          grading: { mode: "exact" },
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
        type: "number",
        label: "Student answer",
        required: true,
      }),
    ]);
    expect(() => validateTableEditorModelAnswers(nextModel)).not.toThrow();
  });

  it("duplicates a row answer cell with a fresh field and metadata", () => {
    const model: TableEditorModel = {
      ...createBaseModel(),
      responseFields: [
        { id: "answer_1", type: "text", label: "Payload", required: false },
      ],
      cells: [
        {
          id: "cell_1",
          rowId: "row_1",
          columnId: "column_1",
          type: "response",
          responseFieldId: "answer_1",
          label: "Payload",
          placeholder: "Student answer",
          correctValueSource: { type: "literal", value: { a: 1 } },
          points: 2,
          grading: { mode: "exact" },
        },
      ],
    };

    const nextModel = duplicateTableRow(model, "row_1");
    const duplicate = nextModel.cells.find((cell) => cell.id !== "cell_1");

    expect(duplicate).toMatchObject({
      type: "response",
      responseFieldId: "answer_2",
    });
    expect(nextModel.responseFields).toEqual([
      { id: "answer_1", type: "text", label: "Payload", required: false },
      { id: "answer_2", type: "text", label: "Payload", required: false },
    ]);
  });

  it("duplicates a column answer cell with a fresh field and metadata", () => {
    const model: TableEditorModel = {
      ...createBaseModel(),
      columns: [
        { id: "column_1", label: "Column 1" },
        { id: "column_2", label: "Column 2" },
      ],
      responseFields: [
        { id: "answer_1", type: "boolean", label: "Checked", required: true },
      ],
      cells: [
        {
          id: "cell_1",
          rowId: "row_1",
          columnId: "column_1",
          type: "response",
          responseFieldId: "answer_1",
          label: "Checked",
          placeholder: "Student answer",
          correctValueSource: { type: "literal", value: true },
          points: 1,
          grading: { mode: "exact" },
        },
      ],
    };

    const nextModel = duplicateTableColumn(model, "column_1");
    const duplicate = nextModel.cells.find((cell) => cell.id !== "cell_1");

    expect(duplicate).toMatchObject({
      type: "response",
      responseFieldId: "answer_2",
    });
    expect(nextModel.responseFields).toEqual([
      { id: "answer_1", type: "boolean", label: "Checked", required: true },
      { id: "answer_2", type: "boolean", label: "Checked", required: true },
    ]);
    expect(() => validateTableEditorModelAnswers(nextModel)).not.toThrow();
  });
});
