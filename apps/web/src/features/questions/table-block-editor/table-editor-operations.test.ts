import { describe, expect, it } from "vitest";
import {
  type ComposedEditorBlock,
  type ComposedEditorModel,
  type ComposedRichContent,
  findComposedBlockById,
  makeSelectedCellsResponseWithCellResolution,
  richContentFromInlineContent,
  stripUnusedComposedReferences,
  type TableEditorModel,
  validateTableEditorModel,
} from "#/domains/questions/authoring";
import {
  getPrimaryTableInputBlock,
  getPrimaryTableTextBlock,
} from "#/domains/questions/authoring/table-model";
import {
  makeSelectedTableCellsResponseInComposedModel,
  makeSelectedTableCellsResponseInComposedModelResult,
} from "./table-composed-operations";
import {
  applyFormattingToSelectedCells,
  clearFormattingFromSelectedCells,
  createTableCellsByCoordinateKey,
  createTableResponseFieldsById,
  duplicateTableColumn,
  duplicateTableRow,
  getSelectedTableCoordinateSummary,
  makeContentCell,
  makeResponseCell,
  makeSelectedCellsContent,
  makeSelectedCellsResponse,
  repairMissingAnswerFieldForCell,
  selectionHasRangeBackedReferences,
  updateContentCellContent,
  updateResponseCellCorrectValueSource,
  updateTableCellInputBlockCorrectValueSource,
  updateTableCellTextBlockContent,
} from "./table-editor-operations";
import {
  addTableRangeToSelection,
  getSelectedTableCoordinateKeySet,
  getSelectedTableCoordinates,
  normalizeTableSelection,
  selectTableCell,
  selectTableRange,
} from "./table-selection";

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
    expect(() => validateTableEditorModel(second)).not.toThrow();
  });

  it("selects an active cell, a range, and multiple ranges by coordinates", () => {
    const model = createBaseModel();
    const active = selectTableCell({ columnId: "column_1", rowId: "row_1" });
    const range = selectTableRange(
      { columnId: "column_1", rowId: "row_1" },
      { columnId: "column_2", rowId: "row_2" },
    );
    const multiRange = addTableRangeToSelection(active, {
      end: { columnId: "column_2", rowId: "row_2" },
      start: { columnId: "column_2", rowId: "row_2" },
    });

    expect(active.activeCell).toEqual({ columnId: "column_1", rowId: "row_1" });
    expect(getSelectedTableCoordinates(model, range)).toEqual([
      { columnId: "column_1", rowId: "row_1" },
      { columnId: "column_2", rowId: "row_1" },
      { columnId: "column_1", rowId: "row_2" },
      { columnId: "column_2", rowId: "row_2" },
    ]);
    expect(getSelectedTableCoordinates(model, multiRange)).toEqual([
      { columnId: "column_1", rowId: "row_1" },
      { columnId: "column_2", rowId: "row_2" },
    ]);
  });

  it("converts selected non-adjacent cells to answers in one operation", () => {
    const selection = addTableRangeToSelection(
      selectTableCell({ columnId: "column_1", rowId: "row_1" }),
      {
        end: { columnId: "column_2", rowId: "row_2" },
        start: { columnId: "column_2", rowId: "row_2" },
      },
    );

    const nextModel = makeSelectedCellsResponse(createBaseModel(), selection);
    const firstCell = nextModel.cells.find((cell) => cell.id === "cell_1");
    const fourthCell = nextModel.cells.find((cell) => cell.id === "cell_4");
    if (!firstCell || !fourthCell) {
      throw new Error("Expected selected cells.");
    }

    expect(nextModel.responseFields.map((field) => field.id)).toEqual([
      "answer_1",
      "answer_2",
    ]);
    expect(getPrimaryTableInputBlock(firstCell)).toMatchObject({
      responseFieldId: "answer_1",
      type: "input",
    });
    expect(getPrimaryTableInputBlock(fourthCell)).toMatchObject({
      responseFieldId: "answer_2",
      type: "input",
    });
  });

  it("applies formatting to every cell in a selected range", () => {
    const selection = selectTableRange(
      { columnId: "column_1", rowId: "row_1" },
      { columnId: "column_2", rowId: "row_2" },
    );

    const nextModel = applyFormattingToSelectedCells(
      createBaseModel(),
      selection,
      {
        emphasis: "strong",
        textAlign: "center",
        tone: "highlight",
      },
    );

    expect(nextModel.cells.map((cell) => cell.formatting)).toEqual([
      { emphasis: "strong", textAlign: "center", tone: "highlight" },
      { emphasis: "strong", textAlign: "center", tone: "highlight" },
      { emphasis: "strong", textAlign: "center", tone: "highlight" },
      { emphasis: "strong", textAlign: "center", tone: "highlight" },
    ]);
  });

  it("keeps range-backed display content in low-level conversion without composed context", () => {
    const model: TableEditorModel = {
      ...createBaseModel(),
      cells: [
        {
          blocks: [
            {
              content: [
                {
                  fallbackText: "A1",
                  rangeCell: { columnOffset: 0, rowOffset: 0 },
                  referenceId: "range",
                  type: "reference",
                },
              ],
              id: "text_1",
              type: "text",
            },
          ],
          columnId: "column_1",
          id: "cell_1",
          rowId: "row_1",
        },
      ],
    };

    const nextModel = makeResponseCell(model, "cell_1");
    const converted = nextModel.cells[0];

    expect(converted?.blocks[0]).toEqual({
      content: [
        {
          fallbackText: "A1",
          rangeCell: { columnOffset: 0, rowOffset: 0 },
          referenceId: "range",
          type: "reference",
        },
      ],
      id: "text_1",
      type: "text",
    });
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
    expect(() => validateTableEditorModel(nextModel)).not.toThrow();
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
    expect(() => validateTableEditorModel(nextModel)).not.toThrow();
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
    expect(() => validateTableEditorModel(nextModel)).not.toThrow();
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
    expect(() => validateTableEditorModel(nextModel)).not.toThrow();
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

  it("selects reversed ranges and dedupes overlapping ranges", () => {
    const model = createBaseModel();
    const reversed = selectTableRange(
      { columnId: "column_2", rowId: "row_2" },
      { columnId: "column_1", rowId: "row_1" },
    );
    const overlapping = addTableRangeToSelection(reversed, {
      end: { columnId: "column_2", rowId: "row_2" },
      start: { columnId: "column_1", rowId: "row_1" },
    });

    expect(getSelectedTableCoordinates(model, reversed)).toEqual([
      { columnId: "column_1", rowId: "row_1" },
      { columnId: "column_2", rowId: "row_1" },
      { columnId: "column_1", rowId: "row_2" },
      { columnId: "column_2", rowId: "row_2" },
    ]);
    expect(getSelectedTableCoordinateKeySet(model, overlapping).size).toBe(4);
  });

  it("normalizes stale selections after deleted rows or columns", () => {
    const model = createBaseModel();

    expect(
      normalizeTableSelection(model, {
        activeCell: { columnId: "column_1", rowId: "missing_row" },
        ranges: [
          {
            end: { columnId: "column_2", rowId: "row_2" },
            start: { columnId: "column_1", rowId: "missing_row" },
          },
        ],
        type: "cells",
      }),
    ).toEqual({ type: "table" });
    expect(
      getSelectedTableCoordinates(model, { rowId: "missing_row", type: "row" }),
    ).toEqual([]);
    expect(
      getSelectedTableCoordinates(model, {
        columnId: "missing_column",
        type: "column",
      }),
    ).toEqual([]);
    expect(
      makeSelectedCellsResponse(model, { rowId: "missing_row", type: "row" }),
    ).toEqual(model);
  });

  it("converts selected non-adjacent answer cells back to content", () => {
    const answerModel = makeSelectedCellsResponse(
      createBaseModel(),
      addTableRangeToSelection(
        selectTableCell({ columnId: "column_1", rowId: "row_1" }),
        {
          end: { columnId: "column_2", rowId: "row_2" },
          start: { columnId: "column_2", rowId: "row_2" },
        },
      ),
    );
    const selection = addTableRangeToSelection(
      selectTableCell({ columnId: "column_1", rowId: "row_1" }),
      {
        end: { columnId: "column_2", rowId: "row_2" },
        start: { columnId: "column_2", rowId: "row_2" },
      },
    );

    const contentModel = makeSelectedCellsContent(answerModel, selection);

    expect(contentModel.responseFields).toEqual([]);
    expect(
      contentModel.cells.map((cell) => getPrimaryTableInputBlock(cell)),
    ).toEqual([null, null, null, null]);
  });

  it("clears formatting only from selected cells", () => {
    const model = applyFormattingToSelectedCells(
      createBaseModel(),
      selectTableRange(
        { columnId: "column_1", rowId: "row_1" },
        { columnId: "column_2", rowId: "row_2" },
      ),
      { emphasis: "strong", tone: "highlight" },
    );

    const nextModel = clearFormattingFromSelectedCells(
      model,
      selectTableCell({ columnId: "column_1", rowId: "row_1" }),
    );

    expect(nextModel.cells[0]?.formatting).toBeUndefined();
    expect(nextModel.cells[1]?.formatting).toEqual({
      emphasis: "strong",
      tone: "highlight",
    });
  });

  it("does not create sparse cells when clearing formatting", () => {
    const model = createLargeModel(3, 3);
    const nextModel = clearFormattingFromSelectedCells(
      model,
      selectTableRange(
        { columnId: "column_1", rowId: "row_1" },
        { columnId: "column_3", rowId: "row_3" },
      ),
    );

    expect(nextModel.cells).toEqual([]);
  });

  it("converts non-reference content to a blank literal answer source", () => {
    const nextModel = makeResponseCell(createBaseModel(), "cell_1");
    const inputBlock = getPrimaryTableInputBlock(
      requireCellFromModel(nextModel, 0),
    );

    expect(inputBlock?.correctValueSource).toEqual({
      type: "literal",
      value: "",
    });
  });

  it("uses a direct content reference as the converted answer source", () => {
    const model: TableEditorModel = {
      ...createBaseModel(),
      cells: [
        {
          blocks: [
            {
              content: [{ referenceId: "direct_ref", type: "reference" }],
              id: "text_1",
              type: "text",
            },
          ],
          columnId: "column_1",
          id: "cell_1",
          rowId: "row_1",
        },
      ],
    };

    const nextModel = makeResponseCell(model, "cell_1");
    const converted = nextModel.cells[0];
    const inputBlock = converted ? getPrimaryTableInputBlock(converted) : null;

    expect(converted?.blocks).toHaveLength(1);
    expect(inputBlock?.correctValueSource).toEqual({
      referenceId: "direct_ref",
      type: "reference",
    });
  });

  it.each([
    {
      content: {
        content: [
          {
            content: [{ referenceId: "direct_ref", type: "reference" }],
            type: "paragraph",
          },
        ],
        type: "doc",
      },
      name: "paragraph",
    },
    {
      content: {
        content: [
          {
            content: [{ referenceId: "direct_ref", type: "reference" }],
            level: 2,
            type: "heading",
          },
        ],
        type: "doc",
      },
      name: "heading",
    },
    {
      content: {
        content: [
          {
            items: [
              {
                content: [
                  {
                    items: [
                      {
                        content: [
                          {
                            content: [
                              {
                                referenceId: "direct_ref",
                                type: "reference",
                              },
                            ],
                            type: "paragraph",
                          },
                        ],
                        type: "list_item",
                      },
                    ],
                    type: "bullet_list",
                  },
                ],
                type: "list_item",
              },
            ],
            type: "ordered_list",
          },
        ],
        type: "doc",
      },
      name: "nested list",
    },
  ] satisfies Array<{
    content: ComposedRichContent;
    name: string;
  }>)("uses a direct reference in a rich-text $name as the answer source", ({
    content,
  }) => {
    const nextModel = makeResponseCell(
      modelWithRichTextContent(content),
      "cell_1",
    );
    const converted = requireCellFromModel(nextModel, 0);

    expect(converted.blocks).toHaveLength(1);
    expect(getPrimaryTableInputBlock(converted)?.correctValueSource).toEqual({
      referenceId: "direct_ref",
      type: "reference",
    });
  });

  it("preserves mixed rich-text context while using its direct reference", () => {
    const nextModel = makeResponseCell(
      modelWithRichTextContent({
        content: [
          {
            content: [
              { text: "Expected value: ", type: "text" },
              { referenceId: "direct_ref", type: "reference" },
            ],
            type: "paragraph",
          },
        ],
        type: "doc",
      }),
      "cell_1",
    );
    const converted = requireCellFromModel(nextModel, 0);

    expect(converted.blocks[0]).toEqual(
      expect.objectContaining({ id: "rich_1", type: "rich_text" }),
    );
    expect(getPrimaryTableInputBlock(converted)?.correctValueSource).toEqual({
      referenceId: "direct_ref",
      type: "reference",
    });
  });

  it("blocks unresolved range-backed rich text instead of creating a blank answer", () => {
    const table = modelWithRichTextContent({
      content: [
        {
          content: [
            {
              rangeCell: { columnOffset: 0, rowOffset: 0 },
              referenceId: "missing_range",
              type: "reference",
            },
          ],
          type: "paragraph",
        },
      ],
      type: "doc",
    });
    const result = makeSelectedTableCellsResponseInComposedModelResult({
      editorModel: {
        blocks: [{ id: "table_1", table, type: "table" }],
        references: [],
        responseFields: [],
        schemaVersion: 2,
      },
      selection: selectTableCell({ columnId: "column_1", rowId: "row_1" }),
      tableBlockId: "table_1",
    });

    expect(result.blockedRangeBackedCellCount).toBe(1);
    expect(
      getPrimaryTableInputBlock(requireTableCell(result.model, 0)),
    ).toBeNull();
  });

  it("detects range-backed inserted values before composed conversion", () => {
    const model = rangeBackedTableModel();
    const selection = selectTableCell({ columnId: "column_1", rowId: "row_1" });

    expect(selectionHasRangeBackedReferences(model, selection)).toBe(true);
  });

  it("converts a range-backed inserted value to a direct workbook-cell answer source", () => {
    const nextModel = makeSelectedTableCellsResponseInComposedModel({
      editorModel: rangeBackedComposedModel(),
      selection: selectTableCell({ columnId: "column_1", rowId: "row_1" }),
      tableBlockId: "table_1",
    });
    const directReference = requireReferenceForWorkbookCell(
      nextModel,
      "Sheet1!C2",
    );
    const convertedCell = requireTableCell(nextModel, 0);
    const inputBlock = getPrimaryTableInputBlock(convertedCell);

    expect(directReference.source).toEqual({
      ref: "Sheet1!C2",
      sourceId: "source_1",
      type: "workbook_cell",
    });
    expect(convertedCell?.blocks).toEqual([
      expect.objectContaining({
        correctValueSource: {
          referenceId: directReference.id,
          type: "reference",
        },
        responseFieldId: "answer_1",
        type: "input",
      }),
    ]);
    expect(inputBlock?.correctValueSource).toEqual({
      referenceId: directReference.id,
      type: "reference",
    });
  });

  it("converts a page-nested range-backed table to a direct workbook-cell answer source", () => {
    const model = nestedRangeBackedComposedModel("page");
    const result = makeSelectedTableCellsResponseInComposedModelResult({
      editorModel: model,
      selection: selectTableCell({ columnId: "column_1", rowId: "row_1" }),
      tableBlockId: "table_1",
    });
    const directReference = requireReferenceForWorkbookCell(
      result.model,
      "Sheet1!C2",
    );
    const inputBlock = getPrimaryTableInputBlock(
      requireTableCell(result.model, 0),
    );

    expect(result.blockedRangeBackedCellCount).toBe(0);
    expect(result.convertedCellCount).toBe(1);
    expect(inputBlock?.correctValueSource).toEqual({
      referenceId: directReference.id,
      type: "reference",
    });
    expect(requireNestedContainer(result.model).blocks[0]).toEqual(
      nestedSiblingBlock(),
    );
    expect(result.model.responseFields).toEqual(model.responseFields);
    expect(result.model.references).toEqual(
      expect.arrayContaining([unrelatedReference()]),
    );
  });

  it("converts a step-nested range-backed table to a direct workbook-cell answer source", () => {
    const result = makeSelectedTableCellsResponseInComposedModelResult({
      editorModel: nestedRangeBackedComposedModel("step"),
      selection: selectTableCell({ columnId: "column_1", rowId: "row_1" }),
      tableBlockId: "table_1",
    });

    expect(
      requireReferenceForWorkbookCell(result.model, "Sheet1!C2"),
    ).toBeTruthy();
    expect(
      getPrimaryTableInputBlock(requireTableCell(result.model, 0)),
    ).toEqual(
      expect.objectContaining({
        correctValueSource: expect.objectContaining({ type: "reference" }),
        type: "input",
      }),
    );
  });

  it("reuses an existing direct workbook-cell reference for range-backed conversion", () => {
    const nextModel = makeSelectedTableCellsResponseInComposedModel({
      editorModel: rangeBackedComposedModel({
        id: "existing_cell_ref",
        source: {
          ref: "Sheet1!C2",
          sourceId: "source_1",
          type: "workbook_cell",
        },
      }),
      selection: selectTableCell({ columnId: "column_1", rowId: "row_1" }),
      tableBlockId: "table_1",
    });
    const inputBlock = getPrimaryTableInputBlock(
      requireTableCell(nextModel, 0),
    );

    expect(
      nextModel.references.filter(
        (reference) =>
          reference.source.type === "workbook_cell" &&
          reference.source.ref === "Sheet1!C2",
      ),
    ).toHaveLength(1);
    expect(inputBlock?.correctValueSource).toEqual({
      referenceId: "existing_cell_ref",
      type: "reference",
    });
  });

  it("keeps the converted direct workbook-cell reference when stripping unused references", () => {
    const nextModel = makeSelectedTableCellsResponseInComposedModel({
      editorModel: rangeBackedComposedModel(),
      selection: selectTableCell({ columnId: "column_1", rowId: "row_1" }),
      tableBlockId: "table_1",
    });
    const directReference = requireReferenceForWorkbookCell(
      nextModel,
      "Sheet1!C2",
    );

    expect(stripUnusedComposedReferences(nextModel).references).toEqual([
      directReference,
    ]);
  });

  it("blocks missing range references instead of creating blank literal answers", () => {
    const result = makeSelectedTableCellsResponseInComposedModelResult({
      editorModel: rangeBackedComposedModelWithReferences([]),
      selection: selectTableCell({ columnId: "column_1", rowId: "row_1" }),
      tableBlockId: "table_1",
    });

    expect(result.blockedRangeBackedCellCount).toBe(1);
    expect(result.convertedCellCount).toBe(0);
    expect(
      getPrimaryTableInputBlock(requireTableCell(result.model, 0)),
    ).toBeNull();
    expect(requireTableCell(result.model, 0).blocks).toEqual(
      rangeBackedTableModel().cells[0]?.blocks,
    );
  });

  it("blocks non-range references instead of creating blank literal answers", () => {
    const result = makeSelectedTableCellsResponseInComposedModelResult({
      editorModel: rangeBackedComposedModelWithReferences([
        { id: "range_ref", source: { type: "literal", value: "C2" } },
      ]),
      selection: selectTableCell({ columnId: "column_1", rowId: "row_1" }),
      tableBlockId: "table_1",
    });

    expect(result.blockedRangeBackedCellCount).toBe(1);
    expect(
      getPrimaryTableInputBlock(requireTableCell(result.model, 0)),
    ).toBeNull();
  });

  it("blocks malformed workbook ranges instead of creating blank literal answers", () => {
    const result = makeSelectedTableCellsResponseInComposedModelResult({
      editorModel: rangeBackedComposedModelWithReferences([
        {
          id: "range_ref",
          source: {
            ref: "not-a-workbook-range",
            sourceId: "source_1",
            type: "workbook_range",
          },
        },
      ]),
      selection: selectTableCell({ columnId: "column_1", rowId: "row_1" }),
      tableBlockId: "table_1",
    });

    expect(result.blockedRangeBackedCellCount).toBe(1);
    expect(
      getPrimaryTableInputBlock(requireTableCell(result.model, 0)),
    ).toBeNull();
  });

  it("blocks offsets outside a workbook range instead of creating blank literal answers", () => {
    const result = makeSelectedTableCellsResponseInComposedModelResult({
      editorModel: rangeBackedComposedModelWithReferences([
        {
          id: "range_ref",
          source: {
            ref: "Sheet1!A1:A1",
            sourceId: "source_1",
            type: "workbook_range",
          },
        },
      ]),
      selection: selectTableCell({ columnId: "column_1", rowId: "row_1" }),
      tableBlockId: "table_1",
    });

    expect(result.blockedRangeBackedCellCount).toBe(1);
    expect(
      getPrimaryTableInputBlock(requireTableCell(result.model, 0)),
    ).toBeNull();
  });

  it("converts resolvable cells and leaves unresolved range-backed cells unchanged", () => {
    const result = makeSelectedTableCellsResponseInComposedModelResult({
      editorModel: mixedRangeBackedComposedModel(),
      selection: addTableRangeToSelection(
        selectTableCell({ columnId: "column_1", rowId: "row_1" }),
        {
          end: { columnId: "column_2", rowId: "row_1" },
          start: { columnId: "column_2", rowId: "row_1" },
        },
      ),
      tableBlockId: "table_1",
    });

    expect(result.convertedCellCount).toBe(1);
    expect(result.blockedRangeBackedCellCount).toBe(1);
    expect(
      getPrimaryTableInputBlock(requireTableCell(result.model, 0)),
    ).toEqual(expect.objectContaining({ type: "input" }));
    expect(
      getPrimaryTableInputBlock(requireTableCell(result.model, 1)),
    ).toBeNull();
  });

  it("converts a large composed selected range in one batch", () => {
    const table = createLargeExplicitModel(100, 100);
    const sibling = nestedSiblingBlock();
    const model: ComposedEditorModel = {
      blocks: [sibling, { id: "table_1", table, type: "table" }],
      references: [unrelatedReference()],
      responseFields: [],
      schemaVersion: 2,
    };

    const result = makeSelectedTableCellsResponseInComposedModelResult({
      editorModel: model,
      selection: selectTableRange(
        { columnId: "column_1", rowId: "row_1" },
        { columnId: "column_100", rowId: "row_100" },
      ),
      tableBlockId: "table_1",
    });
    const convertedTable = requireTable(result.model);
    const primitiveBlockIds = convertedTable.cells.flatMap((cell) =>
      cell.blocks.map((block) => block.id),
    );
    const responseFieldIds = convertedTable.responseFields.map(
      (field) => field.id,
    );

    expect(result.blockedRangeBackedCellCount).toBe(0);
    expect(result.convertedCellCount).toBe(10_000);
    expect(convertedTable.cells).toHaveLength(10_000);
    expect(convertedTable.responseFields).toHaveLength(10_000);
    expect(
      convertedTable.cells.every(
        (cell) => getPrimaryTableInputBlock(cell) !== null,
      ),
    ).toBe(true);
    expect(new Set(convertedTable.cells.map((cell) => cell.id)).size).toBe(
      10_000,
    );
    expect(new Set(primitiveBlockIds).size).toBe(primitiveBlockIds.length);
    expect(new Set(responseFieldIds).size).toBe(responseFieldIds.length);
    expect(result.model.blocks[0]).toBe(sibling);
    expect(result.model.references).toEqual(model.references);
  });

  it("converts a large nested composed selected range and preserves siblings", () => {
    const table = createLargeExplicitModel(30, 30);
    const sibling = nestedSiblingBlock();
    const model: ComposedEditorModel = {
      blocks: [
        {
          blocks: [
            sibling,
            { id: "table_1", table, type: "table" },
            { id: "separator_1", type: "separator" },
          ],
          containerType: "page",
          id: "page_1",
          title: "Page",
          type: "container",
        },
      ],
      references: [unrelatedReference()],
      responseFields: [],
      schemaVersion: 2,
    };

    const result = makeSelectedTableCellsResponseInComposedModelResult({
      editorModel: model,
      selection: selectTableRange(
        { columnId: "column_1", rowId: "row_1" },
        { columnId: "column_30", rowId: "row_30" },
      ),
      tableBlockId: "table_1",
    });
    const container = requireNestedContainer(result.model);

    expect(result.blockedRangeBackedCellCount).toBe(0);
    expect(result.convertedCellCount).toBe(900);
    expect(requireTable(result.model).responseFields).toHaveLength(900);
    expect(container.blocks[0]).toBe(sibling);
    expect(container.blocks[2]).toEqual({
      id: "separator_1",
      type: "separator",
    });
  });

  it("batch converts resolvable range and literal cells while blocking unresolved range content", () => {
    const table = createLargeModel(1, 3);
    table.cells = [
      {
        blocks: [
          {
            content: [
              {
                rangeCell: { columnOffset: 2, rowOffset: 1 },
                referenceId: "range_ref",
                type: "reference",
              },
            ],
            id: "text_resolvable",
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
            content: [
              {
                rangeCell: { columnOffset: 0, rowOffset: 0 },
                referenceId: "missing_range_ref",
                type: "reference",
              },
            ],
            id: "text_unresolved",
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
            content: [{ text: "Literal", type: "text" }],
            id: "text_literal",
            type: "text",
          },
        ],
        columnId: "column_3",
        id: "cell_3",
        rowId: "row_1",
      },
    ];
    const model: ComposedEditorModel = {
      blocks: [{ id: "table_1", table, type: "table" }],
      references: [
        {
          id: "range_ref",
          source: {
            ref: "Sheet1!A1:D4",
            sourceId: "source_1",
            type: "workbook_range",
          },
        },
        unrelatedReference(),
      ],
      responseFields: [],
      schemaVersion: 2,
    };

    const result = makeSelectedTableCellsResponseInComposedModelResult({
      editorModel: model,
      selection: selectTableRange(
        { columnId: "column_1", rowId: "row_1" },
        { columnId: "column_3", rowId: "row_1" },
      ),
      tableBlockId: "table_1",
    });
    const directReference = requireReferenceForWorkbookCell(
      result.model,
      "Sheet1!C2",
    );
    const resolvedInput = getPrimaryTableInputBlock(
      requireTableCell(result.model, 0),
    );
    const unresolvedCell = requireTableCell(result.model, 1);
    const literalInput = getPrimaryTableInputBlock(
      requireTableCell(result.model, 2),
    );

    expect(result.convertedCellCount).toBe(2);
    expect(result.blockedRangeBackedCellCount).toBe(1);
    expect(resolvedInput?.correctValueSource).toEqual({
      referenceId: directReference.id,
      type: "reference",
    });
    expect(getPrimaryTableInputBlock(unresolvedCell)).toBeNull();
    expect(unresolvedCell.blocks).toBe(table.cells[1]?.blocks);
    expect(literalInput?.correctValueSource).toEqual({
      type: "literal",
      value: "",
    });
    expect(result.model.references).toHaveLength(3);
    expect(result.model.references).toEqual(
      expect.arrayContaining([unrelatedReference(), directReference]),
    );
  });

  it("converts direct text and rich-text references through the composed batch path", () => {
    const table = createLargeModel(1, 2);
    table.cells = [
      {
        blocks: [
          {
            content: [{ referenceId: "text_ref", type: "reference" }],
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
            content: richContentFromInlineContent([
              { referenceId: "rich_ref", type: "reference" },
            ]),
            id: "rich_1",
            type: "rich_text",
          },
        ],
        columnId: "column_2",
        id: "cell_2",
        rowId: "row_1",
      },
    ];
    const model: ComposedEditorModel = {
      blocks: [{ id: "table_1", table, type: "table" }],
      references: [
        { id: "text_ref", source: { type: "literal", value: "Text" } },
        { id: "rich_ref", source: { type: "literal", value: "Rich" } },
        unrelatedReference(),
      ],
      responseFields: [],
      schemaVersion: 2,
    };

    const result = makeSelectedTableCellsResponseInComposedModelResult({
      editorModel: model,
      selection: selectTableRange(
        { columnId: "column_1", rowId: "row_1" },
        { columnId: "column_2", rowId: "row_1" },
      ),
      tableBlockId: "table_1",
    });

    expect(result.convertedCellCount).toBe(2);
    expect(
      getPrimaryTableInputBlock(requireTableCell(result.model, 0))
        ?.correctValueSource,
    ).toEqual({ referenceId: "text_ref", type: "reference" });
    expect(
      getPrimaryTableInputBlock(requireTableCell(result.model, 1))
        ?.correctValueSource,
    ).toEqual({ referenceId: "rich_ref", type: "reference" });
    expect(requireTableCell(result.model, 0).blocks).toHaveLength(1);
    expect(requireTableCell(result.model, 1).blocks).toHaveLength(1);
    expect(result.model.references).toEqual(model.references);
  });

  it("supports focused per-cell decisions in selected answer batches", () => {
    const result = makeSelectedCellsResponseWithCellResolution(
      createBaseModel(),
      selectTableRange(
        { columnId: "column_1", rowId: "row_1" },
        { columnId: "column_2", rowId: "row_1" },
      ),
      (cell) =>
        cell.id === "cell_2"
          ? { type: "skip" }
          : {
              options: {
                correctValueSource: { type: "literal", value: "Override" },
              },
              type: "convert",
            },
    );

    expect(result.convertedCellCount).toBe(1);
    expect(result.skippedCellCount).toBe(1);
    expect(
      getPrimaryTableInputBlock(requireCellFromModel(result.model, 0))
        ?.correctValueSource,
    ).toEqual({ type: "literal", value: "Override" });
    expect(
      getPrimaryTableInputBlock(requireCellFromModel(result.model, 1)),
    ).toBeNull();
  });

  it("does not strip a direct reference converted into an answer source", () => {
    const table = makeResponseCell(
      {
        ...createBaseModel(),
        cells: [
          {
            blocks: [
              {
                content: [{ referenceId: "direct_ref", type: "reference" }],
                id: "text_1",
                type: "text",
              },
            ],
            columnId: "column_1",
            id: "cell_1",
            rowId: "row_1",
          },
        ],
      },
      "cell_1",
    );
    const model: ComposedEditorModel = {
      blocks: [{ id: "table_1", table, type: "table" }],
      references: [
        { id: "direct_ref", source: { type: "literal", value: "A1" } },
        { id: "unused", source: { type: "literal", value: "B1" } },
      ],
      responseFields: [],
      schemaVersion: 2,
    };

    expect(stripUnusedComposedReferences(model).references).toEqual([
      { id: "direct_ref", source: { type: "literal", value: "A1" } },
    ]);
  });

  it("keeps a rich-text direct reference converted into an answer source", () => {
    const table = makeResponseCell(
      modelWithRichTextContent({
        content: [
          {
            content: [{ referenceId: "direct_ref", type: "reference" }],
            type: "paragraph",
          },
        ],
        type: "doc",
      }),
      "cell_1",
    );
    const model: ComposedEditorModel = {
      blocks: [{ id: "table_1", table, type: "table" }],
      references: [
        { id: "direct_ref", source: { type: "literal", value: "A1" } },
        { id: "unused", source: { type: "literal", value: "B1" } },
      ],
      responseFields: [],
      schemaVersion: 2,
    };

    expect(stripUnusedComposedReferences(model).references).toEqual([
      { id: "direct_ref", source: { type: "literal", value: "A1" } },
    ]);
  });

  it("indexes explicit cells and response fields for repeated lookups", () => {
    const model = createAnswerModel();
    const cellsByCoordinateKey = createTableCellsByCoordinateKey(model);
    const responseFieldsById = createTableResponseFieldsById(model);

    expect(cellsByCoordinateKey.get("row_2:column_2")?.id).toBe("cell_4");
    expect(responseFieldsById.get("answer_1")?.label).toBe("Student answer");
    expect(cellsByCoordinateKey.get("missing:coordinate")).toBeUndefined();
  });

  it("summarizes a large explicit selected range through one coordinate index", () => {
    const largeModel = createLargeExplicitModel(100, 100, true);
    const selection = selectTableRange(
      { columnId: "column_1", rowId: "row_1" },
      { columnId: "column_100", rowId: "row_100" },
    );
    const cellsByCoordinateKey = createTableCellsByCoordinateKey(largeModel);

    const summary = getSelectedTableCoordinateSummary(
      largeModel,
      selection,
      cellsByCoordinateKey,
    );

    expect(summary.count).toBe(10_000);
    expect(summary.coordinateKeys.size).toBe(10_000);
    expect(summary.coordinateKeys.has("row_100:column_100")).toBe(true);
    expect(summary.hasRangeBackedReferences).toBe(true);
  });

  it("formats a large explicit selected range in one batch", () => {
    const largeModel = createLargeExplicitModel(100, 100);
    const selection = selectTableRange(
      { columnId: "column_1", rowId: "row_1" },
      { columnId: "column_100", rowId: "row_100" },
    );

    const formatted = applyFormattingToSelectedCells(largeModel, selection, {
      emphasis: "strong",
      textAlign: "center",
      tone: "highlight",
    });

    expect(formatted.cells).toHaveLength(10_000);
    expect(
      formatted.cells.every(
        (cell) =>
          cell.formatting?.emphasis === "strong" &&
          cell.formatting.textAlign === "center" &&
          cell.formatting.tone === "highlight",
      ),
    ).toBe(true);
  });

  it("converts a large explicit selected range to answers in one batch", () => {
    const largeModel = createLargeExplicitModel(100, 100);
    const selection = selectTableRange(
      { columnId: "column_1", rowId: "row_1" },
      { columnId: "column_100", rowId: "row_100" },
    );

    const answers = makeSelectedCellsResponse(largeModel, selection);
    const responseFieldIds = answers.cells.flatMap((cell) => {
      const input = getPrimaryTableInputBlock(cell);
      return input ? [input.responseFieldId] : [];
    });

    expect(answers.responseFields).toHaveLength(10_000);
    expect(responseFieldIds).toHaveLength(10_000);
    expect(new Set(responseFieldIds).size).toBe(10_000);
    expect(() => validateTableEditorModel(answers)).not.toThrow();
  });

  it("converts a large answer range to content and prunes its fields", () => {
    const largeModel = createLargeExplicitModel(100, 100);
    const selection = selectTableRange(
      { columnId: "column_1", rowId: "row_1" },
      { columnId: "column_100", rowId: "row_100" },
    );
    const answers = makeSelectedCellsResponse(largeModel, selection);

    const content = makeSelectedCellsContent(answers, selection);

    expect(content.responseFields).toEqual([]);
    expect(
      content.cells.every((cell) => getPrimaryTableInputBlock(cell) === null),
    ).toBe(true);
    expect(() => validateTableEditorModel(content)).not.toThrow();
  });

  it("creates one unique cell per selected sparse coordinate", () => {
    const sparseModel = createLargeModel(3, 3);
    const selection = selectTableRange(
      { columnId: "column_1", rowId: "row_1" },
      { columnId: "column_3", rowId: "row_3" },
    );

    const answers = makeSelectedCellsResponse(sparseModel, selection);

    expect(answers.cells).toHaveLength(9);
    expect(new Set(answers.cells.map((cell) => cell.id)).size).toBe(9);
    expect(
      new Set(answers.cells.map((cell) => `${cell.rowId}:${cell.columnId}`))
        .size,
    ).toBe(9);
    expect(answers.responseFields).toHaveLength(9);
    expect(() => validateTableEditorModel(answers)).not.toThrow();
  });

  it("builds selected coordinate keys once for a realistic large range", () => {
    const largeModel = createLargeModel(100, 100);
    const selection = selectTableRange(
      { columnId: "column_1", rowId: "row_1" },
      { columnId: "column_100", rowId: "row_100" },
    );

    const selectedKeys = getSelectedTableCoordinateKeySet(
      largeModel,
      selection,
    );

    expect(selectedKeys.size).toBe(10_000);
    expect(selectedKeys.has("row_100:column_100")).toBe(true);
  });
});

