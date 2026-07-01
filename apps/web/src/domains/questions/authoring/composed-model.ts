import { getReferenceIdForSource } from "../reference-names";
import type { ComposedInlineContent, RangeCellOffset } from "./inline-content";
import {
  extractInlineReferenceIds,
  plainTextToInlineContent,
  replaceInlineReferenceId,
} from "./inline-content";
import {
  createDefaultRequiredInputPrimitiveForNewAnswer,
  extractInputPrimitiveReferenceIdsByRole,
  extractReferenceIdsFromInputPrimitive,
  type InputPrimitive,
  type InputPrimitivePreviewState,
  type InputPrimitiveType,
  replaceReferenceIdInInputPrimitive,
} from "./input-primitive";
import {
  createDefaultRichContent,
  extractRichReferenceIds,
  replaceRichReferenceId,
} from "./rich-content";
import type { ComposedRichContent } from "./rich-content-types";
import type {
  ReferenceSourceDraft,
  TableBlockPreviewModel,
  TableEditorModel,
  TableEditorPrimitiveBlock,
  TableGrading,
  ValueExpression,
} from "./table-model";
import {
  createDefaultTableEditorModel,
  getTableCellPrimitiveBlocks,
  nextAvailableId as nextAvailableTableId,
  validateTableEditorModel,
} from "./table-model";
import { extractReferenceIdsFromValueExpression } from "./value-source";

export type {
  ComposedRichContent,
  ComposedRichContentNode,
  ComposedRichListItem,
} from "./rich-content-types";

export type ComposedResponseField = {
  id: string;
  type: InputPrimitiveType;
  label?: string;
};

export const COMPOSED_AUTHORING_SCHEMA_VERSION = 2;
export type ComposedAuthoringSchemaVersion =
  typeof COMPOSED_AUTHORING_SCHEMA_VERSION;

export type ComposedReferenceDraft = {
  id: string;
  source: ReferenceSourceDraft;
  label?: string;
};

export type ReferenceUsage =
  | {
      type: "text_block";
      blockId: string;
      inlineContentIndex: number;
      rangeCell?: RangeCellOffset;
    }
  | {
      type: "rich_text_block";
      blockId: string;
      richNodePath: readonly number[];
      inlineContentIndex: number;
      rangeCell?: RangeCellOffset;
    }
  | {
      type: "response_answer";
      blockId: string;
      responseFieldId: string;
    }
  | {
      type: "response_input_default";
      blockId: string;
      responseFieldId: string;
    }
  | {
      type: "response_input_options";
      blockId: string;
      responseFieldId: string;
    }
  | {
      type: "table_content_cell";
      blockId: string;
      cellId: string;
      cellBlockId: string;
      inlineContentIndex: number;
      richNodePath?: readonly number[];
      rangeCell?: RangeCellOffset;
    }
  | {
      type: "table_answer_cell";
      blockId: string;
      cellId: string;
      cellBlockId: string;
      responseFieldId: string;
    }
  | {
      type: "table_input_default";
      blockId: string;
      cellId: string;
      cellBlockId: string;
      responseFieldId: string;
    }
  | {
      type: "table_input_options";
      blockId: string;
      cellId: string;
      cellBlockId: string;
      responseFieldId: string;
    };

export type ComposedTextEditorBlock = {
  id: string;
  type: "text";
  content: ComposedInlineContent[];
};

export type ComposedRichTextEditorBlock = {
  id: string;
  type: "rich_text";
  content: ComposedRichContent;
};

export type ComposedResponseEditorBlock = {
  id: string;
  type: "response";
  responseFieldId: string;
  input?: InputPrimitive;
  label?: string;
  placeholder?: string;
  correctValueSource?: ValueExpression;
  points: number;
  grading: TableGrading;
};

export type ComposedSeparatorEditorBlock = {
  id: string;
  type: "separator";
};

export type ComposedTableEditorBlock = {
  id: string;
  type: "table";
  table: TableEditorModel;
};

export type ComposedContainerEditorBlock = {
  id: string;
  type: "container";
  containerType: "page" | "step";
  title?: string;
  blocks: ComposedEditorBlock[];
};

export type ComposedEditorBlock =
  | ComposedTextEditorBlock
  | ComposedRichTextEditorBlock
  | ComposedResponseEditorBlock
  | ComposedSeparatorEditorBlock
  | ComposedTableEditorBlock
  | ComposedContainerEditorBlock;

