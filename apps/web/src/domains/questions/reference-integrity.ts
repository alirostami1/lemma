import {
  type ComposedEditorModel,
  type ComposedInlineContent,
  type ComposedRichContent,
  extractUsedReferenceIdsFromComposedEditorModel,
  getReferenceUsage,
  getTableCellPrimitiveBlocks,
  type ReferenceSourceDraft,
  type ReferenceUsage,
  updateComposedBlock,
} from "./authoring";
import type {
  ComposedRichContentNode,
  ComposedRichListItem,
} from "./authoring/rich-content-types";
import { parseWorkbookRef } from "./workbook-reference";

export type ReferenceIntegrityAvailabilityStatus =
  | "available"
  | "unavailable"
  | "unknown"
  | "checking";

export type WorkbookCellAddress = {
  sheetName: string;
  rowIndex: number;
  columnIndex: number;
};

export type ReferenceIntegrityWorkbookSource = {
  type: "workbook";
  sourceId: string;
  availability:
    | {
        status: "available";
        hasCell(address: WorkbookCellAddress): boolean;
      }
    | {
        status: Exclude<ReferenceIntegrityAvailabilityStatus, "available">;
      };
};

export type ReferenceIntegrityIssueCode =
  | "inserted_value_unavailable"
  | "inserted_value_checking";

export type ReferenceIntegrityIssue = {
  code: ReferenceIntegrityIssueCode;
  referenceId: string;
  sourceId: string;
  locations: readonly ReferenceUsage[];
};

export type WorkbookReferenceUsage = {
  reference: ComposedEditorModel["references"][number];
  locations: readonly ReferenceUsage[];
};

export type InlineReferenceUsage = Extract<
  ReferenceUsage,
  { type: "text_block" | "rich_text_block" | "table_content_cell" }
>;

type RichReferenceUsage =
  | Extract<ReferenceUsage, { type: "rich_text_block" }>
  | (Extract<ReferenceUsage, { type: "table_content_cell" }> & {
      richNodePath: readonly number[];
    });

export function getUsedComposedReferenceIds(
  model: ComposedEditorModel,
): string[] {
  return extractUsedReferenceIdsFromComposedEditorModel(model);
}

export function getReferenceUsageLocations(
  model: ComposedEditorModel,
): ReadonlyMap<string, readonly ReferenceUsage[]> {
  return getReferenceUsage(model);
}

export function getWorkbookReferenceUsagesBySource(
  model: ComposedEditorModel,
): ReadonlyMap<string, readonly WorkbookReferenceUsage[]> {
  const usageByReferenceId = getReferenceUsage(model);
  const usagesBySourceId = new Map<string, WorkbookReferenceUsage[]>();

  for (const reference of model.references) {
    if (!isWorkbookReferenceSource(reference.source)) {
      continue;
    }

    const locations = usageByReferenceId.get(reference.id) ?? [];
    if (locations.length === 0) {
      continue;
    }

    usagesBySourceId.set(reference.source.sourceId, [
      ...(usagesBySourceId.get(reference.source.sourceId) ?? []),
      { locations, reference },
    ]);
  }

  return usagesBySourceId;
}

export function getReferenceIntegrityIssues(input: {
  model: ComposedEditorModel;
  sources: readonly ReferenceIntegrityWorkbookSource[];
}): ReferenceIntegrityIssue[] {
  const sourceById = new Map(
    input.sources.map((source) => [source.sourceId, source]),
  );
  const issues: ReferenceIntegrityIssue[] = [];

  for (const usages of getWorkbookReferenceUsagesBySource(
    input.model,
  ).values()) {
    for (const usage of usages) {
      if (!isWorkbookReferenceSource(usage.reference.source)) {
        continue;
      }

      const sourceId = usage.reference.source.sourceId;
      const source = sourceById.get(sourceId);
      const availability = getWorkbookReferenceAvailability({
        locations: usage.locations,
        reference: usage.reference.source,
        source,
      });
      if (availability === "available") {
        continue;
      }

      issues.push({
        code:
          availability === "unavailable"
            ? "inserted_value_unavailable"
            : "inserted_value_checking",
        locations: usage.locations,
        referenceId: usage.reference.id,
        sourceId,
      });
    }
  }

  return issues;
}

