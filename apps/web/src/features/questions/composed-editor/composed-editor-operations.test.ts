import { describe, expect, it } from "vitest";
import {
  type ComposedEditorBlock,
  type ComposedEditorModel,
  type ComposedResponseField,
  createResponseBlock,
  createRichTextBlock,
  createSeparatorBlock,
  createTableBlock,
  createTextBlock,
} from "#/domains/questions/authoring";
import {
  deleteComposedBlock,
  duplicateComposedBlock,
  getComposedEditorSelectedBlock,
  insertComposedBlock,
  moveComposedBlockInEditor,
  normalizeComposedEditorSelection,
  selectBlockInComposedEditor,
  selectFirstBlockOrDocument,
} from "./composed-editor-operations";

const sharedResponseFields: ComposedResponseField[] = [
  {
    id: "answer_1",
    label: "Answer",
    required: true,
    type: "number",
  },
];

function createBaseModel(blocks: ComposedEditorBlock[]): ComposedEditorModel {
  return {
    blocks,
    references: [
      {
        id: "reference_1",
        source: { type: "literal", value: "Alpha" },
      },
    ],
    responseFields: sharedResponseFields.map((field) => ({ ...field })),
    schemaVersion: 2,
  };
}

function createModelWithTable(
  blocks: ComposedEditorBlock[],
): ComposedEditorModel {
  return {
    ...createBaseModel(blocks),
    blocks: [...blocks],
  };
}

