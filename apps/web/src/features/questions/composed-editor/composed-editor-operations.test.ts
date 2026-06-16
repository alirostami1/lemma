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
    type: "number",
    label: "Answer",
    required: true,
  },
];

function createBaseModel(blocks: ComposedEditorBlock[]): ComposedEditorModel {
  return {
    schemaVersion: 1,
    blocks,
    responseFields: sharedResponseFields.map((field) => ({ ...field })),
    references: [
      {
        id: "reference_1",
        source: { type: "literal", value: "Alpha" },
      },
    ],
  };
}

function createModelWithTable(blocks: ComposedEditorBlock[]): ComposedEditorModel {
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
      type: "block",
      blockId: "text_1",
    });
    expect(
      selectFirstBlockOrDocument(
        createBaseModel([createTableBlock("table_1")]),
      ),
    ).toEqual({
      type: "table",
      blockId: "table_1",
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
      type: "table",
      blockId: "table_1",
    });
    expect(
      selectBlockInComposedEditor(
        createBaseModel([createTextBlock("text_1", "Prompt")]),
        "text_1",
      ),
    ).toEqual({
      type: "block",
      blockId: "text_1",
    });
    expect(
      selectBlockInComposedEditor(createBaseModel([]), "missing"),
    ).toEqual({
      type: "document",
    });
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
    expect(result.selection).toEqual({ type: "block", blockId: "text_2" });
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
    expect(result.selection).toEqual({ type: "block", blockId: "rich_text_1" });
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

    if (!block || block.type !== "response") {
      throw new Error("Expected response block.");
    }

    expect(block.responseFieldId).toBe("answer_2");
    expect(
      result.model.responseFields.some((field) => field.id === "answer_2"),
    ).toBe(true);
    expect(result.selection).toEqual({ type: "block", blockId: "response_2" });
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
    expect(result.selection).toEqual({ type: "block", blockId: "separator_1" });
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
    expect(result.selection).toEqual({ type: "table", blockId: "table_1" });
  });

  it("inserts after a specific block when the id exists", () => {
    const model = createBaseModel([
      createTextBlock("text_1", "Prompt"),
      createResponseBlock("response_1", "answer_1", {
        placeholder: "Answer",
      }),
    ]);

    const result = insertComposedBlock({
      model,
      type: "text",
      afterBlockId: "text_1",
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
      model,
      type: "text",
      afterBlockId: "missing",
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
    expect(result.selection).toEqual({ type: "block", blockId: "text_2" });
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
      type: "block",
      blockId: "rich_text_2",
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
      type: "block",
      blockId: "separator_2",
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
    expect(result.selection).toEqual({ type: "table", blockId: "table_2" });
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

    if (!duplicatedBlock || duplicatedBlock.type !== "response") {
      throw new Error("Expected duplicated response block.");
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
    expect(result.selection).toEqual({ type: "block", blockId: "response_1" });
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
    expect(result.selection).toEqual({ type: "block", blockId: "response_1" });
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
        type: "number",
        label: "Answer",
        required: true,
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
    expect(result.selection).toEqual({ type: "block", blockId: "text_1" });
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
      model,
      blockId: "response_1",
      direction: "up",
    });

    expect(result.model.blocks.map((block) => block.id)).toEqual([
      "response_1",
      "text_1",
      "separator_1",
    ]);
    expect(result.selection).toEqual({ type: "block", blockId: "response_1" });
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
      model,
      blockId: "text_1",
      direction: "down",
    });

    expect(result.model.blocks.map((block) => block.id)).toEqual([
      "response_1",
      "text_1",
      "separator_1",
    ]);
    expect(result.selection).toEqual({ type: "block", blockId: "text_1" });
  });

  it("cannot move the first block up", () => {
    const model = createBaseModel([
      createTextBlock("text_1", "Prompt"),
      createResponseBlock("response_1", "answer_1", {
        placeholder: "Answer",
      }),
    ]);

    const result = moveComposedBlockInEditor({
      model,
      blockId: "text_1",
      direction: "up",
    });

    expect(result.model.blocks.map((block) => block.id)).toEqual([
      "text_1",
      "response_1",
    ]);
    expect(result.selection).toEqual({ type: "block", blockId: "text_1" });
  });

  it("cannot move the last block down", () => {
    const model = createBaseModel([
      createTextBlock("text_1", "Prompt"),
      createResponseBlock("response_1", "answer_1", {
        placeholder: "Answer",
      }),
    ]);

    const result = moveComposedBlockInEditor({
      model,
      blockId: "response_1",
      direction: "down",
    });

    expect(result.model.blocks.map((block) => block.id)).toEqual([
      "text_1",
      "response_1",
    ]);
    expect(result.selection).toEqual({ type: "block", blockId: "response_1" });
  });

  it("returns the same model and document selection when moving a missing block", () => {
    const model = createBaseModel([createTextBlock("text_1", "Prompt")]);

    const result = moveComposedBlockInEditor({
      model,
      blockId: "missing",
      direction: "up",
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
      model,
      blockId: "table_1",
      direction: "up",
    });

    expect(result.selection).toEqual({ type: "table", blockId: "table_1" });
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
        type: "block",
        blockId: "text_1",
      }),
    ).toEqual({ type: "block", blockId: "text_1" });
  });

  it("normalizes a table block selected as a block into a table selection", () => {
    const model = createModelWithTable([
      createTextBlock("text_1", "Prompt"),
      createTableBlock("table_1"),
    ]);

    expect(
      normalizeComposedEditorSelection(model, {
        type: "block",
        blockId: "table_1",
      }),
    ).toEqual({ type: "table", blockId: "table_1" });
  });

  it("normalizes a table selection to a block selection when the block is no longer a table", () => {
    const model = createBaseModel([createTextBlock("text_1", "Prompt")]);

    expect(
      normalizeComposedEditorSelection(model, {
        type: "table",
        blockId: "text_1",
      }),
    ).toEqual({ type: "block", blockId: "text_1" });
  });

  it("preserves an existing table cell selection when the cell exists", () => {
    const model = createModelWithTable([
      createTextBlock("text_1", "Prompt"),
      createTableBlock("table_1"),
    ]);

    expect(
      normalizeComposedEditorSelection(model, {
        type: "table_cell",
        blockId: "table_1",
        cellId: "cell_1",
      }),
    ).toEqual({
      type: "table_cell",
      blockId: "table_1",
      cellId: "cell_1",
    });
  });

  it("normalizes a missing table cell to the table selection when the table still exists", () => {
    const model = createModelWithTable([
      createTextBlock("text_1", "Prompt"),
      createTableBlock("table_1"),
    ]);

    expect(
      normalizeComposedEditorSelection(model, {
        type: "table_cell",
        blockId: "table_1",
        cellId: "missing",
      }),
    ).toEqual({ type: "table", blockId: "table_1" });
  });

  it("normalizes a missing table row to the table selection when the table still exists", () => {
    const model = createModelWithTable([
      createTextBlock("text_1", "Prompt"),
      createTableBlock("table_1"),
    ]);

    expect(
      normalizeComposedEditorSelection(model, {
        type: "table_row",
        blockId: "table_1",
        rowId: "missing",
      }),
    ).toEqual({ type: "table", blockId: "table_1" });
  });

  it("normalizes a missing table column to the table selection when the table still exists", () => {
    const model = createModelWithTable([
      createTextBlock("text_1", "Prompt"),
      createTableBlock("table_1"),
    ]);

    expect(
      normalizeComposedEditorSelection(model, {
        type: "table_column",
        blockId: "table_1",
        columnId: "missing",
      }),
    ).toEqual({ type: "table", blockId: "table_1" });
  });

  it("normalizes a missing table to the first block or document", () => {
    const model = createBaseModel([createTextBlock("text_1", "Prompt")]);

    expect(
      normalizeComposedEditorSelection(model, {
        type: "table",
        blockId: "table_1",
      }),
    ).toEqual({ type: "block", blockId: "text_1" });
  });

  it("preserves a reference selection when the reference exists", () => {
    const model = createModelWithTable([
      createTextBlock("text_1", "Prompt"),
      createTableBlock("table_1"),
    ]);

    expect(
      normalizeComposedEditorSelection(model, {
        type: "reference",
        referenceId: "reference_1",
      }),
    ).toEqual({ type: "reference", referenceId: "reference_1" });
  });

  it("normalizes a missing reference selection to the document", () => {
    const model = createModelWithTable([
      createTextBlock("text_1", "Prompt"),
      createTableBlock("table_1"),
    ]);

    expect(
      normalizeComposedEditorSelection(model, {
        type: "reference",
        referenceId: "missing",
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
        type: "block",
        blockId: "text_1",
      }),
    ).toEqual(createTextBlock("text_1", "Prompt"));
    expect(
      getComposedEditorSelectedBlock(model, {
        type: "table",
        blockId: "table_1",
      }),
    ).toEqual(createTableBlock("table_1"));
    expect(
      getComposedEditorSelectedBlock(model, {
        type: "table_cell",
        blockId: "table_1",
        cellId: "cell_1",
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
        type: "reference",
        referenceId: "reference_1",
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
        type: "block",
        blockId: "missing",
      }),
    ).toBe(null);
  });
});