export function getUnavailableUsedWorkbookReferenceIdsForSource(input: {
  model: ComposedEditorModel;
  sourceId: string;
  source: ReferenceIntegrityWorkbookSource;
}): string[] {
  const usagesBySource = getWorkbookReferenceUsagesBySource(input.model);
  const unavailableReferenceIds: string[] = [];

  for (const usage of usagesBySource.get(input.sourceId) ?? []) {
    if (!isWorkbookReferenceSource(usage.reference.source)) {
      continue;
    }

    const availability = getWorkbookReferenceAvailability({
      locations: usage.locations,
      reference: usage.reference.source,
      source: input.source,
    });
    if (availability === "unavailable") {
      unavailableReferenceIds.push(usage.reference.id);
    }
  }

  return unavailableReferenceIds;
}

export function removeReferenceUsageFromComposedEditorModel(input: {
  model: ComposedEditorModel;
  referenceId: string;
  usage: ReferenceUsage;
}): ComposedEditorModel {
  const usage = input.usage;

  return updateComposedBlock(input.model, usage.blockId, (block) => {
    switch (usage.type) {
      case "text_block":
        return block.type === "text"
          ? {
              ...block,
              content: removeInlineReferenceUsage({
                content: block.content,
                referenceId: input.referenceId,
                usage,
              }),
            }
          : block;
      case "rich_text_block":
        return block.type === "rich_text"
          ? {
              ...block,
              content: removeRichReferenceUsage({
                content: block.content,
                referenceId: input.referenceId,
                usage,
              }),
            }
          : block;
      case "response_answer":
        return block.type === "response" &&
          block.correctValueSource?.type === "reference" &&
          block.correctValueSource.referenceId === input.referenceId
          ? {
              ...block,
              correctValueSource: { type: "literal", value: "" },
            }
          : block;
      case "table_content_cell":
        return block.type === "table"
          ? {
              ...block,
              table: {
                ...block.table,
                cells: block.table.cells.map((cell) =>
                  cell.id === usage.cellId
                    ? {
                        blocks: getTableCellPrimitiveBlocks(cell).map(
                          (cellBlock) =>
                            cellBlock.id !== usage.cellBlockId
                              ? cellBlock
                              : cellBlock.type === "text"
                                ? {
                                    ...cellBlock,
                                    content: removeInlineReferenceUsage({
                                      content: cellBlock.content,
                                      referenceId: input.referenceId,
                                      usage,
                                    }),
                                  }
                                : cellBlock.type === "rich_text" &&
                                    usage.richNodePath
                                  ? {
                                      ...cellBlock,
                                      content: removeRichReferenceUsage({
                                        content: cellBlock.content,
                                        referenceId: input.referenceId,
                                        usage,
                                      }),
                                    }
                                  : cellBlock,
                        ),
                        columnId: cell.columnId,
                        id: cell.id,
                        rowId: cell.rowId,
                      }
                    : cell,
                ),
              },
            }
          : block;
      case "table_answer_cell":
        return block.type === "table"
          ? {
              ...block,
              table: {
                ...block.table,
                cells: block.table.cells.map((cell) =>
                  cell.id === usage.cellId
                    ? {
                        ...cell,
                        blocks: getTableCellPrimitiveBlocks(cell).map(
                          (cellBlock) =>
                            cellBlock.type === "input" &&
                            cellBlock.id === usage.cellBlockId &&
                            cellBlock.correctValueSource?.type ===
                              "reference" &&
                            cellBlock.correctValueSource.referenceId ===
                              input.referenceId
                              ? {
                                  ...cellBlock,
                                  correctValueSource: {
                                    type: "literal",
                                    value: "",
                                  },
                                }
                              : cellBlock,
                        ),
                      }
                    : cell,
                ),
              },
            }
          : block;
      default:
        return assertNever(usage);
    }
  });
}

