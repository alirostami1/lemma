import type {
  ComposedEditorBlock,
  ComposedEditorModel,
  ComposedResponseField,
} from "#/domains/questions/authoring";
import {
  cloneComposedBlockWithFreshIds,
  createResponseBlock,
  createRichTextBlock,
  createSeparatorBlock,
  createTableBlock,
  createTextBlock,
  findComposedBlockById,
  insertComposedBlockAfterId,
  moveComposedBlock,
  nextAvailableComposedBlockId,
  nextAvailableResponseFieldId,
  normalizeTableSelection,
  removeComposedBlock,
} from "#/domains/questions/authoring";
import type { EditorSelection } from "./editor-selection";

export type InsertComposedBlockType =
  | "text"
  | "rich_text"
  | "response"
  | "table"
  | "separator";

export type EditorOperationResult = {
  model: ComposedEditorModel;
  selection: EditorSelection;
};

export function selectBlockInComposedEditor(
  model: ComposedEditorModel,
  blockId: string,
): EditorSelection {
  const block = findBlock(model, blockId);
  if (!block) {
    return { type: "document" };
  }

  return block.type === "table"
    ? { blockId: block.id, type: "table" }
    : { blockId: block.id, type: "block" };
}

export function selectFirstBlockOrDocument(
  model: ComposedEditorModel,
): EditorSelection {
  const firstBlock = model.blocks[0];
  if (!firstBlock) {
    return { type: "document" };
  }

  return selectBlockInComposedEditor(model, firstBlock.id);
}

export function normalizeComposedEditorSelection(
  model: ComposedEditorModel,
  selection: EditorSelection,
): EditorSelection {
  switch (selection.type) {
    case "document":
      return selection;
    case "reference":
      return model.references.some(
        (reference) => reference.id === selection.referenceId,
      )
        ? selection
        : { type: "document" };
    case "block": {
      const block = findBlock(model, selection.blockId);
      if (!block) {
        return selectFirstBlockOrDocument(model);
      }

      return block.type === "table"
        ? { blockId: block.id, type: "table" }
        : selection;
    }
    case "table": {
      const block = findBlock(model, selection.blockId);
      if (!block) {
        return selectFirstBlockOrDocument(model);
      }

      return block.type === "table"
        ? selection
        : { blockId: block.id, type: "block" };
    }
    case "table_row": {
      const block = findBlock(model, selection.blockId);
      if (block?.type !== "table") {
        return selectFirstBlockOrDocument(model);
      }

      return block.table.rows.some((row) => row.id === selection.rowId)
        ? selection
        : { blockId: block.id, type: "table" };
    }
    case "table_column": {
      const block = findBlock(model, selection.blockId);
      if (block?.type !== "table") {
        return selectFirstBlockOrDocument(model);
      }

      return block.table.columns.some(
        (column) => column.id === selection.columnId,
      )
        ? selection
        : { blockId: block.id, type: "table" };
    }
    case "table_cell": {
      const block = findBlock(model, selection.blockId);
      if (block?.type !== "table") {
        return selectFirstBlockOrDocument(model);
      }

      return block.table.cells.some((cell) => cell.id === selection.cellId)
        ? selection
        : { blockId: block.id, type: "table" };
    }
    case "table_cells": {
      const block = findBlock(model, selection.blockId);
      if (block?.type !== "table") {
        return selectFirstBlockOrDocument(model);
      }

      const normalized = normalizeTableSelection(
        block.table,
        selection.selection,
      );
      return normalized.type === "cells"
        ? { blockId: block.id, selection: normalized, type: "table_cells" }
        : { blockId: block.id, type: "table" };
    }
    default:
      return assertNever(selection);
  }
}

export function insertComposedBlock(input: {
  model: ComposedEditorModel;
  type: InsertComposedBlockType;
  afterBlockId?: string | null;
}): EditorOperationResult {
  const { model, type, afterBlockId } = input;
  const nextBlock = createBlockForInsert(model, type);
  const nextBlocks = insertBlockAfter(
    model.blocks,
    nextBlock.block,
    afterBlockId,
  );
  const nextModel = nextBlock.responseField
    ? {
        ...model,
        blocks: nextBlocks,
        responseFields: [...model.responseFields, nextBlock.responseField],
      }
    : {
        ...model,
        blocks: nextBlocks,
      };

  return {
    model: nextModel,
    selection: selectBlockInComposedEditor(nextModel, nextBlock.block.id),
  };
}