export type ComposedEditorModel = {
  schemaVersion: ComposedAuthoringSchemaVersion;
  blocks: ComposedEditorBlock[];
  responseFields: ComposedResponseField[];
  references: ComposedReferenceDraft[];
};

export type ComposedRenderedInlineContent =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "value";
      referenceId: string;
      displayValue: string;
    };

export type ComposedTextPreviewBlock = {
  id: string;
  type: "text";
  content: ComposedRenderedInlineContent[];
};

export type ComposedRichTextPreviewBlock = {
  id: string;
  type: "rich_text";
  content: ComposedRichContent;
};

export type ComposedResponsePreviewBlock = {
  id: string;
  type: "response";
  responseFieldId: string;
  inputState?: InputPrimitivePreviewState;
  label?: string;
  placeholder?: string;
};

export type ComposedSeparatorPreviewBlock = {
  id: string;
  type: "separator";
};

export type ComposedTablePreviewBlock = {
  id: string;
  type: "table";
  table: TableBlockPreviewModel;
};

export type ComposedContainerPreviewBlock = {
  id: string;
  type: "container";
  containerType: "page" | "step";
  title?: string;
  blocks: ComposedPreviewBlock[];
};

export type ComposedPreviewBlock =
  | ComposedTextPreviewBlock
  | ComposedRichTextPreviewBlock
  | ComposedResponsePreviewBlock
  | ComposedSeparatorPreviewBlock
  | ComposedTablePreviewBlock
  | ComposedContainerPreviewBlock;

export type ComposedPreviewModel = {
  schemaVersion: ComposedAuthoringSchemaVersion;
  blocks: ComposedPreviewBlock[];
  responseFields: ComposedResponseField[];
};

export function nextAvailableComposedBlockId(
  model: ComposedEditorModel,
  prefix: ComposedEditorBlock["type"],
) {
  return nextAvailableTableId(prefix, collectComposedBlockIds(model.blocks));
}

export type ClonedComposedBlock = {
  block: ComposedEditorBlock;
  responseFields: ComposedResponseField[];
};

export function cloneComposedBlockWithFreshIds(
  model: ComposedEditorModel,
  source: ComposedEditorBlock,
): ClonedComposedBlock {
  const usedBlockIds = new Set(collectDocumentBlockIds(model.blocks));
  const usedResponseFieldIds = new Set([
    ...model.responseFields.map((field) => field.id),
    ...flattenComposedBlocks(model.blocks).flatMap((block) =>
      block.type === "table"
        ? block.table.responseFields.map((field) => field.id)
        : [],
    ),
  ]);
  const responseFields: ComposedResponseField[] = [];

  const allocateBlockId = (prefix: string) => {
    const id = nextAvailableTableId(prefix, usedBlockIds);
    usedBlockIds.add(id);
    return id;
  };
  const allocateResponseFieldId = () => {
    const id = nextAvailableTableId("answer", usedResponseFieldIds);
    usedResponseFieldIds.add(id);
    return id;
  };

  return {
    block: cloneComposedBlock(source, {
      allocateBlockId,
      allocateResponseFieldId,
      model,
      responseFields,
    }),
    responseFields,
  };
}

export function nextAvailableResponseFieldId(model: ComposedEditorModel) {
  return nextAvailableTableId("answer", [
    ...model.responseFields.map((field) => field.id),
    ...flattenComposedBlocks(model.blocks).flatMap((block) =>
      block.type === "table"
        ? block.table.responseFields.map((field) => field.id)
        : block.type === "response"
          ? [block.responseFieldId]
          : [],
    ),
  ]);
}

export function createTextBlock(
  id: string,
  text = "",
): ComposedTextEditorBlock {
  return {
    content: plainTextToInlineContent(text),
    id,
    type: "text",
  };
}

export function createRichTextBlock(
  id: string,
  content = createDefaultRichContent(),
): ComposedRichTextEditorBlock {
  return {
    content,
    id,
    type: "rich_text",
  };
}

export function createResponseBlock(
  id: string,
  responseFieldId: string,
  overrides: Partial<
    Omit<ComposedResponseEditorBlock, "id" | "type" | "responseFieldId">
  > = {},
): ComposedResponseEditorBlock {
  return {
    correctValueSource: overrides.correctValueSource ?? {
      type: "literal",
      value: "",
    },
    grading: overrides.grading ?? { mode: "exact" },
    id,
    input:
      overrides.input ??
      createDefaultRequiredInputPrimitiveForNewAnswer("text"),
    label: overrides.label,
    placeholder: overrides.placeholder,
    points: overrides.points ?? 1,
    responseFieldId,
    type: "response",
  };
}