function createLargeModel(
  rowCount: number,
  columnCount: number,
): TableEditorModel {
  return {
    ...createBaseModel(),
    cells: [],
    columns: Array.from({ length: columnCount }, (_, index) => ({
      id: `column_${index + 1}`,
      label: `Column ${index + 1}`,
    })),
    responseFields: [],
    rows: Array.from({ length: rowCount }, (_, index) => ({
      id: `row_${index + 1}`,
      label: `Row ${index + 1}`,
    })),
  };
}

function createLargeExplicitModel(
  rowCount: number,
  columnCount: number,
  rangeBackedLastCell = false,
): TableEditorModel {
  const model = createLargeModel(rowCount, columnCount);
  return {
    ...model,
    cells: model.rows.flatMap((row, rowIndex) =>
      model.columns.map((column, columnIndex) => ({
        blocks:
          rangeBackedLastCell &&
          rowIndex === rowCount - 1 &&
          columnIndex === columnCount - 1
            ? [
                {
                  content: [
                    {
                      rangeCell: { columnOffset: 0, rowOffset: 0 },
                      referenceId: "range_ref",
                      type: "reference" as const,
                    },
                  ],
                  id: `text_${rowIndex + 1}_${columnIndex + 1}`,
                  type: "text" as const,
                },
              ]
            : [],
        columnId: column.id,
        id: `cell_${rowIndex + 1}_${columnIndex + 1}`,
        rowId: row.id,
      })),
    ),
  };
}

