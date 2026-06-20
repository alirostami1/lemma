import type { ComposedInlineContent } from "./inline-content";
import {
  extractInlineReferenceIds,
  plainTextToInlineContent,
  replaceInlineReferenceId,
} from "./inline-content";
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
  TableGrading,
  ValueExpression,
} from "./table-model";
import {
  createDefaultTableEditorModel,
  nextAvailableId as nextAvailableTableId,
} from "./table-model";
import { extractReferenceIdsFromValueExpression } from "./value-source";

export type {
  ComposedRichContent,
  ComposedRichContentNode,
  ComposedRichListItem,
} from "./rich-content-types";

export type ComposedResponseField = {
  id: string;
  type: "text" | "number" | "boolean";
  label?: string;
  required?: boolean;
};

export type ComposedReferenceDraft = {
  id: string;
  source: ReferenceSourceDraft;
  label?: string;
};

export type ReferenceUsage =
  | {
      type: "text_block";
      blockId: string;
    }
  | {
      type: "rich_text_block";
      blockId: string;
    }
  | {
      type: "response_answer";
      blockId: string;
      responseFieldId: string;
    }
  | {
      type: "table_content_cell";
      blockId: string;
      cellId: string;
    }
  | {
      type: "table_answer_cell";
      blockId: string;
      cellId: string;
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
  label?: string;
  placeholder?: string;
  correctValueSource: ValueExpression;
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

export type ComposedEditorBlock =
  | ComposedTextEditorBlock
  | ComposedRichTextEditorBlock
  | ComposedResponseEditorBlock
  | ComposedSeparatorEditorBlock
  | ComposedTableEditorBlock;

export type ComposedEditorModel = {
  schemaVersion: 1;
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

export type ComposedPreviewBlock =
  | ComposedTextPreviewBlock
  | ComposedRichTextPreviewBlock
  | ComposedResponsePreviewBlock
  | ComposedSeparatorPreviewBlock
  | ComposedTablePreviewBlock;

export type ComposedPreviewModel = {
  schemaVersion: 1;
  blocks: ComposedPreviewBlock[];
  responseFields: ComposedResponseField[];
};

export function nextAvailableComposedBlockId(
  model: ComposedEditorModel,
  prefix: ComposedEditorBlock["type"],
) {
  return nextAvailableTableId(
    prefix,
    model.blocks.map((block) => block.id),
  );
}

export function nextAvailableResponseFieldId(model: ComposedEditorModel) {
  return nextAvailableTableId("answer", [
    ...model.responseFields.map((field) => field.id),
    ...model.blocks.flatMap((block) =>
      block.type === "table"
        ? block.table.responseFields.map((field) => field.id)
        : [],
    ),
  ]);
}

export function createTextBlock(
  id: string,
  text = "",
): ComposedTextEditorBlock {
  return {
    id,
    type: "text",
    content: plainTextToInlineContent(text),
  };
}

export function createRichTextBlock(
  id: string,
  content = createDefaultRichContent(),
): ComposedRichTextEditorBlock {
  return {
    id,
    type: "rich_text",
    content,
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
    id,
    type: "response",
    responseFieldId,
    label: overrides.label,
    placeholder: overrides.placeholder,
    correctValueSource: overrides.correctValueSource ?? {
      type: "literal",
      value: "",
    },
    points: overrides.points ?? 1,
    grading: overrides.grading ?? { mode: "exact" },
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
  table: TableEditorModel = createDefaultTableEditorModel(),
): ComposedTableEditorBlock {
  return {
    id,
    type: "table",
    table,
  };
}

export function createDefaultComposedEditorModel(): ComposedEditorModel {
  const responseFieldId = "answer_1";
  return {
    schemaVersion: 1,
    blocks: [
      createTextBlock("text_1", "Write the question here."),
      createResponseBlock("response_1", responseFieldId, {
        placeholder: "Answer",
      }),
    ],
    responseFields: [
      {
        id: responseFieldId,
        type: "text",
        label: "Answer",
        required: true,
      },
    ],
    references: [],
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
    blocks: model.blocks.map((block) =>
      block.id === blockId ? updater(block) : block,
    ),
  };
}

export function removeComposedBlock(
  model: ComposedEditorModel,
  blockId: string,
): ComposedEditorModel {
  const block = model.blocks.find((current) => current.id === blockId);
  const nextModel = {
    ...model,
    blocks: model.blocks.filter((current) => current.id !== blockId),
  };
  if (block?.type === "response") {
    const stillUsed = nextModel.blocks.some(
      (current) =>
        current.type === "response" &&
        current.responseFieldId === block.responseFieldId,
    );
    if (!stillUsed) {
      nextModel.responseFields = nextModel.responseFields.filter(
        (field) => field.id !== block.responseFieldId,
      );
    }
  }
  return nextModel;
}

export function moveComposedBlock(
  model: ComposedEditorModel,
  blockId: string,
  direction: "up" | "down",
): ComposedEditorModel {
  const index = model.blocks.findIndex((block) => block.id === blockId);
  if (index < 0) {
    return model;
  }
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= model.blocks.length) {
    return model;
  }
  const blocks = [...model.blocks];
  const [block] = blocks.splice(index, 1);
  blocks.splice(targetIndex, 0, block);
  return { ...model, blocks };
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
        for (const referenceId of extractInlineReferenceIds(block.content)) {
          addReferenceUsage(usage, referenceId, {
            type: "text_block",
            blockId: block.id,
          });
        }
        break;
      case "rich_text":
        for (const referenceId of extractRichReferenceIds(block.content)) {
          addReferenceUsage(usage, referenceId, {
            type: "rich_text_block",
            blockId: block.id,
          });
        }
        break;
      case "response":
        for (const referenceId of extractReferenceIdsFromValueExpression(
          block.correctValueSource,
        )) {
          addReferenceUsage(usage, referenceId, {
            type: "response_answer",
            blockId: block.id,
            responseFieldId: block.responseFieldId,
          });
        }
        break;
      case "table":
        for (const cell of block.table.cells) {
          if (cell.type === "content") {
            for (const referenceId of extractInlineReferenceIds(cell.content)) {
              addReferenceUsage(usage, referenceId, {
                type: "table_content_cell",
                blockId: block.id,
                cellId: cell.id,
              });
            }
            continue;
          }

          for (const referenceId of extractReferenceIdsFromValueExpression(
            cell.correctValueSource,
          )) {
            addReferenceUsage(usage, referenceId, {
              type: "table_answer_cell",
              blockId: block.id,
              cellId: cell.id,
              responseFieldId: cell.responseFieldId,
            });
          }
        }
        break;
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
          };
        case "table":
          return {
            ...block,
            table: {
              ...block.table,
              cells: block.table.cells.map((cell) =>
                cell.type === "content"
                  ? {
                      ...cell,
                      content: replaceInlineReferenceId(
                        cell.content,
                        previousReferenceId,
                        nextReferenceId,
                      ),
                    }
                  : {
                      ...cell,
                      correctValueSource: replaceReferenceIdInValueExpression(
                        cell.correctValueSource,
                        previousReferenceId,
                        nextReferenceId,
                      ),
                    },
              ),
            },
          };
        case "separator":
          return block;
        default:
          return assertNever(block);
      }
    }),
    references: model.references.map((reference) =>
      reference.id === previousReferenceId
        ? {
            ...reference,
            id: nextReferenceId,
          }
        : reference,
    ),
  };
}

function replaceReferenceIdInValueExpression(
  value: ValueExpression,
  previousReferenceId: string,
  nextReferenceId: string,
): ValueExpression {
  return value.type === "reference" && value.referenceId === previousReferenceId
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
      return extractReferenceIdsFromValueExpression(block.correctValueSource);
    case "table":
      return block.table.cells.flatMap((cell) =>
        cell.type === "content"
          ? extractInlineReferenceIds(cell.content)
          : extractReferenceIdsFromValueExpression(cell.correctValueSource),
      );
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

    counts.set(reference.source.sourceId, (counts.get(reference.source.sourceId) ?? 0) + 1);
  }

  return counts;
}