export function createSeparatorBlock(id: string): ComposedSeparatorEditorBlock {
  return {
    id,
    type: "separator",
  };
}

export function createTableBlock(
  id: string,
  table: TableEditorModel = createDefaultTableEditorModel(id),
): ComposedTableEditorBlock {
  return {
    id,
    table: { ...table, blockId: id },
    type: "table",
  };
}

export function createDefaultComposedEditorModel(): ComposedEditorModel {
  const responseFieldId = "answer_1";
  return {
    blocks: [
      createTextBlock("text_1", "Write the question here."),
      createResponseBlock("response_1", responseFieldId, {
        placeholder: "Answer",
      }),
    ],
    references: [],
    responseFields: [
      {
        id: responseFieldId,
        label: "Answer",
        type: "text",
      },
    ],
    schemaVersion: COMPOSED_AUTHORING_SCHEMA_VERSION,
  };
}

export function addComposedBlock(
  model: ComposedEditorModel,
  block: ComposedEditorBlock,
  responseField?: ComposedResponseField,
): ComposedEditorModel {
  return {
    ...model,
    blocks: [...model.blocks, block],
    responseFields: responseField
      ? [...model.responseFields, responseField]
      : model.responseFields,
  };
}

export function updateComposedBlock(
  model: ComposedEditorModel,
  blockId: string,
  updater: (block: ComposedEditorBlock) => ComposedEditorBlock,
): ComposedEditorModel {
  return {
    ...model,
    blocks: updateComposedBlocks(model.blocks, blockId, updater),
  };
}

export function removeComposedBlock(
  model: ComposedEditorModel,
  blockId: string,
): ComposedEditorModel {
  const nextModel = {
    ...model,
    blocks: removeComposedBlockFromBlocks(model.blocks, blockId),
  };
  const usedResponseFieldIds = new Set(
    flattenComposedBlocks(nextModel.blocks).flatMap((block) =>
      block.type === "response" ? [block.responseFieldId] : [],
    ),
  );
  nextModel.responseFields = nextModel.responseFields.filter((field) =>
    usedResponseFieldIds.has(field.id),
  );
  return nextModel;
}

export function moveComposedBlock(
  model: ComposedEditorModel,
  blockId: string,
  direction: "up" | "down",
): ComposedEditorModel {
  const moved = moveComposedBlockInTree(model.blocks, blockId, direction);
  return moved.changed ? { ...model, blocks: moved.blocks } : model;
}

export function reorderComposedBlocks(
  model: ComposedEditorModel,
  blocks: ComposedEditorBlock[],
): ComposedEditorModel {
  return {
    ...model,
    blocks: [...blocks],
  };
}

export function updateComposedResponseField(
  model: ComposedEditorModel,
  responseFieldId: string,
  updater: (field: ComposedResponseField) => ComposedResponseField,
): ComposedEditorModel {
  return {
    ...model,
    responseFields: model.responseFields.map((field) =>
      field.id === responseFieldId ? updater(field) : field,
    ),
  };
}

export function extractUsedReferenceIdsFromComposedEditorModel(
  model: ComposedEditorModel,
) {
  const ids = new Set<string>();
  for (const block of model.blocks) {
    for (const referenceId of getReferenceIdsUsedByBlock(block)) {
      ids.add(referenceId);
    }
  }
  return [...ids];
}