function modelWithRichTextContent(
  content: Extract<
    TableEditorModel["cells"][number]["blocks"][number],
    { type: "rich_text" }
  >["content"],
): TableEditorModel {
  return {
    ...createBaseModel(),
    cells: [
      {
        blocks: [{ content, id: "rich_1", type: "rich_text" }],
        columnId: "column_1",
        id: "cell_1",
        rowId: "row_1",
      },
    ],
  };
}

function rangeBackedTableModel(): TableEditorModel {
  return {
    ...createBaseModel(),
    cells: [
      {
        blocks: [
          {
            content: [
              {
                fallbackText: "C2",
                rangeCell: { columnOffset: 2, rowOffset: 1 },
                referenceId: "range_ref",
                type: "reference",
              },
            ],
            id: "text_1",
            type: "text",
          },
        ],
        columnId: "column_1",
        id: "cell_1",
        rowId: "row_1",
      },
    ],
    responseFields: [],
  };
}

function rangeBackedComposedModel(
  existingDirectReference?: ComposedEditorModel["references"][number],
): ComposedEditorModel {
  return {
    blocks: [{ id: "table_1", table: rangeBackedTableModel(), type: "table" }],
    references: [
      {
        id: "range_ref",
        source: {
          ref: "Sheet1!A1:D4",
          sourceId: "source_1",
          type: "workbook_range",
        },
      },
      ...(existingDirectReference ? [existingDirectReference] : []),
    ],
    responseFields: [],
    schemaVersion: 2,
  };
}