describe("composed editor operations", () => {
  it("selects the first block or document", () => {
    expect(selectFirstBlockOrDocument(createBaseModel([]))).toEqual({
      type: "document",
    });
    expect(
      selectFirstBlockOrDocument(
        createBaseModel([createTextBlock("text_1", "Prompt")]),
      ),
    ).toEqual({
      blockId: "text_1",
      type: "block",
    });
    expect(
      selectFirstBlockOrDocument(
        createBaseModel([createTableBlock("table_1")]),
      ),
    ).toEqual({
      blockId: "table_1",
      type: "table",
    });
  });

  it("selects blocks by id", () => {
    expect(
      selectBlockInComposedEditor(
        createModelWithTable([
          createTextBlock("text_1", "Prompt"),
          createTableBlock("table_1"),
        ]),
        "table_1",
      ),
    ).toEqual({
      blockId: "table_1",
      type: "table",
    });
    expect(
      selectBlockInComposedEditor(
        createBaseModel([createTextBlock("text_1", "Prompt")]),
        "text_1",
      ),
    ).toEqual({
      blockId: "text_1",
      type: "block",
    });
    expect(selectBlockInComposedEditor(createBaseModel([]), "missing")).toEqual(
      {
        type: "document",
      },
    );
  });

  it("inserts a text block and selects it", () => {
    const model = createBaseModel([
      createTextBlock("text_1", "Prompt"),
      createResponseBlock("response_1", "answer_1", {
        placeholder: "Answer",
      }),
    ]);

    const result = insertComposedBlock({ model, type: "text" });

    expect(result.model.blocks.map((block) => block.id)).toEqual([
      "text_1",
      "response_1",
      "text_2",
    ]);
    expect(result.selection).toEqual({ blockId: "text_2", type: "block" });
  });

  it("inserts a rich text block and selects it", () => {
    const model = createBaseModel([
      createTextBlock("text_1", "Prompt"),
      createResponseBlock("response_1", "answer_1", {
        placeholder: "Answer",
      }),
    ]);

    const result = insertComposedBlock({ model, type: "rich_text" });

    expect(result.model.blocks.map((block) => block.id)).toEqual([
      "text_1",
      "response_1",
      "rich_text_1",
    ]);
    expect(result.selection).toEqual({ blockId: "rich_text_1", type: "block" });
  });

  it("inserts an answer block with a matching response field", () => {
    const model = createBaseModel([
      createTextBlock("text_1", "Prompt"),
      createResponseBlock("response_1", "answer_1", {
        placeholder: "Answer",
      }),
    ]);

    const result = insertComposedBlock({ model, type: "response" });
    const block = result.model.blocks.find(
      (candidate) => candidate.id === "response_2",
    );

    if (block?.type !== "response") {
      throw new Error("Expected answer input block.");
    }

    expect(block.responseFieldId).toBe("answer_2");
    expect(
      result.model.responseFields.some((field) => field.id === "answer_2"),
    ).toBe(true);
    expect(result.selection).toEqual({ blockId: "response_2", type: "block" });
  });

  it("inserts a separator block and selects it", () => {
    const model = createBaseModel([
      createTextBlock("text_1", "Prompt"),
      createResponseBlock("response_1", "answer_1", {
        placeholder: "Answer",
      }),
    ]);

    const result = insertComposedBlock({ model, type: "separator" });

    expect(result.model.blocks.map((block) => block.id)).toEqual([
      "text_1",
      "response_1",
      "separator_1",
    ]);
    expect(result.selection).toEqual({ blockId: "separator_1", type: "block" });
  });

  it("inserts a table block and selects it", () => {
    const model = createBaseModel([
      createTextBlock("text_1", "Prompt"),
      createResponseBlock("response_1", "answer_1", {
        placeholder: "Answer",
      }),
    ]);

    const result = insertComposedBlock({ model, type: "table" });

    expect(result.model.blocks.map((block) => block.id)).toEqual([
      "text_1",
      "response_1",
      "table_1",
    ]);
    expect(result.selection).toEqual({ blockId: "table_1", type: "table" });
  });

  it("inserts after a specific block when the id exists", () => {
    const model = createBaseModel([
      createTextBlock("text_1", "Prompt"),
      createResponseBlock("response_1", "answer_1", {
        placeholder: "Answer",
      }),
    ]);

    const result = insertComposedBlock({
      afterBlockId: "text_1",
      model,
      type: "text",
    });

    expect(result.model.blocks.map((block) => block.id)).toEqual([
      "text_1",
      "text_2",
      "response_1",
    ]);
  });

  it("appends when the after block id is missing", () => {
    const model = createBaseModel([
      createTextBlock("text_1", "Prompt"),
      createResponseBlock("response_1", "answer_1", {
        placeholder: "Answer",
      }),
    ]);

    const result = insertComposedBlock({
      afterBlockId: "missing",
      model,
      type: "text",
    });

    expect(result.model.blocks.map((block) => block.id)).toEqual([
      "text_1",
      "response_1",
      "text_2",
    ]);
  });

  it("duplicates a text block after the original with a fresh block id", () => {
    const model = createBaseModel([
      createTextBlock("text_1", "Prompt"),
      createResponseBlock("response_1", "answer_1", {
        placeholder: "Answer",
      }),
    ]);

    const result = duplicateComposedBlock(model, "text_1");

    expect(result.model.blocks.map((block) => block.id)).toEqual([
      "text_1",
      "text_2",
      "response_1",
    ]);
    expect(result.selection).toEqual({ blockId: "text_2", type: "block" });
    expect(model.blocks.map((block) => block.id)).toEqual([
      "text_1",
      "response_1",
    ]);
  });

  it("duplicates a rich text block after the original with a fresh block id", () => {
    const model = createBaseModel([
      createTextBlock("text_1", "Prompt"),
      createRichTextBlock("rich_text_1"),
      createResponseBlock("response_1", "answer_1", {
        placeholder: "Answer",
      }),
    ]);

    const result = duplicateComposedBlock(model, "rich_text_1");

    expect(result.model.blocks.map((block) => block.id)).toEqual([
      "text_1",
      "rich_text_1",
      "rich_text_2",
      "response_1",
    ]);
    expect(result.selection).toEqual({
      blockId: "rich_text_2",
      type: "block",
    });
  });

  it("duplicates a separator block after the original with a fresh block id", () => {
    const model = createBaseModel([
      createTextBlock("text_1", "Prompt"),
      createSeparatorBlock("separator_1"),
      createResponseBlock("response_1", "answer_1", {
        placeholder: "Answer",
      }),
    ]);

    const result = duplicateComposedBlock(model, "separator_1");

    expect(result.model.blocks.map((block) => block.id)).toEqual([
      "text_1",
      "separator_1",
      "separator_2",
      "response_1",
    ]);
    expect(result.selection).toEqual({
      blockId: "separator_2",
      type: "block",
    });
  });

  it("duplicates a table block after the original with a fresh block id", () => {
    const model = createBaseModel([
      createTextBlock("text_1", "Prompt"),
      createTableBlock("table_1"),
      createResponseBlock("response_1", "answer_1", {
        placeholder: "Answer",
      }),
    ]);

    const result = duplicateComposedBlock(model, "table_1");

    expect(result.model.blocks.map((block) => block.id)).toEqual([
      "text_1",
      "table_1",
      "table_2",
      "response_1",
    ]);
    expect(result.selection).toEqual({ blockId: "table_2", type: "table" });
  });

  it("duplicates nested containers with fresh descendant and answer ids", () => {
    const model = createBaseModel([
      {
        blocks: [
          {
            blocks: [
              createTextBlock("text_1", "Prompt"),
              createResponseBlock("response_1", "answer_1"),
            ],
            containerType: "step",
            id: "step_1",
            type: "container",
          },
        ],
        containerType: "page",
        id: "page_1",
        type: "container",
      },
    ]);

    const result = duplicateComposedBlock(model, "page_1");
    const duplicated = result.model.blocks[1];
    if (duplicated?.type !== "container") {
      throw new Error("Expected duplicated page container.");
    }
    const duplicatedStep = duplicated.blocks[0];
    if (duplicatedStep?.type !== "container") {
      throw new Error("Expected duplicated step container.");
    }
    const duplicatedInput = duplicatedStep.blocks.find(
      (block) => block.type === "response",
    );
    if (duplicatedInput?.type !== "response") {
      throw new Error("Expected duplicated input block.");
    }

    expect([duplicated.id, duplicatedStep.id]).not.toContain("page_1");
    expect(duplicatedStep.blocks.map((block) => block.id)).not.toContain(
      "text_1",
    );
    expect(duplicatedStep.blocks.map((block) => block.id)).not.toContain(
      "response_1",
    );
    expect(duplicatedInput.responseFieldId).toBe("answer_2");
  });

  it("duplicates container table primitives and table response fields", () => {
    const table = createTableBlock("table_1", {
      blockId: "table_1",
      cells: [
        {
          blocks: [
            {
              grading: { mode: "manual" },
              id: "table_input_1",
              points: 1,
              responseFieldId: "table_answer_1",
              type: "input",
            },
          ],
          columnId: "column_1",
          id: "cell_1",
          rowId: "row_1",
        },
      ],
      columns: [{ id: "column_1", label: "Column" }],
      prompt: "",
      responseFields: [{ id: "table_answer_1", type: "text" }],
      rows: [{ id: "row_1", label: "Row" }],
      showColumnNames: true,
      showRowNames: true,
    });
    const model = createBaseModel([
      {
        blocks: [table],
        containerType: "page",
        id: "page_1",
        type: "container",
      },
    ]);

    const result = duplicateComposedBlock(model, "page_1");
    const duplicated = result.model.blocks[1];
    if (duplicated?.type !== "container") {
      throw new Error("Expected duplicated page container.");
    }
    const duplicatedTable = duplicated.blocks[0];
    if (duplicatedTable?.type !== "table") {
      throw new Error("Expected duplicated table block.");
    }
    const duplicatedPrimitive = duplicatedTable.table.cells[0]?.blocks[0];

    expect(duplicatedTable.id).not.toBe(table.id);
    expect(duplicatedPrimitive?.id).not.toBe("table_input_1");
    expect(duplicatedTable.table.responseFields[0]?.id).not.toBe(
      "table_answer_1",
    );
    expect(
      duplicatedPrimitive?.type === "input"
        ? duplicatedPrimitive.responseFieldId
        : null,
    ).toBe(duplicatedTable.table.responseFields[0]?.id);
  });

  it("duplicates every table input with fresh response field ids", () => {
    const table = createTableBlock("table_1", {
      blockId: "table_1",
      cells: [
        {
          blocks: [
            {
              correctValueSource: { type: "literal", value: "A" },
              grading: { mode: "exact" },
              id: "table_input_1",
              points: 1,
              responseFieldId: "table_answer_1",
              type: "input",
            },
            {
              correctValueSource: { type: "literal", value: "B" },
              grading: { mode: "exact" },
              id: "table_input_2",
              points: 1,
              responseFieldId: "table_answer_2",
              type: "input",
            },
          ],
          columnId: "column_1",
          id: "cell_1",
          rowId: "row_1",
        },
      ],
      columns: [{ id: "column_1", label: "Column" }],
      prompt: "",
      responseFields: [
        { id: "table_answer_1", type: "text" },
        { id: "table_answer_2", type: "text" },
      ],
      rows: [{ id: "row_1", label: "Row" }],
      showColumnNames: true,
      showRowNames: true,
    });
    const model = createBaseModel([table]);

    const result = duplicateComposedBlock(model, "table_1");
    const duplicatedTable = result.model.blocks[1];
    if (duplicatedTable?.type !== "table") {
      throw new Error("Expected duplicated table block.");
    }

    const duplicatedInputs = duplicatedTable.table.cells[0]?.blocks.filter(
      (block) => block.type === "input",
    );
    expect(duplicatedInputs).toHaveLength(2);
    expect(duplicatedInputs?.map((block) => block.id)).not.toContain(
      "table_input_1",
    );
    expect(duplicatedInputs?.map((block) => block.responseFieldId)).toEqual(
      duplicatedTable.table.responseFields.map((field) => field.id),
    );
    expect(
      duplicatedTable.table.responseFields.map((field) => field.id),
    ).not.toContain("table_answer_1");
  });

  it("rejects table duplication when an input references a missing response field", () => {
    const table = createTableBlock("table_1", {
      blockId: "table_1",
      cells: [
        {
          blocks: [
            {
              grading: { mode: "manual" },
              id: "table_input_1",
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
      columns: [{ id: "column_1", label: "Column" }],
      prompt: "",
      responseFields: [],
      rows: [{ id: "row_1", label: "Row" }],
      showColumnNames: true,
      showRowNames: true,
    });

    expect(() =>
      duplicateComposedBlock(createBaseModel([table]), "table_1"),
    ).toThrow(
      "Input block table_input_1 in cell cell_1 references missing response field missing_answer.",
    );
  });

  it("duplicates an answer block with a fresh response field id", () => {
    const model = createBaseModel([
      createTextBlock("text_1", "Prompt"),
      createResponseBlock("response_1", "answer_1", {
        placeholder: "Answer",
      }),
    ]);

    const result = duplicateComposedBlock(model, "response_1");
    const duplicatedBlock = result.model.blocks.find(
      (block) => block.id === "response_2",
    );

    if (duplicatedBlock?.type !== "response") {
      throw new Error("Expected duplicated answer input block.");
    }

    expect(duplicatedBlock.responseFieldId).toBe("answer_2");
    expect(duplicatedBlock.responseFieldId).not.toBe("answer_1");
    expect(
      result.model.responseFields.some((field) => field.id === "answer_2"),
    ).toBe(true);
    expect(model.blocks[1]).toEqual(
      createResponseBlock("response_1", "answer_1", {
        placeholder: "Answer",
      }),
    );
  });

  it("rejects answer block duplication when its response field is missing", () => {
    const model: ComposedEditorModel = {
      ...createBaseModel([
        createResponseBlock("response_1", "missing_answer", {
          placeholder: "Answer",
        }),
      ]),
      responseFields: [],
    };

    expect(() => duplicateComposedBlock(model, "response_1")).toThrow(
      "Cannot duplicate input block response_1: missing response field missing_answer.",
    );
  });

  it("deletes a text block and selects the next block", () => {
    const model = createBaseModel([
      createTextBlock("text_1", "Prompt"),
      createResponseBlock("response_1", "answer_1", {
        placeholder: "Answer",
      }),
      createSeparatorBlock("separator_1"),
    ]);

    const result = deleteComposedBlock(model, "text_1");

    expect(result.model.blocks.map((block) => block.id)).toEqual([
      "response_1",
      "separator_1",
    ]);
    expect(result.selection).toEqual({ blockId: "response_1", type: "block" });
  });

  it("deletes the last block and selects the previous block", () => {
    const model = createBaseModel([
      createTextBlock("text_1", "Prompt"),
      createResponseBlock("response_1", "answer_1", {
        placeholder: "Answer",
      }),
      createSeparatorBlock("separator_1"),
    ]);

    const result = deleteComposedBlock(model, "separator_1");

    expect(result.model.blocks.map((block) => block.id)).toEqual([
      "text_1",
      "response_1",
    ]);
    expect(result.selection).toEqual({ blockId: "response_1", type: "block" });
  });

  it("deletes the only block and selects the document", () => {
    const model = createBaseModel([createTextBlock("text_1", "Prompt")]);

    const result = deleteComposedBlock(model, "text_1");

    expect(result.model.blocks).toEqual([]);
    expect(result.selection).toEqual({ type: "document" });
  });

  it("deletes an answer block and prunes its response field when unused", () => {
    const model = createBaseModel([
      createTextBlock("text_1", "Prompt"),
      createResponseBlock("response_1", "answer_1", {
        placeholder: "Answer",
      }),
    ]);

    const result = deleteComposedBlock(model, "response_1");

    expect(result.model.blocks.map((block) => block.id)).toEqual(["text_1"]);
    expect(result.model.responseFields).toEqual([]);
  });

  it("does not prune a response field if another block still uses it", () => {
    const model = {
      ...createBaseModel([
        createTextBlock("text_1", "Prompt"),
        createResponseBlock("response_1", "answer_1", {
          placeholder: "Answer",
        }),
        createResponseBlock("response_2", "answer_1", {
          placeholder: "Answer",
        }),
      ]),
      responseFields: sharedResponseFields.map((field) => ({ ...field })),
    };

    const result = deleteComposedBlock(model, "response_1");

    expect(result.model.responseFields).toEqual([
      {
        id: "answer_1",
        label: "Answer",
        required: true,
        type: "number",
      },
    ]);
  });

  it("deleting a missing block does not crash", () => {
    const model = createBaseModel([
      createTextBlock("text_1", "Prompt"),
      createResponseBlock("response_1", "answer_1", {
        placeholder: "Answer",
      }),
    ]);

    const result = deleteComposedBlock(model, "missing");

    expect(result.model).toBe(model);
    expect(result.selection).toEqual({ blockId: "text_1", type: "block" });
  });

  it("moves a block up and keeps the selection on the moved block", () => {
    const model = createBaseModel([
      createTextBlock("text_1", "Prompt"),
      createResponseBlock("response_1", "answer_1", {
        placeholder: "Answer",
      }),
      createSeparatorBlock("separator_1"),
    ]);

    const result = moveComposedBlockInEditor({
      blockId: "response_1",
      direction: "up",
      model,
    });

    expect(result.model.blocks.map((block) => block.id)).toEqual([
      "response_1",
      "text_1",
      "separator_1",
    ]);
    expect(result.selection).toEqual({ blockId: "response_1", type: "block" });
  });

  it("moves a block down and keeps the selection on the moved block", () => {
    const model = createBaseModel([
      createTextBlock("text_1", "Prompt"),
      createResponseBlock("response_1", "answer_1", {
        placeholder: "Answer",
      }),
      createSeparatorBlock("separator_1"),
    ]);

    const result = moveComposedBlockInEditor({
      blockId: "text_1",
      direction: "down",
      model,
    });

    expect(result.model.blocks.map((block) => block.id)).toEqual([
      "response_1",
      "text_1",
      "separator_1",
    ]);
    expect(result.selection).toEqual({ blockId: "text_1", type: "block" });
  });

  it("cannot move the first block up", () => {
    const model = createBaseModel([
      createTextBlock("text_1", "Prompt"),
      createResponseBlock("response_1", "answer_1", {
        placeholder: "Answer",
      }),
    ]);

    const result = moveComposedBlockInEditor({
      blockId: "text_1",
      direction: "up",
      model,
    });

    expect(result.model.blocks.map((block) => block.id)).toEqual([
      "text_1",
      "response_1",
    ]);
    expect(result.selection).toEqual({ blockId: "text_1", type: "block" });
  });

  it("cannot move the last block down", () => {
    const model = createBaseModel([
      createTextBlock("text_1", "Prompt"),
      createResponseBlock("response_1", "answer_1", {
        placeholder: "Answer",
      }),
    ]);

    const result = moveComposedBlockInEditor({
      blockId: "response_1",
      direction: "down",
      model,
    });

    expect(result.model.blocks.map((block) => block.id)).toEqual([
      "text_1",
      "response_1",
    ]);
    expect(result.selection).toEqual({ blockId: "response_1", type: "block" });
  });

  it("returns the same model and document selection when moving a missing block", () => {
    const model = createBaseModel([createTextBlock("text_1", "Prompt")]);

    const result = moveComposedBlockInEditor({
      blockId: "missing",
      direction: "up",
      model,
    });

    expect(result.model).toBe(model);
    expect(result.selection).toEqual({ type: "document" });
  });

  it("returns table selection when moving a table block", () => {
    const model = createBaseModel([
      createTextBlock("text_1", "Prompt"),
      createTableBlock("table_1"),
      createResponseBlock("response_1", "answer_1", {
        placeholder: "Answer",
      }),
    ]);

    const result = moveComposedBlockInEditor({
      blockId: "table_1",
      direction: "up",
      model,
    });

    expect(result.selection).toEqual({ blockId: "table_1", type: "table" });
  });

  it("preserves document selection", () => {
    const model = createModelWithTable([
      createTextBlock("text_1", "Prompt"),
      createTableBlock("table_1"),
    ]);

    expect(
      normalizeComposedEditorSelection(model, { type: "document" }),
    ).toEqual({ type: "document" });
  });

  it("preserves an existing block selection", () => {
    const model = createModelWithTable([
      createTextBlock("text_1", "Prompt"),
      createTableBlock("table_1"),
    ]);

    expect(
      normalizeComposedEditorSelection(model, {
        blockId: "text_1",
        type: "block",
      }),
    ).toEqual({ blockId: "text_1", type: "block" });
  });

  it("normalizes a table block selected as a block into a table selection", () => {
    const model = createModelWithTable([
      createTextBlock("text_1", "Prompt"),
      createTableBlock("table_1"),
    ]);

    expect(
      normalizeComposedEditorSelection(model, {
        blockId: "table_1",
        type: "block",
      }),
    ).toEqual({ blockId: "table_1", type: "table" });
  });

  it("normalizes a table selection to a block selection when the block is no longer a table", () => {
    const model = createBaseModel([createTextBlock("text_1", "Prompt")]);

    expect(
      normalizeComposedEditorSelection(model, {
        blockId: "text_1",
        type: "table",
      }),
    ).toEqual({ blockId: "text_1", type: "block" });
  });

  it("preserves an existing table cell selection when the cell exists", () => {
    const model = createModelWithTable([
      createTextBlock("text_1", "Prompt"),
      createTableBlock("table_1"),
    ]);

    expect(
      normalizeComposedEditorSelection(model, {
        blockId: "table_1",
        cellId: "cell_1",
        type: "table_cell",
      }),
    ).toEqual({
      blockId: "table_1",
      cellId: "cell_1",
      type: "table_cell",
    });
  });

  it("normalizes a missing table cell to the table selection when the table still exists", () => {
    const model = createModelWithTable([
      createTextBlock("text_1", "Prompt"),
      createTableBlock("table_1"),
    ]);

    expect(
      normalizeComposedEditorSelection(model, {
        blockId: "table_1",
        cellId: "missing",
        type: "table_cell",
      }),
    ).toEqual({ blockId: "table_1", type: "table" });
  });

  it("normalizes a missing table row to the table selection when the table still exists", () => {
    const model = createModelWithTable([
      createTextBlock("text_1", "Prompt"),
      createTableBlock("table_1"),
    ]);

    expect(
      normalizeComposedEditorSelection(model, {
        blockId: "table_1",
        rowId: "missing",
        type: "table_row",
      }),
    ).toEqual({ blockId: "table_1", type: "table" });
  });

  it("normalizes a missing table column to the table selection when the table still exists", () => {
    const model = createModelWithTable([
      createTextBlock("text_1", "Prompt"),
      createTableBlock("table_1"),
    ]);

    expect(
      normalizeComposedEditorSelection(model, {
        blockId: "table_1",
        columnId: "missing",
        type: "table_column",
      }),
    ).toEqual({ blockId: "table_1", type: "table" });
  });

  it("normalizes a missing table to the first block or document", () => {
    const model = createBaseModel([createTextBlock("text_1", "Prompt")]);

    expect(
      normalizeComposedEditorSelection(model, {
        blockId: "table_1",
        type: "table",
      }),
    ).toEqual({ blockId: "text_1", type: "block" });
  });

  it("preserves a reference selection when the reference exists", () => {
    const model = createModelWithTable([
      createTextBlock("text_1", "Prompt"),
      createTableBlock("table_1"),
    ]);

    expect(
      normalizeComposedEditorSelection(model, {
        referenceId: "reference_1",
        type: "reference",
      }),
    ).toEqual({ referenceId: "reference_1", type: "reference" });
  });

  it("normalizes a missing reference selection to the document", () => {
    const model = createModelWithTable([
      createTextBlock("text_1", "Prompt"),
      createTableBlock("table_1"),
    ]);

    expect(
      normalizeComposedEditorSelection(model, {
        referenceId: "missing",
        type: "reference",
      }),
    ).toEqual({ type: "document" });
  });

  it("returns the selected block for block, table, and table cell selections", () => {
    const model = createModelWithTable([
      createTextBlock("text_1", "Prompt"),
      createTableBlock("table_1"),
    ]);

    expect(
      getComposedEditorSelectedBlock(model, {
        blockId: "text_1",
        type: "block",
      }),
    ).toEqual(createTextBlock("text_1", "Prompt"));
    expect(
      getComposedEditorSelectedBlock(model, {
        blockId: "table_1",
        type: "table",
      }),
    ).toEqual(createTableBlock("table_1"));
    expect(
      getComposedEditorSelectedBlock(model, {
        blockId: "table_1",
        cellId: "cell_1",
        type: "table_cell",
      }),
    ).toEqual(createTableBlock("table_1"));
  });

  it("returns null for document and reference selections", () => {
    const model = createModelWithTable([
      createTextBlock("text_1", "Prompt"),
      createTableBlock("table_1"),
    ]);

    expect(getComposedEditorSelectedBlock(model, { type: "document" })).toBe(
      null,
    );
    expect(
      getComposedEditorSelectedBlock(model, {
        referenceId: "reference_1",
        type: "reference",
      }),
    ).toBe(null);
  });

  it("returns null when the selected block id is missing", () => {
    const model = createModelWithTable([
      createTextBlock("text_1", "Prompt"),
      createTableBlock("table_1"),
    ]);

    expect(
      getComposedEditorSelectedBlock(model, {
        blockId: "missing",
        type: "block",
      }),
    ).toBe(null);
  });
});