export function getReferenceUsage(
  model: ComposedEditorModel,
): Map<string, ReferenceUsage[]> {
  const usage = new Map<string, ReferenceUsage[]>();
  for (const block of model.blocks) {
    switch (block.type) {
      case "text":
        for (const inlineReference of getInlineReferenceUsages(block.content)) {
          addReferenceUsage(usage, inlineReference.referenceId, {
            blockId: block.id,
            inlineContentIndex: inlineReference.inlineContentIndex,
            ...(inlineReference.rangeCell
              ? { rangeCell: inlineReference.rangeCell }
              : {}),
            type: "text_block",
          });
        }
        break;
      case "rich_text":
        for (const inlineReference of getRichReferenceUsages(block.content)) {
          addReferenceUsage(usage, inlineReference.referenceId, {
            blockId: block.id,
            inlineContentIndex: inlineReference.inlineContentIndex,
            richNodePath: inlineReference.richNodePath,
            ...(inlineReference.rangeCell
              ? { rangeCell: inlineReference.rangeCell }
              : {}),
            type: "rich_text_block",
          });
        }
        break;
      case "response": {
        for (const referenceId of extractReferenceIdsFromValueExpression(
          block.correctValueSource,
        )) {
          addReferenceUsage(usage, referenceId, {
            blockId: block.id,
            responseFieldId: block.responseFieldId,
            type: "response_answer",
          });
        }
        const inputReferenceIds = extractInputPrimitiveReferenceIdsByRole(
          block.input,
        );
        for (const referenceId of inputReferenceIds.defaultValueSource) {
          addReferenceUsage(usage, referenceId, {
            blockId: block.id,
            responseFieldId: block.responseFieldId,
            type: "response_input_default",
          });
        }
        for (const referenceId of inputReferenceIds.optionsSource) {
          addReferenceUsage(usage, referenceId, {
            blockId: block.id,
            responseFieldId: block.responseFieldId,
            type: "response_input_options",
          });
        }
        break;
      }
      case "table":
        for (const cell of block.table.cells) {
          for (const cellBlock of getTableCellPrimitiveBlocks(cell)) {
            if (cellBlock.type === "text") {
              for (const inlineReference of getInlineReferenceUsages(
                cellBlock.content,
              )) {
                addReferenceUsage(usage, inlineReference.referenceId, {
                  blockId: block.id,
                  cellId: cell.id,
                  cellBlockId: cellBlock.id,
                  inlineContentIndex: inlineReference.inlineContentIndex,
                  ...(inlineReference.rangeCell
                    ? { rangeCell: inlineReference.rangeCell }
                    : {}),
                  type: "table_content_cell",
                });
              }
            }

            if (cellBlock.type === "rich_text") {
              for (const inlineReference of getRichReferenceUsages(
                cellBlock.content,
              )) {
                addReferenceUsage(usage, inlineReference.referenceId, {
                  blockId: block.id,
                  cellId: cell.id,
                  cellBlockId: cellBlock.id,
                  inlineContentIndex: inlineReference.inlineContentIndex,
                  richNodePath: inlineReference.richNodePath,
                  ...(inlineReference.rangeCell
                    ? { rangeCell: inlineReference.rangeCell }
                    : {}),
                  type: "table_content_cell",
                });
              }
            }

            if (cellBlock.type === "input") {
              for (const referenceId of extractReferenceIdsFromValueExpression(
                cellBlock.correctValueSource,
              )) {
                addReferenceUsage(usage, referenceId, {
                  blockId: block.id,
                  cellId: cell.id,
                  cellBlockId: cellBlock.id,
                  responseFieldId: cellBlock.responseFieldId,
                  type: "table_answer_cell",
                });
              }
              const inputReferenceIds = extractInputPrimitiveReferenceIdsByRole(
                cellBlock.input,
              );
              for (const referenceId of inputReferenceIds.defaultValueSource) {
                addReferenceUsage(usage, referenceId, {
                  blockId: block.id,
                  cellId: cell.id,
                  cellBlockId: cellBlock.id,
                  responseFieldId: cellBlock.responseFieldId,
                  type: "table_input_default",
                });
              }
              for (const referenceId of inputReferenceIds.optionsSource) {
                addReferenceUsage(usage, referenceId, {
                  blockId: block.id,
                  cellId: cell.id,
                  cellBlockId: cellBlock.id,
                  responseFieldId: cellBlock.responseFieldId,
                  type: "table_input_options",
                });
              }
            }
          }
        }
        break;
      case "container": {
        const childUsage = getReferenceUsage({
          blocks: block.blocks,
          references: [],
          responseFields: [],
          schemaVersion: COMPOSED_AUTHORING_SCHEMA_VERSION,
        });
        for (const [referenceId, items] of childUsage) {
          for (const item of items) {
            addReferenceUsage(usage, referenceId, item);
          }
        }
        break;
      }
      case "separator":
        break;
      default:
        assertNever(block);
    }
  }
  return usage;
}

export function getComposedEditorReferenceUsage(model: ComposedEditorModel) {
  return getReferenceUsage(model);
}

export function getUnusedComposedReferences(model: ComposedEditorModel) {
  const usage = getComposedEditorReferenceUsage(model);
  return model.references.filter((reference) => !usage.has(reference.id));
}

export function stripUnusedComposedReferences(
  model: ComposedEditorModel,
): ComposedEditorModel {
  const unusedReferenceIds = new Set(
    getUnusedComposedReferences(model).map((reference) => reference.id),
  );
  if (unusedReferenceIds.size === 0) {
    return model;
  }

  return {
    ...model,
    references: model.references.filter(
      (reference) => !unusedReferenceIds.has(reference.id),
    ),
  };
}

