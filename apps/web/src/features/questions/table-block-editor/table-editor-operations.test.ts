import { describe, expect, it } from "vitest";
import type { TableEditorModel } from "#/domains/questions/authoring";
import { validateTableEditorModelAnswers } from "#/domains/questions/authoring";
import {
  getPrimaryTableInputBlock,
  getPrimaryTableTextBlock,
} from "#/domains/questions/authoring/table-model";
import {
  duplicateTableColumn,
  duplicateTableRow,
  makeContentCell,
  makeResponseCell,
  repairMissingAnswerFieldForCell,
  updateContentCellContent,
  updateResponseCellCorrectValueSource,
  updateTableCellInputBlockCorrectValueSource,
  updateTableCellTextBlockContent,
} from "./table-editor-operations";

function createBaseModel(): TableEditorModel {
  return {
    cells: [
      {
        blocks: [
          {
            content: [{ text: "Alpha", type: "text" }],
            id: "text_1",
            type: "text",
          },
        ],
        columnId: "column_1",
        id: "cell_1",
        rowId: "row_1",
      },
      {
        blocks: [
          {
            content: [{ text: "Beta", type: "text" }],
            id: "text_2",
            type: "text",
          },
        ],
        columnId: "column_2",
        id: "cell_2",
        rowId: "row_1",
      },
      {
        blocks: [
          {
            content: [{ text: "Gamma", type: "text" }],
            id: "text_3",
            type: "text",
          },
        ],
        columnId: "column_1",
        id: "cell_3",
        rowId: "row_2",
      },
      {
        blocks: [
          {
            content: [{ text: "Delta", type: "text" }],
            id: "text_4",
            type: "text",
          },
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
        blocks: [
          {
            correctValueSource: { type: "literal", value: "Alpha" },
            grading: { mode: "exact" },
            id: "cell_1_input",
            label: "Student answer",
            placeholder: "Student answer",
            points: 2,
            responseFieldId: "answer_1",
            type: "input",
          },
        ],
        columnId: "column_1",
        id: "cell_1",
        rowId: "row_1",
      },
      {
        blocks: [
          {
            content: [{ text: "Beta", type: "text" }],
            id: "text_2",
            type: "text",
          },
        ],
        columnId: "column_2",
        id: "cell_2",
        rowId: "row_1",
      },
      {
        blocks: [
          {
            content: [{ text: "Gamma", type: "text" }],
            id: "text_3",
            type: "text",
          },
        ],
        columnId: "column_1",
        id: "cell_3",
        rowId: "row_2",
      },
      {
        blocks: [
          {
            content: [{ text: "Delta", type: "text" }],
            id: "text_4",
            type: "text",
          },
        ],
        columnId: "column_2",
        id: "cell_4",
        rowId: "row_2",
      },
    ],
    responseFields: [
      {
        id: "answer_1",
        label: "Student answer",
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
        .map(getPrimaryTableInputBlock)
        .filter((block) => block !== null)
        .map((block) => block.responseFieldId),
    ).toEqual(["answer_1", "answer_2"]);
    expect(() => validateTableEditorModelAnswers(second)).not.toThrow();
  });

  it("prunes unused answer fields when converting to content", () => {
    const nextModel = makeContentCell(createAnswerModel(), "cell_1");
    const convertedCell = nextModel.cells[0];
    if (!convertedCell) {
      throw new Error("Expected converted cell.");
    }

    expect(nextModel.responseFields).toEqual([]);
    expect(getPrimaryTableTextBlock(convertedCell)).toMatchObject({
      type: "text",
    });
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
          blocks: [
            {
              correctValueSource: { type: "literal", value: "Delta" },
              grading: { mode: "exact" },
              id: "cell_5_input",
              label: "Student answer",
              placeholder: "Student answer",
              points: 2,
              responseFieldId: "answer_1",
              type: "input",
            },
          ],
          columnId: "column_2",
          id: "cell_5",
          rowId: "row_2",
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
        type: "number",
      }),
    ]);
    expect(() => validateTableEditorModelAnswers(nextModel)).not.toThrow();
  });

  it("updates only the targeted text primitive in a cell", () => {
    const model: TableEditorModel = {
      ...createBaseModel(),
      cells: [
        {
          blocks: [
            {
              content: [{ text: "First", type: "text" }],
              id: "text_1",
              type: "text",
            },
            {
              content: [{ text: "Second", type: "text" }],
              id: "text_2",
              type: "text",
            },
          ],
          columnId: "column_1",
          id: "cell_1",
          rowId: "row_1",
        },
      ],
    };

    const nextModel = updateTableCellTextBlockContent(
      model,
      "cell_1",
      "text_1",
      [{ text: "Updated", type: "text" }],
    );

    expect(nextModel.cells[0]?.blocks).toEqual([
      {
        content: [{ text: "Updated", type: "text" }],
        id: "text_1",
        type: "text",
      },
      {
        content: [{ text: "Second", type: "text" }],
        id: "text_2",
        type: "text",
      },
    ]);
  });

  it("uses the content-cell wrapper to update only the primary text primitive", () => {
    const model: TableEditorModel = {
      ...createBaseModel(),
      cells: [
        {
          blocks: [
            {
              content: [{ text: "First", type: "text" }],
              id: "text_1",
              type: "text",
            },
            {
              content: [{ text: "Second", type: "text" }],
              id: "text_2",
              type: "text",
            },
          ],
          columnId: "column_1",
          id: "cell_1",
          rowId: "row_1",
        },
      ],
    };

    const nextModel = updateContentCellContent(model, "cell_1", [
      { text: "Primary", type: "text" },
    ]);

    expect(nextModel.cells[0]?.blocks).toEqual([
      {
        content: [{ text: "Primary", type: "text" }],
        id: "text_1",
        type: "text",
      },
      {
        content: [{ text: "Second", type: "text" }],
        id: "text_2",
        type: "text",
      },
    ]);
  });

  it("updates only the targeted input primitive correct source in a cell", () => {
    const model: TableEditorModel = {
      ...createBaseModel(),
      cells: [
        {
          blocks: [
            {
              correctValueSource: { type: "literal", value: "A" },
              grading: { mode: "exact" },
              id: "input_1",
              points: 1,
              responseFieldId: "answer_1",
              type: "input",
            },
            {
              correctValueSource: { type: "literal", value: "B" },
              grading: { mode: "exact" },
              id: "input_2",
              points: 1,
              responseFieldId: "answer_2",
              type: "input",
            },
          ],
          columnId: "column_1",
          id: "cell_1",
          rowId: "row_1",
        },
      ],
      responseFields: [
        { id: "answer_1", type: "text" },
        { id: "answer_2", type: "text" },
      ],
    };

    const nextModel = updateTableCellInputBlockCorrectValueSource(
      model,
      "cell_1",
      "input_1",
      { type: "reference", referenceId: "reference_1" },
    );

    expect(nextModel.cells[0]?.blocks).toEqual([
      expect.objectContaining({
        correctValueSource: {
          referenceId: "reference_1",
          type: "reference",
        },
        id: "input_1",
      }),
      expect.objectContaining({
        correctValueSource: { type: "literal", value: "B" },
        id: "input_2",
      }),
    ]);
  });

  it("uses the response-cell wrapper to update only the primary input primitive", () => {
    const model: TableEditorModel = {
      ...createBaseModel(),
      cells: [
        {
          blocks: [
            {
              correctValueSource: { type: "literal", value: "A" },
              grading: { mode: "exact" },
              id: "input_1",
              points: 1,
              responseFieldId: "answer_1",
              type: "input",
            },
            {
              correctValueSource: { type: "literal", value: "B" },
              grading: { mode: "exact" },
              id: "input_2",
              points: 1,
              responseFieldId: "answer_2",
              type: "input",
            },
          ],
          columnId: "column_1",
          id: "cell_1",
          rowId: "row_1",
        },
      ],
      responseFields: [
        { id: "answer_1", type: "text" },
        { id: "answer_2", type: "text" },
      ],
    };

    const nextModel = updateResponseCellCorrectValueSource(model, "cell_1", {
      type: "reference",
      referenceId: "reference_1",
    });

    expect(nextModel.cells[0]?.blocks).toEqual([
      expect.objectContaining({
        correctValueSource: {
          referenceId: "reference_1",
          type: "reference",
        },
        id: "input_1",
      }),
      expect.objectContaining({
        correctValueSource: { type: "literal", value: "B" },
        id: "input_2",
      }),
    ]);
  });

  it("duplicates a row answer cell with a fresh field and metadata", () => {
    const model: TableEditorModel = {
      ...createBaseModel(),
      cells: [
        {
          blocks: [
            {
              correctValueSource: { type: "literal", value: { a: 1 } },
              grading: { mode: "exact" },
              id: "cell_1_input",
              label: "Payload",
              placeholder: "Student answer",
              points: 2,
              responseFieldId: "answer_1",
              type: "input",
            },
          ],
          columnId: "column_1",
          id: "cell_1",
          rowId: "row_1",
        },
      ],
      responseFields: [{ id: "answer_1", label: "Payload", type: "text" }],
    };

    const nextModel = duplicateTableRow(model, "row_1");
    const duplicate = nextModel.cells.find((cell) => cell.id !== "cell_1");
    const duplicateInput = duplicate
      ? getPrimaryTableInputBlock(duplicate)
      : null;

    expect(duplicateInput).toMatchObject({
      responseFieldId: "answer_2",
      type: "input",
    });
    expect(duplicate?.id).not.toBe("cell_1");
    expect(duplicate?.rowId).not.toBe("row_1");
    expect(duplicateInput?.id).not.toBe("cell_1_input");
    expect(nextModel.responseFields).toEqual([
      { id: "answer_1", label: "Payload", type: "text" },
      { id: "answer_2", label: "Payload", type: "text" },
    ]);
    expect(() => validateTableEditorModelAnswers(nextModel)).not.toThrow();
  });

  it("duplicates a column answer cell with a fresh field and metadata", () => {
    const model: TableEditorModel = {
      ...createBaseModel(),
      cells: [
        {
          blocks: [
            {
              correctValueSource: { type: "literal", value: true },
              grading: { mode: "exact" },
              id: "cell_1_input",
              label: "Checked",
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
      columns: [
        { id: "column_1", label: "Column 1" },
        { id: "column_2", label: "Column 2" },
      ],
      responseFields: [{ id: "answer_1", label: "Checked", type: "text" }],
    };

    const nextModel = duplicateTableColumn(model, "column_1");
    const duplicate = nextModel.cells.find((cell) => cell.id !== "cell_1");
    const duplicateInput = duplicate
      ? getPrimaryTableInputBlock(duplicate)
      : null;

    expect(duplicateInput).toMatchObject({
      responseFieldId: "answer_2",
      type: "input",
    });
    expect(duplicate?.id).not.toBe("cell_1");
    expect(duplicate?.columnId).not.toBe("column_1");
    expect(duplicateInput?.id).not.toBe("cell_1_input");
    expect(nextModel.responseFields).toEqual([
      { id: "answer_1", label: "Checked", type: "text" },
      { id: "answer_2", label: "Checked", type: "text" },
    ]);
    expect(() => validateTableEditorModelAnswers(nextModel)).not.toThrow();
  });

  it("rejects row duplication when an input primitive references a missing answer field", () => {
    const model: TableEditorModel = {
      ...createBaseModel(),
      cells: [
        {
          blocks: [
            {
              grading: { mode: "manual" },
              id: "cell_1_input",
              points: 1,
              responseFieldId: "missing_answer",
              type: "input",
            },
          ],
          columnId: "column_1",
          id: "cell_1",
          rowId: "row_1",
        },
      ],
      responseFields: [],
    };

    expect(() => duplicateTableRow(model, "row_1")).toThrow(
      "Cannot duplicate table input block cell_1_input: missing response field missing_answer.",
    );
  });

  it("rejects column duplication when an input primitive references a missing answer field", () => {
    const model: TableEditorModel = {
      ...createBaseModel(),
      cells: [
        {
          blocks: [
            {
              grading: { mode: "manual" },
              id: "cell_1_input",
              points: 1,
              responseFieldId: "missing_answer",
              type: "input",
            },
          ],
          columnId: "column_1",
          id: "cell_1",
          rowId: "row_1",
        },
      ],
      responseFields: [],
    };

    expect(() => duplicateTableColumn(model, "column_1")).toThrow(
      "Cannot duplicate table input block cell_1_input: missing response field missing_answer.",
    );
  });
});
