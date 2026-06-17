import type {
  ComposedEditorBlock,
  ComposedEditorModel,
  ComposedResponseField,
} from "#/domains/questions/authoring";
import {
  createResponseBlock,
  createRichTextBlock,
  createSeparatorBlock,
  createTableBlock,
  createTextBlock,
  moveComposedBlock,
  nextAvailableComposedBlockId,
  nextAvailableResponseFieldId,
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
    ? { type: "table", blockId: block.id }
    : { type: "block", blockId: block.id };
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
        ? { type: "table", blockId: block.id }
        : selection;
    }
    case "table": {
      const block = findBlock(model, selection.blockId);
      if (!block) {
        return selectFirstBlockOrDocument(model);
      }

      return block.type === "table"
        ? selection
        : { type: "block", blockId: block.id };
    }
    case "table_row": {
      const block = findBlock(model, selection.blockId);
      if (!block || block.type !== "table") {
        return selectFirstBlockOrDocument(model);
      }

      return block.table.rows.some((row) => row.id === selection.rowId)
        ? selection
        : { type: "table", blockId: block.id };
    }
    case "table_column": {
      const block = findBlock(model, selection.blockId);
      if (!block || block.type !== "table") {
        return selectFirstBlockOrDocument(model);
      }

      return block.table.columns.some(
        (column) => column.id === selection.columnId,
      )
        ? selection
        : { type: "table", blockId: block.id };
    }
    case "table_cell": {
      const block = findBlock(model, selection.blockId);
      if (!block || block.type !== "table") {
        return selectFirstBlockOrDocument(model);
      }

      return block.table.cells.some((cell) => cell.id === selection.cellId)
        ? selection
        : { type: "table", blockId: block.id };
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
  const blockIndex = model.blocks.findIndex((block) => block.id === blockId);
  if (blockIndex < 0) {
    return { model, selection: { type: "document" } };
  }

  const block = model.blocks[blockIndex];
  const nextBlock = cloneBlockWithFreshIds(model, block);
  const blocks = [...model.blocks];
  blocks.splice(blockIndex + 1, 0, nextBlock.block);

  const nextModel = nextBlock.responseField
    ? {
        ...model,
        blocks,
        responseFields: [...model.responseFields, nextBlock.responseField],
      }
    : {
        ...model,
        blocks,
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
  const blockIndex = model.blocks.findIndex((block) => block.id === blockId);
  if (blockIndex < 0) {
    return {
      model,
      selection: selectFirstBlockOrDocument(model),
    };
  }

  const nextModel = removeComposedBlock(model, blockId);
  const nextBlock = nextModel.blocks[blockIndex];
  if (nextBlock) {
    return {
      model: nextModel,
      selection: selectBlockInComposedEditor(nextModel, nextBlock.id),
    };
  }

  const previousBlock = nextModel.blocks[blockIndex - 1];
  if (previousBlock) {
    return {
      model: nextModel,
      selection: selectBlockInComposedEditor(nextModel, previousBlock.id),
    };
  }

  return {
    model: nextModel,
    selection: { type: "document" },
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

function cloneBlockWithFreshIds(
  model: ComposedEditorModel,
  block: ComposedEditorBlock,
): {
  block: ComposedEditorBlock;
  responseField?: ComposedResponseField;
} {
  switch (block.type) {
    case "text":
      return {
        block: {
          ...block,
          id: nextAvailableComposedBlockId(model, "text"),
          content: block.content.map((part) => ({ ...part })),
        },
      };
    case "rich_text":
      return {
        block: {
          ...block,
          id: nextAvailableComposedBlockId(model, "rich_text"),
          content: structuredClone(block.content),
        },
      };
    case "response": {
      const responseFieldId = nextAvailableResponseFieldId(model);
      const responseField = model.responseFields.find(
        (field) => field.id === block.responseFieldId,
      );
      return {
        block: {
          ...block,
          id: nextAvailableComposedBlockId(model, "response"),
          responseFieldId,
        },
        responseField: responseField
          ? { ...responseField, id: responseFieldId }
          : createResponseField(responseFieldId),
      };
    }
    case "separator":
      return {
        block: createSeparatorBlock(
          nextAvailableComposedBlockId(model, "separator"),
        ),
      };
    case "table":
      return {
        block: createTableBlock(
          nextAvailableComposedBlockId(model, "table"),
          structuredClone(block.table),
        ),
      };
    default:
      return assertNever(block);
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
    type: "text",
    label: "Answer",
    required: true,
  };
}

function findBlock(
  model: ComposedEditorModel,
  blockId: string,
): ComposedEditorBlock | null {
  return model.blocks.find((block) => block.id === blockId) ?? null;
}

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}