export function renameReferenceIdInComposedEditorModel(
  model: ComposedEditorModel,
  previousReferenceId: string,
  nextReferenceId: string,
): ComposedEditorModel {
  const nextModel = replaceReferenceIdUsagesInComposedEditorModel(
    model,
    previousReferenceId,
    nextReferenceId,
  );

  return {
    ...nextModel,
    references: nextModel.references.map((reference) =>
      reference.id === previousReferenceId
        ? {
            ...reference,
            id: nextReferenceId,
          }
        : reference,
    ),
  };
}

export function mergeReferenceIdInComposedEditorModel(
  model: ComposedEditorModel,
  previousReferenceId: string,
  nextReferenceId: string,
): ComposedEditorModel {
  const nextModel = replaceReferenceIdUsagesInComposedEditorModel(
    model,
    previousReferenceId,
    nextReferenceId,
  );

  return {
    ...nextModel,
    references: nextModel.references.filter(
      (reference) => reference.id !== previousReferenceId,
    ),
  };
}

export function normalizeWorkbookReferenceIdsInComposedEditorModel(
  model: ComposedEditorModel,
): ComposedEditorModel {
  let nextModel = model;

  for (const reference of model.references) {
    const canonicalReferenceId = getReferenceIdForSource(reference.source);
    if (!canonicalReferenceId || canonicalReferenceId === reference.id) {
      continue;
    }

    nextModel = nextModel.references.some(
      (candidate) =>
        candidate.id === canonicalReferenceId && candidate.id !== reference.id,
    )
      ? mergeReferenceIdInComposedEditorModel(
          nextModel,
          reference.id,
          canonicalReferenceId,
        )
      : renameReferenceIdInComposedEditorModel(
          nextModel,
          reference.id,
          canonicalReferenceId,
        );
  }

  return nextModel;
}

function replaceReferenceIdInValueExpression(
  value: ValueExpression | undefined,
  previousReferenceId: string,
  nextReferenceId: string,
): ValueExpression | undefined {
  return value?.type === "reference" &&
    value.referenceId === previousReferenceId
    ? { ...value, referenceId: nextReferenceId }
    : value;
}

function getReferenceIdsUsedByBlock(block: ComposedEditorBlock): string[] {
  switch (block.type) {
    case "text":
      return extractInlineReferenceIds(block.content);
    case "rich_text":
      return extractRichReferenceIds(block.content);
    case "response":
      return [
        ...extractReferenceIdsFromValueExpression(block.correctValueSource),
        ...extractReferenceIdsFromInputPrimitive(block.input),
      ];
    case "table":
      return block.table.cells.flatMap((cell) =>
        getTableCellPrimitiveBlocks(cell).flatMap(
          getReferenceIdsUsedByTablePrimitiveBlock,
        ),
      );
    case "container":
      return block.blocks.flatMap(getReferenceIdsUsedByBlock);
    case "separator":
      return [];
    default:
      return assertNever(block);
  }
}

function addReferenceUsage(
  usage: Map<string, ReferenceUsage[]>,
  referenceId: string,
  item: ReferenceUsage,
) {
  usage.set(referenceId, [...(usage.get(referenceId) ?? []), item]);
}

function getInlineReferenceUsages(content: ComposedInlineContent[]): Array<{
  inlineContentIndex: number;
  referenceId: string;
  rangeCell?: RangeCellOffset;
}> {
  return content.flatMap((item, inlineContentIndex) =>
    item.type === "reference"
      ? [
          {
            inlineContentIndex,
            referenceId: item.referenceId,
            ...(item.rangeCell ? { rangeCell: item.rangeCell } : {}),
          },
        ]
      : [],
  );
}

function getRichReferenceUsages(content: ComposedRichContent): Array<{
  inlineContentIndex: number;
  richNodePath: readonly number[];
  referenceId: string;
  rangeCell?: RangeCellOffset;
}> {
  const usages: Array<{
    inlineContentIndex: number;
    richNodePath: readonly number[];
    referenceId: string;
    rangeCell?: RangeCellOffset;
  }> = [];

  content.content.forEach((node, nodeIndex) => {
    collectRichReferenceUsages(node, [nodeIndex], usages);
  });

  return usages;
}