function requireTable(model: ComposedEditorModel): TableEditorModel {
  const block = findComposedBlockById(model.blocks, "table_1");
  if (block?.type !== "table") {
    throw new Error("Expected table block.");
  }
  return block.table;
}

function requireTableCell(
  model: ComposedEditorModel,
  index: number,
): TableEditorModel["cells"][number] {
  const cell = requireTable(model).cells[index];
  if (!cell) {
    throw new Error("Expected table cell.");
  }
  return cell;
}

function requireReferenceForWorkbookCell(
  model: ComposedEditorModel,
  ref: string,
): ComposedEditorModel["references"][number] {
  const reference = model.references.find(
    (item) => item.source.type === "workbook_cell" && item.source.ref === ref,
  );
  if (!reference) {
    throw new Error(`Expected workbook cell reference ${ref}.`);
  }
  return reference;
}

function requireCellFromModel(
  model: TableEditorModel,
  index: number,
): TableEditorModel["cells"][number] {
  const cell = model.cells[index];
  if (!cell) {
    throw new Error("Expected table cell.");
  }
  return cell;
}

function rangeBackedComposedModelWithReferences(
  references: ComposedEditorModel["references"],
): ComposedEditorModel {
  return {
    ...rangeBackedComposedModel(),
    references,
  };
}