export function removeInlineReferenceUsageFromComposedEditorModel(input: {
  model: ComposedEditorModel;
  referenceId: string;
  usage: InlineReferenceUsage;
}): ComposedEditorModel {
  return removeReferenceUsageFromComposedEditorModel(input);
}

function getWorkbookReferenceAvailability(input: {
  reference: Extract<
    ReferenceSourceDraft,
    { type: "workbook_cell" | "workbook_range" }
  >;
  locations: readonly ReferenceUsage[];
  source?: ReferenceIntegrityWorkbookSource;
}): ReferenceIntegrityAvailabilityStatus {
  if (!input.source) {
    return "unavailable";
  }
  if (input.source.availability.status !== "available") {
    return input.source.availability.status;
  }

  const parsedRef = parseWorkbookRef(input.reference.ref);
  if (!parsedRef) {
    return "unavailable";
  }

  if (input.reference.type === "workbook_cell") {
    return input.source.availability.hasCell({
      columnIndex: parsedRef.startColumnIndex,
      rowIndex: parsedRef.startRowIndex,
      sheetName: parsedRef.sheetName,
    })
      ? "available"
      : "unavailable";
  }

  for (const location of input.locations) {
    if (locationHasRangeCell(location)) {
      const rowIndex = parsedRef.startRowIndex + location.rangeCell.rowOffset;
      const columnIndex =
        parsedRef.startColumnIndex + location.rangeCell.columnOffset;
      if (
        rowIndex < parsedRef.startRowIndex ||
        columnIndex < parsedRef.startColumnIndex ||
        rowIndex > parsedRef.endRowIndex ||
        columnIndex > parsedRef.endColumnIndex ||
        !input.source.availability.hasCell({
          columnIndex,
          rowIndex,
          sheetName: parsedRef.sheetName,
        })
      ) {
        return "unavailable";
      }
      continue;
    }

    if (
      !isCompleteWorkbookRangeAvailable(input.source.availability, parsedRef)
    ) {
      return "unavailable";
    }
  }

  return "available";
}

function isCompleteWorkbookRangeAvailable(
  source: Extract<
    ReferenceIntegrityWorkbookSource["availability"],
    { status: "available" }
  >,
  parsedRef: NonNullable<ReturnType<typeof parseWorkbookRef>>,
): boolean {
  for (
    let rowIndex = parsedRef.startRowIndex;
    rowIndex <= parsedRef.endRowIndex;
    rowIndex += 1
  ) {
    for (
      let columnIndex = parsedRef.startColumnIndex;
      columnIndex <= parsedRef.endColumnIndex;
      columnIndex += 1
    ) {
      if (
        !source.hasCell({
          columnIndex,
          rowIndex,
          sheetName: parsedRef.sheetName,
        })
      ) {
        return false;
      }
    }
  }

  return true;
}

function removeInlineReferenceUsage(input: {
  content: ComposedInlineContent[];
  referenceId: string;
  usage: ReferenceUsage;
}): ComposedInlineContent[] {
  const inlineContentIndex = getUsageInlineContentIndex(input.usage);
  if (inlineContentIndex === null) {
    return input.content;
  }

  return input.content.filter((item, index) => {
    if (index !== inlineContentIndex) {
      return true;
    }
    return (
      item.type !== "reference" ||
      item.referenceId !== input.referenceId ||
      !rangeCellMatches(item.rangeCell, getUsageRangeCell(input.usage))
    );
  });
}

function removeRichReferenceUsage(input: {
  content: ComposedRichContent;
  referenceId: string;
  usage: ReferenceUsage;
}): ComposedRichContent {
  if (!isRichReferenceUsage(input.usage)) {
    return input.content;
  }
  const usage = input.usage;

  return {
    ...input.content,
    content: input.content.content.map((node, index) =>
      index === usage.richNodePath[0]
        ? removeRichNodeReferenceUsageAtPath({
            node,
            path: usage.richNodePath.slice(1),
            referenceId: input.referenceId,
            usage,
          })
        : node,
    ),
  };
}