type RichReferenceUsage = {
  inlineContentIndex: number;
  richNodePath: readonly number[];
  referenceId: string;
  rangeCell?: RangeCellOffset;
};

function collectRichReferenceUsages(
  node: ComposedRichContent["content"][number],
  path: readonly number[],
  usages: RichReferenceUsage[],
) {
  if (node.type === "paragraph" || node.type === "heading") {
    usages.push(
      ...getInlineReferenceUsages(node.content).map((usage) => ({
        ...usage,
        richNodePath: path,
      })),
    );
    return;
  }

  node.items.forEach((item, itemIndex) => {
    item.content.forEach((child, childIndex) => {
      collectRichReferenceUsages(
        child,
        [...path, itemIndex, childIndex],
        usages,
      );
    });
  });
}

function replaceReferenceIdUsagesInComposedEditorModel(
  model: ComposedEditorModel,
  previousReferenceId: string,
  nextReferenceId: string,
): ComposedEditorModel {
  return {
    ...model,
    blocks: model.blocks.map((block) => {
      switch (block.type) {
        case "text":
          return {
            ...block,
            content: replaceInlineReferenceId(
              block.content,
              previousReferenceId,
              nextReferenceId,
            ),
          };
        case "rich_text":
          return {
            ...block,
            content: replaceRichReferenceId(
              block.content,
              previousReferenceId,
              nextReferenceId,
            ),
          };
        case "response":
          return {
            ...block,
            correctValueSource: replaceReferenceIdInValueExpression(
              block.correctValueSource,
              previousReferenceId,
              nextReferenceId,
            ),
            input: replaceReferenceIdInInputPrimitive(
              block.input,
              previousReferenceId,
              nextReferenceId,
            ),
          };
        case "table":
          return {
            ...block,
            table: {
              ...block.table,
              cells: block.table.cells.map((cell) =>
                replaceReferenceIdInTableCell(
                  cell,
                  previousReferenceId,
                  nextReferenceId,
                ),
              ),
            },
          };
        case "container":
          return {
            ...block,
            blocks: replaceReferenceIdUsagesInBlocks(
              block.blocks,
              previousReferenceId,
              nextReferenceId,
            ),
          };
        case "separator":
          return block;
        default:
          return assertNever(block);
      }
    }),
  };
}

function getReferenceIdsUsedByTablePrimitiveBlock(
  block: TableEditorPrimitiveBlock,
): string[] {
  if (block.type === "text") {
    return extractInlineReferenceIds(block.content);
  }
  if (block.type === "rich_text") {
    return extractRichReferenceIds(block.content);
  }
  if (block.type === "input") {
    return [
      ...extractReferenceIdsFromValueExpression(block.correctValueSource),
      ...extractReferenceIdsFromInputPrimitive(block.input),
    ];
  }
  return [];
}

function replaceReferenceIdInTableCell(
  cell: TableEditorModel["cells"][number],
  previousReferenceId: string,
  nextReferenceId: string,
): TableEditorModel["cells"][number] {
  return {
    ...cell,
    blocks: getTableCellPrimitiveBlocks(cell).map((cellBlock) => {
      if (cellBlock.type === "text") {
        return {
          ...cellBlock,
          content: replaceInlineReferenceId(
            cellBlock.content,
            previousReferenceId,
            nextReferenceId,
          ),
        };
      }
      if (cellBlock.type === "input") {
        return {
          ...cellBlock,
          correctValueSource: replaceReferenceIdInValueExpression(
            cellBlock.correctValueSource,
            previousReferenceId,
            nextReferenceId,
          ),
          input: replaceReferenceIdInInputPrimitive(
            cellBlock.input,
            previousReferenceId,
            nextReferenceId,
          ),
        };
      }
      if (cellBlock.type === "rich_text") {
        return {
          ...cellBlock,
          content: replaceRichReferenceId(
            cellBlock.content,
            previousReferenceId,
            nextReferenceId,
          ),
        };
      }
      return cellBlock;
    }),
  };
}

function collectDocumentBlockIds(blocks: ComposedEditorBlock[]): string[] {
  return flattenComposedBlocks(blocks).flatMap((block) =>
    block.type === "table"
      ? [
          block.id,
          ...block.table.cells.flatMap((cell) =>
            cell.blocks.map((cellBlock) => cellBlock.id),
          ),
        ]
      : [block.id],
  );
}

const collectComposedBlockIds = collectDocumentBlockIds;

type ComposedCloneContext = {
  allocateBlockId(prefix: string): string;
  allocateResponseFieldId(): string;
  model: ComposedEditorModel;
  responseFields: ComposedResponseField[];
};