function mixedRangeBackedComposedModel(): ComposedEditorModel {
  return {
    ...rangeBackedComposedModel(),
    blocks: [
      {
        id: "table_1",
        table: {
          ...rangeBackedTableModel(),
          cells: [
            requireCellFromModel(rangeBackedTableModel(), 0),
            {
              blocks: [
                {
                  content: [
                    {
                      fallbackText: "A1",
                      rangeCell: { columnOffset: 0, rowOffset: 0 },
                      referenceId: "missing_range_ref",
                      type: "reference",
                    },
                  ],
                  id: "text_2",
                  type: "text",
                },
              ],
              columnId: "column_2",
              id: "cell_2",
              rowId: "row_1",
            },
          ],
        },
        type: "table",
      },
    ],
  };
}

function nestedRangeBackedComposedModel(
  containerType: "page" | "step",
): ComposedEditorModel {
  return {
    ...rangeBackedComposedModel(),
    blocks: [
      {
        blocks: [
          nestedSiblingBlock(),
          { id: "table_1", table: rangeBackedTableModel(), type: "table" },
          { id: "separator_1", type: "separator" },
        ],
        containerType,
        id: `${containerType}_1`,
        title: containerType === "page" ? "Page" : "Step",
        type: "container",
      },
    ],
    references: [
      ...rangeBackedComposedModel().references,
      unrelatedReference(),
    ],
    responseFields: [{ id: "outside_answer", label: "Outside", type: "text" }],
  };
}

function nestedSiblingBlock(): ComposedEditorBlock {
  return {
    content: [{ text: "Sibling", type: "text" }],
    id: "text_sibling",
    type: "text",
  };
}

function unrelatedReference(): ComposedEditorModel["references"][number] {
  return { id: "unrelated_ref", source: { type: "literal", value: "Keep" } };
}

function requireNestedContainer(
  model: ComposedEditorModel,
): Extract<ComposedEditorBlock, { type: "container" }> {
  const block = model.blocks[0];
  if (block?.type !== "container") {
    throw new Error("Expected nested container.");
  }
  return block;
}