function isRichReferenceUsage(
  usage: ReferenceUsage,
): usage is RichReferenceUsage {
  return (
    usage.type === "rich_text_block" ||
    (usage.type === "table_content_cell" && usage.richNodePath !== undefined)
  );
}

function removeRichNodeReferenceUsageAtPath(input: {
  node: ComposedRichContentNode;
  path: readonly number[];
  referenceId: string;
  usage: RichReferenceUsage;
}): ComposedRichContentNode {
  const { node, path, referenceId, usage } = input;

  if (node.type === "paragraph" || node.type === "heading") {
    return path.length === 0
      ? {
          ...node,
          content: removeInlineReferenceUsage({
            content: node.content,
            referenceId,
            usage,
          }),
        }
      : node;
  }

  const [itemIndex, childIndex, ...childPath] = path;
  if (itemIndex === undefined || childIndex === undefined) {
    return node;
  }

  return {
    ...node,
    items: node.items.map((item, index) =>
      index === itemIndex
        ? {
            ...item,
            content: item.content.map((child, childContentIndex) =>
              childContentIndex === childIndex
                ? removeRichListItemChildReferenceUsageAtPath({
                    node: child,
                    path: childPath,
                    referenceId,
                    usage,
                  })
                : child,
            ),
          }
        : item,
    ),
  };
}

function removeRichListItemChildReferenceUsageAtPath(input: {
  node: ComposedRichListItem["content"][number];
  path: readonly number[];
  referenceId: string;
  usage: RichReferenceUsage;
}): ComposedRichListItem["content"][number] {
  const { node, path, referenceId, usage } = input;

  if (node.type === "paragraph") {
    return path.length === 0
      ? {
          ...node,
          content: removeInlineReferenceUsage({
            content: node.content,
            referenceId,
            usage,
          }),
        }
      : node;
  }

  const [itemIndex, childIndex, ...childPath] = path;
  if (itemIndex === undefined || childIndex === undefined) {
    return node;
  }

  return {
    ...node,
    items: node.items.map((item, index) =>
      index === itemIndex
        ? {
            ...item,
            content: item.content.map((child, childContentIndex) =>
              childContentIndex === childIndex
                ? removeRichListItemChildReferenceUsageAtPath({
                    node: child,
                    path: childPath,
                    referenceId,
                    usage,
                  })
                : child,
            ),
          }
        : item,
    ),
  };
}

function isWorkbookReferenceSource(
  source: ReferenceSourceDraft,
): source is Extract<
  ReferenceSourceDraft,
  { type: "workbook_cell" | "workbook_range" }
> {
  return source.type === "workbook_cell" || source.type === "workbook_range";
}

function locationHasRangeCell(
  usage: ReferenceUsage,
): usage is ReferenceUsage & {
  rangeCell: { rowOffset: number; columnOffset: number };
} {
  return "rangeCell" in usage && usage.rangeCell !== undefined;
}

function getUsageRangeCell(usage: ReferenceUsage) {
  return locationHasRangeCell(usage) ? usage.rangeCell : undefined;
}

function getUsageInlineContentIndex(usage: ReferenceUsage): number | null {
  switch (usage.type) {
    case "text_block":
    case "rich_text_block":
    case "table_content_cell":
      return usage.inlineContentIndex;
    case "response_answer":
    case "table_answer_cell":
      return null;
    default:
      return assertNever(usage);
  }
}

function rangeCellMatches(
  left: { rowOffset: number; columnOffset: number } | undefined,
  right: { rowOffset: number; columnOffset: number } | undefined,
): boolean {
  if (!left && !right) {
    return true;
  }
  return (
    left?.rowOffset === right?.rowOffset &&
    left?.columnOffset === right?.columnOffset
  );
}

function assertNever(value: never): never {
  throw new Error(`Unexpected reference usage: ${String(value)}`);
}