function cloneComposedBlock(
  block: ComposedEditorBlock,
  context: ComposedCloneContext,
): ComposedEditorBlock {
  switch (block.type) {
    case "text":
      return {
        ...block,
        content: structuredClone(block.content),
        id: context.allocateBlockId("text"),
      };
    case "rich_text":
      return {
        ...block,
        content: structuredClone(block.content),
        id: context.allocateBlockId("rich_text"),
      };
    case "separator":
      return { ...block, id: context.allocateBlockId("separator") };
    case "response": {
      const responseFieldId = context.allocateResponseFieldId();
      const sourceField = context.model.responseFields.find(
        (field) => field.id === block.responseFieldId,
      );
      if (!sourceField) {
        throw new Error(
          `Cannot duplicate input block ${block.id}: missing response field ${block.responseFieldId}.`,
        );
      }

      context.responseFields.push({ ...sourceField, id: responseFieldId });
      return {
        ...block,
        correctValueSource: structuredClone(block.correctValueSource),
        id: context.allocateBlockId("response"),
        input: structuredClone(block.input),
        responseFieldId,
      };
    }
    case "container":
      return {
        ...block,
        blocks: block.blocks.map((child) => cloneComposedBlock(child, context)),
        id: context.allocateBlockId("container"),
      };
    case "table":
      return cloneComposedTableBlock(block, context);
    default:
      return assertNever(block);
  }
}

function cloneComposedTableBlock(
  block: ComposedTableEditorBlock,
  context: ComposedCloneContext,
): ComposedTableEditorBlock {
  validateTableEditorModel(block.table);
  const id = context.allocateBlockId("table");
  const rowIds = new Map(
    block.table.rows.map((row, index) => [row.id, `${id}_row_${index + 1}`]),
  );
  const columnIds = new Map(
    block.table.columns.map((column, index) => [
      column.id,
      `${id}_column_${index + 1}`,
    ]),
  );
  const responseFieldIds = new Map(
    block.table.responseFields.map((field) => [
      field.id,
      context.allocateResponseFieldId(),
    ]),
  );

  function getMappedResponseFieldId(
    primitive: Extract<TableEditorPrimitiveBlock, { type: "input" }>,
  ): string {
    const responseFieldId = responseFieldIds.get(primitive.responseFieldId);
    if (!responseFieldId) {
      throw new Error(
        `Cannot duplicate table ${block.id}: input block ${primitive.id} references missing response field ${primitive.responseFieldId}.`,
      );
    }
    return responseFieldId;
  }

  return {
    ...block,
    id,
    table: {
      ...block.table,
      blockId: id,
      cells: block.table.cells.map((cell, index) => ({
        blocks: cell.blocks.map((primitive) => ({
          ...structuredClone(primitive),
          id: context.allocateBlockId(`table_${primitive.type}`),
          ...(primitive.type === "input"
            ? {
                responseFieldId: getMappedResponseFieldId(primitive),
              }
            : {}),
        })),
        columnId: columnIds.get(cell.columnId) ?? cell.columnId,
        ...(cell.formatting === undefined
          ? {}
          : { formatting: structuredClone(cell.formatting) }),
        id: `${id}_cell_${index + 1}`,
        rowId: rowIds.get(cell.rowId) ?? cell.rowId,
      })),
      columns: block.table.columns.map((column) => ({
        ...column,
        id: columnIds.get(column.id) ?? column.id,
      })),
      responseFields: block.table.responseFields.map((field) => ({
        ...field,
        id: responseFieldIds.get(field.id) ?? field.id,
      })),
      rows: block.table.rows.map((row) => ({
        ...row,
        id: rowIds.get(row.id) ?? row.id,
      })),
    },
  };
}

export function flattenComposedBlocks(
  blocks: ComposedEditorBlock[],
): ComposedEditorBlock[] {
  return blocks.flatMap((block) =>
    block.type === "container"
      ? [block, ...flattenComposedBlocks(block.blocks)]
      : [block],
  );
}

export function findComposedBlockById(
  blocks: ComposedEditorBlock[],
  blockId: string,
): ComposedEditorBlock | null {
  return (
    flattenComposedBlocks(blocks).find((block) => block.id === blockId) ?? null
  );
}