export function duplicateComposedBlock(
  model: ComposedEditorModel,
  blockId: string,
): EditorOperationResult {
  const sourceBlock = findComposedBlockById(model.blocks, blockId);
  if (!sourceBlock) {
    return { model, selection: { type: "document" } };
  }

  const nextBlock = cloneComposedBlockWithFreshIds(model, sourceBlock);
  const nextModel = {
    ...model,
    blocks: insertComposedBlockAfterId(model.blocks, blockId, nextBlock.block),
    responseFields: [...model.responseFields, ...nextBlock.responseFields],
  };

  return {
    model: nextModel,
    selection: selectBlockInComposedEditor(nextModel, nextBlock.block.id),
  };
}

export function deleteComposedBlock(
  model: ComposedEditorModel,
  blockId: string,
): EditorOperationResult {
  const topLevelIndex = model.blocks.findIndex((block) => block.id === blockId);
  if (!findComposedBlockById(model.blocks, blockId)) {
    return {
      model,
      selection: selectFirstBlockOrDocument(model),
    };
  }

  const nextModel = removeComposedBlock(model, blockId);
  const adjacentTopLevelBlock =
    topLevelIndex < 0
      ? undefined
      : (nextModel.blocks[topLevelIndex] ??
        nextModel.blocks[topLevelIndex - 1]);
  return {
    model: nextModel,
    selection: adjacentTopLevelBlock
      ? selectBlockInComposedEditor(nextModel, adjacentTopLevelBlock.id)
      : selectFirstBlockOrDocument(nextModel),
  };
}

export function moveComposedBlockInEditor(input: {
  model: ComposedEditorModel;
  blockId: string;
  direction: "up" | "down";
}): EditorOperationResult {
  const { model, blockId, direction } = input;
  const nextModel = moveComposedBlock(model, blockId, direction);
  return {
    model: nextModel,
    selection: selectBlockInComposedEditor(nextModel, blockId),
  };
}

export function getComposedEditorSelectedBlock(
  model: ComposedEditorModel,
  selection: EditorSelection,
): ComposedEditorBlock | null {
  switch (selection.type) {
    case "document":
    case "reference":
      return null;
    case "block":
    case "table":
    case "table_row":
    case "table_column":
    case "table_cell":
    case "table_cells":
      return findBlock(model, selection.blockId);
    default:
      return assertNever(selection);
  }
}

function createBlockForInsert(
  model: ComposedEditorModel,
  type: InsertComposedBlockType,
): {
  block: ComposedEditorBlock;
  responseField?: ComposedResponseField;
} {
  switch (type) {
    case "text":
      return {
        block: createTextBlock(nextAvailableComposedBlockId(model, "text"), ""),
      };
    case "rich_text":
      return {
        block: createRichTextBlock(
          nextAvailableComposedBlockId(model, "rich_text"),
        ),
      };
    case "response": {
      const responseFieldId = nextAvailableResponseFieldId(model);
      return {
        block: createResponseBlock(
          nextAvailableComposedBlockId(model, "response"),
          responseFieldId,
        ),
        responseField: createResponseField(responseFieldId),
      };
    }
    case "table":
      return {
        block: createTableBlock(nextAvailableComposedBlockId(model, "table")),
      };
    case "separator":
      return {
        block: createSeparatorBlock(
          nextAvailableComposedBlockId(model, "separator"),
        ),
      };
    default:
      return assertNever(type);
  }
}

function insertBlockAfter(
  blocks: ComposedEditorBlock[],
  block: ComposedEditorBlock,
  afterBlockId?: string | null,
): ComposedEditorBlock[] {
  if (!afterBlockId) {
    return [...blocks, block];
  }

  const index = blocks.findIndex((candidate) => candidate.id === afterBlockId);
  if (index < 0) {
    return [...blocks, block];
  }

  const nextBlocks = [...blocks];
  nextBlocks.splice(index + 1, 0, block);
  return nextBlocks;
}

function createResponseField(id: string): ComposedResponseField {
  return {
    id,
    label: "Answer",
    type: "text",
  };
}

function findBlock(
  model: ComposedEditorModel,
  blockId: string,
): ComposedEditorBlock | null {
  return findComposedBlockById(model.blocks, blockId);
}

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}
