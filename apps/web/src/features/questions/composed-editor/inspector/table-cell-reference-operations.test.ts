import { describe, expect, it } from "vitest";
import {
  type ComposedEditorModel,
  createDefaultComposedEditorModel,
  createTableBlock,
  type TableEditorPrimitiveBlock,
  type TableResponseField,
} from "#/domains/questions/authoring";
import {
  updateTableCellValueInComposedModel,
  updateTableContentCellInlineContentInComposedModel,
} from "./table-cell-reference-operations";

describe("table cell reference operations", () => {
  it("updates a table cell inside nested page and step containers", () => {
    const table = createTableBlock("table_1");
    const inputCell = table.table.cells.find((cell) =>
      cell.blocks.some((block) => block.type === "input"),
    );
    if (!inputCell) {
      throw new Error("Expected default table input cell.");
    }
    const model: ComposedEditorModel = {
      ...createDefaultComposedEditorModel(),
      blocks: [
        {
          blocks: [
            {
              blocks: [table],
              containerType: "step",
              id: "step_1",
              type: "container",
            },
          ],
          containerType: "page",
          id: "page_1",
          type: "container",
        },
      ],
    };

    const updated = updateTableCellValueInComposedModel({
      cellId: inputCell.id,
      editorModel: model,
      tableBlockId: table.id,
      value: { referenceId: "reference_1", type: "reference" },
    });
    const page = updated.blocks[0];
    const step = page?.type === "container" ? page.blocks[0] : undefined;
    const updatedTable =
      step?.type === "container" ? step.blocks[0] : undefined;
    const updatedInput =
      updatedTable?.type === "table"
        ? updatedTable.table.cells
            .find((cell) => cell.id === inputCell.id)
            ?.blocks.find((block) => block.type === "input")
        : undefined;

    expect(updatedInput?.correctValueSource).toEqual({
      referenceId: "reference_1",
      type: "reference",
    });
  });

  it("updates only the targeted table text primitive by cell block id", () => {
    const model = createModelWithTableCell([
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
    ]);

    const updated = updateTableContentCellInlineContentInComposedModel({
      cellBlockId: "text_1",
      cellId: "cell_1",
      content: [{ referenceId: "reference_1", type: "reference" }],
      editorModel: model,
      tableBlockId: "table_1",
    });
    const blocks = getTableCellBlocks(updated);

    expect(blocks).toEqual([
      {
        content: [{ referenceId: "reference_1", type: "reference" }],
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

  it("updates only the targeted table input primitive by cell block id", () => {
    const model = createModelWithTableCell(
      [
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
      [
        { id: "answer_1", type: "text" },
        { id: "answer_2", type: "text" },
      ],
    );

    const updated = updateTableCellValueInComposedModel({
      cellBlockId: "input_1",
      cellId: "cell_1",
      editorModel: model,
      tableBlockId: "table_1",
      value: { referenceId: "reference_1", type: "reference" },
    });
    const blocks = getTableCellBlocks(updated);

    expect(blocks).toEqual([
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

  it("preserves table primitive order after targeted value edits", () => {
    const model = createModelWithTableCell([
      {
        content: [{ text: "Prefix", type: "text" }],
        id: "text_1",
        type: "text",
      },
      {
        correctValueSource: { type: "literal", value: "A" },
        grading: { mode: "exact" },
        id: "input_1",
        points: 1,
        responseFieldId: "answer_1",
        type: "input",
      },
      {
        content: [{ text: "Suffix", type: "text" }],
        id: "text_2",
        type: "text",
      },
    ]);

    const updated = updateTableCellValueInComposedModel({
      cellBlockId: "text_2",
      cellId: "cell_1",
      editorModel: model,
      tableBlockId: "table_1",
      value: { type: "literal", value: "Updated" },
    });

    expect(getTableCellBlocks(updated).map((block) => block.id)).toEqual([
      "text_1",
      "input_1",
      "text_2",
    ]);
  });
});

function createModelWithTableCell(
  blocks: TableEditorPrimitiveBlock[],
  responseFields: TableResponseField[] = [{ id: "answer_1", type: "text" }],
): ComposedEditorModel {
  return {
    ...createDefaultComposedEditorModel(),
    blocks: [
      createTableBlock("table_1", {
        blockId: "table_1",
        cells: [
          {
            blocks,
            columnId: "column_1",
            id: "cell_1",
            rowId: "row_1",
          },
        ],
        columns: [{ id: "column_1", label: "Column" }],
        prompt: "",
        responseFields,
        rows: [{ id: "row_1", label: "Row" }],
        showColumnNames: true,
        showRowNames: true,
      }),
    ],
  };
}

function getTableCellBlocks(model: ComposedEditorModel) {
  const table = model.blocks[0];
  if (table?.type !== "table") {
    throw new Error("Expected table block.");
  }
  return table.table.cells[0]?.blocks ?? [];
}