export function insertComposedBlockAfterId(
  blocks: ComposedEditorBlock[],
  blockId: string,
  insertedBlock: ComposedEditorBlock,
): ComposedEditorBlock[] {
  const index = blocks.findIndex((block) => block.id === blockId);
  if (index >= 0) {
    const nextBlocks = [...blocks];
    nextBlocks.splice(index + 1, 0, insertedBlock);
    return nextBlocks;
  }
  return blocks.map((block) =>
    block.type === "container" && findComposedBlockById(block.blocks, blockId)
      ? {
          ...block,
          blocks: insertComposedBlockAfterId(
            block.blocks,
            blockId,
            insertedBlock,
          ),
        }
      : block,
  );
}

function moveComposedBlockInTree(
  blocks: ComposedEditorBlock[],
  blockId: string,
  direction: "up" | "down",
): { blocks: ComposedEditorBlock[]; changed: boolean } {
  const index = blocks.findIndex((block) => block.id === blockId);
  if (index >= 0) {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= blocks.length) {
      return { blocks, changed: false };
    }
    const nextBlocks = [...blocks];
    const block = nextBlocks[index];
    if (!block) {
      return { blocks, changed: false };
    }
    nextBlocks.splice(index, 1);
    nextBlocks.splice(targetIndex, 0, block);
    return { blocks: nextBlocks, changed: true };
  }

  for (const block of blocks) {
    if (block.type !== "container") {
      continue;
    }
    const childResult = moveComposedBlockInTree(
      block.blocks,
      blockId,
      direction,
    );
    if (childResult.changed) {
      return {
        blocks: blocks.map((candidate) =>
          candidate.id === block.id
            ? { ...block, blocks: childResult.blocks }
            : candidate,
        ),
        changed: true,
      };
    }
  }
  return { blocks, changed: false };
}

function updateComposedBlocks(
  blocks: ComposedEditorBlock[],
  blockId: string,
  updater: (block: ComposedEditorBlock) => ComposedEditorBlock,
): ComposedEditorBlock[] {
  return blocks.map((block) => {
    if (block.id === blockId) {
      return updater(block);
    }
    if (block.type === "container") {
      return {
        ...block,
        blocks: updateComposedBlocks(block.blocks, blockId, updater),
      };
    }
    return block;
  });
}

function removeComposedBlockFromBlocks(
  blocks: ComposedEditorBlock[],
  blockId: string,
): ComposedEditorBlock[] {
  return blocks
    .filter((block) => block.id !== blockId)
    .map((block) =>
      block.type === "container"
        ? {
            ...block,
            blocks: removeComposedBlockFromBlocks(block.blocks, blockId),
          }
        : block,
    );
}

function replaceReferenceIdUsagesInBlocks(
  blocks: ComposedEditorBlock[],
  previousReferenceId: string,
  nextReferenceId: string,
): ComposedEditorBlock[] {
  return replaceReferenceIdUsagesInComposedEditorModel(
    {
      blocks,
      references: [],
      responseFields: [],
      schemaVersion: COMPOSED_AUTHORING_SCHEMA_VERSION,
    },
    previousReferenceId,
    nextReferenceId,
  ).blocks;
}

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}

export function createReferenceDraft(
  model: ComposedEditorModel,
): ComposedReferenceDraft {
  return {
    id: nextAvailableTableId(
      "reference",
      model.references.map((reference) => reference.id),
    ),
    source: { type: "literal", value: "" },
  };
}

export function extractWorkbookReferenceRefsFromComposedEditorModel(
  model: ComposedEditorModel,
) {
  const refs = new Set<string>();
  const usedReferenceIds = new Set(
    extractUsedReferenceIdsFromComposedEditorModel(model),
  );
  for (const reference of model.references) {
    if (!usedReferenceIds.has(reference.id)) {
      continue;
    }
    if (
      reference.source.type === "workbook_cell" ||
      reference.source.type === "workbook_range"
    ) {
      refs.add(reference.source.ref);
    }
  }
  return [...refs];
}

export function getUsedWorkbookSourceCountsFromComposedEditorModel(
  model: ComposedEditorModel,
) {
  const counts = new Map<string, number>();
  const usedReferenceIds = new Set(
    extractUsedReferenceIdsFromComposedEditorModel(model),
  );

  for (const reference of model.references) {
    if (!usedReferenceIds.has(reference.id)) {
      continue;
    }
    if (
      reference.source.type !== "workbook_cell" &&
      reference.source.type !== "workbook_range"
    ) {
      continue;
    }

    counts.set(
      reference.source.sourceId,
      (counts.get(reference.source.sourceId) ?? 0) + 1,
    );
  }

  return counts;
}
