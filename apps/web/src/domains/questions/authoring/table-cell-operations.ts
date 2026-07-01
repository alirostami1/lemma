import type { ComposedInlineContent, RangeCellOffset } from "./inline-content";
import { createDefaultRequiredInputPrimitiveForNewAnswer } from "./input-primitive";
import type { ComposedRichListItem } from "./rich-content-types";
import {
  getPrimaryTableInputBlock,
  getPrimaryTableTextBlock,
  getTableCellPrimitiveBlocks,
  nextAvailableId,
  type TableCellFormatting,
  type TableEditorCell,
  type TableEditorInputBlock,
  type TableEditorModel,
  type TableEditorPrimitiveBlock,
  type TableEditorRichTextBlock,
  type TableEditorSeparatorBlock,
  type TableEditorTextBlock,
  type TableResponseField,
  type ValueExpression,
} from "./table-model";
import type { TableEditorSelection } from "./table-selection-operations";
import {
  getSelectedTableCoordinates,
  normalizeTableSelection,
  type TableCellCoordinate,
  tableCoordinateKey,
} from "./table-selection-operations";

const DEFAULT_TABLE_ANSWER_FIELD_TYPE: TableResponseField["type"] = "number";

export type SelectedTableCoordinateSummary = {
  coordinates: TableCellCoordinate[];
  coordinateKeys: ReadonlySet<string>;
  count: number;
  hasRangeBackedReferences: boolean;
};

export type TableSelectedCellAnswerResolution =
  | {
      type: "convert";
      options?: {
        correctValueSource?: ValueExpression;
        dropSingleReferenceContent?: boolean;
      };
    }
  | { type: "skip" };

export type SelectedTableCellsResponseBatchResult = {
  model: TableEditorModel;
  convertedCellCount: number;
  skippedCellCount: number;
};

type TableBatchEditState = {
  cells: TableEditorCell[];
  selectedCoordinateKeys: ReadonlySet<string>;
};

type TableBatchIdAllocator = {
  nextIndexByPrefix: Map<string, number>;
  usedIds: Set<string>;
};

export function createTableCellsByCoordinateKey(
  model: TableEditorModel,
): ReadonlyMap<string, TableEditorCell> {
  return new Map(
    model.cells.map((cell) => [
      tableCoordinateKey({ columnId: cell.columnId, rowId: cell.rowId }),
      cell,
    ]),
  );
}

export function createTableResponseFieldsById(
  model: TableEditorModel,
): ReadonlyMap<string, TableResponseField> {
  return new Map(model.responseFields.map((field) => [field.id, field]));
}

export function getTableCell(
  model: TableEditorModel,
  cellId: string,
): TableEditorCell | null {
  return model.cells.find((cell) => cell.id === cellId) ?? null;
}

export function getTableCellAt(
  model: TableEditorModel,
  rowId: string,
  columnId: string,
): TableEditorCell | null {
  return (
    model.cells.find(
      (cell) => cell.rowId === rowId && cell.columnId === columnId,
    ) ?? null
  );
}

export function ensureTableCell(
  model: TableEditorModel,
  rowId: string,
  columnId: string,
): { model: TableEditorModel; cell: TableEditorCell } {
  const existing = getTableCellAt(model, rowId, columnId);
  if (existing) {
    return { cell: existing, model };
  }

  const cell: TableEditorCell = {
    blocks: [],
    columnId,
    id: nextAvailableId(
      "cell",
      model.cells.map((item) => item.id),
    ),
    rowId,
  };

  return {
    cell,
    model: {
      ...model,
      cells: [...model.cells, cell],
    },
  };
}

export function updateTableCell(
  model: TableEditorModel,
  cellId: string,
  update: (cell: TableEditorCell) => TableEditorCell,
): TableEditorModel {
  return pruneUnusedResponseFields({
    ...model,
    cells: model.cells.map((cell) =>
      cell.id === cellId ? update(cell) : cell,
    ),
  });
}

export function makeContentCell(
  model: TableEditorModel,
  cellId: string,
): TableEditorModel {
  return updateTableCell(model, cellId, (cell) => ({
    blocks: contentBlocksForContentCell(model, cell),
    columnId: cell.columnId,
    ...(cell.formatting === undefined ? {} : { formatting: cell.formatting }),
    id: cell.id,
    rowId: cell.rowId,
  }));
}

export function makeResponseCell(
  model: TableEditorModel,
  cellId: string,
  options?: {
    correctValueSource?: ValueExpression;
    dropSingleReferenceContent?: boolean;
  },
): TableEditorModel {
  const cell = getTableCell(model, cellId);
  if (!cell) {
    return model;
  }

  if (getPrimaryTableInputBlock(cell)) {
    return ensureResponseFieldForCell(model, cell.id);
  }

  const { cell: responseCell, responseField } = createAnswerCellForPosition({
    cellId: cell.id,
    columnId: cell.columnId,
    model,
    previousCell: cell,
    rowId: cell.rowId,
    options,
  });

  return {
    ...model,
    cells: model.cells.map((current) =>
      current.id === cell.id ? responseCell : current,
    ),
    responseFields: [...model.responseFields, responseField],
  };
}

export function ensureResponseFieldForCell(
  model: TableEditorModel,
  cellId: string,
): TableEditorModel {
  const cell = getTableCell(model, cellId);
  const inputBlock = cell ? getPrimaryTableInputBlock(cell) : null;
  if (!cell || !inputBlock) {
    return model;
  }

  if (
    model.responseFields.some(
      (field) => field.id === inputBlock.responseFieldId,
    )
  ) {
    return model;
  }

  return repairMissingAnswerFieldForCell(model, cell.id);
}

export function repairMissingAnswerFieldForCell(
  model: TableEditorModel,
  cellId: string,
): TableEditorModel {
  const cell = getTableCell(model, cellId);
  const inputBlock = cell ? getPrimaryTableInputBlock(cell) : null;
  if (!cell || !inputBlock) {
    return model;
  }

  if (
    model.responseFields.some(
      (field) => field.id === inputBlock.responseFieldId,
    )
  ) {
    return model;
  }

  const responseField: TableResponseField = {
    id: inputBlock.responseFieldId,
    label: inputBlock.label ?? nextTableAnswerLabel(model),
    type: inputBlock.input?.type ?? DEFAULT_TABLE_ANSWER_FIELD_TYPE,
  };

  return {
    ...model,
    responseFields: [...model.responseFields, responseField],
  };
}

export function updateResponseFieldForCell(
  model: TableEditorModel,
  cellId: string,
  update: (field: TableResponseField) => TableResponseField,
): TableEditorModel {
  const cell = getTableCell(model, cellId);
  const inputBlock = cell ? getPrimaryTableInputBlock(cell) : null;
  if (!inputBlock) {
    return model;
  }

  return {
    ...model,
    responseFields: model.responseFields.map((field) =>
      field.id === inputBlock.responseFieldId ? update(field) : field,
    ),
  };
}

export function updateContentCellContent(
  model: TableEditorModel,
  cellId: string,
  content: TableEditorTextBlock["content"],
): TableEditorModel {
  const cell = getTableCell(model, cellId);
  const textBlock = cell ? getPrimaryTableTextBlock(cell) : null;
  return textBlock
    ? updateTableCellTextBlockContent(model, cellId, textBlock.id, content)
    : model;
}

export function updateTableCellTextBlockContent(
  model: TableEditorModel,
  cellId: string,
  cellBlockId: string,
  content: TableEditorTextBlock["content"],
): TableEditorModel {
  return updateTableCellPrimitiveBlock(model, cellId, cellBlockId, (block) =>
    block.type === "text" ? { ...block, content } : block,
  );
}

export function updateResponseCellCorrectValueSource(
  model: TableEditorModel,
  cellId: string,
  correctValueSource: ValueExpression,
): TableEditorModel {
  const cell = getTableCell(model, cellId);
  const inputBlock = cell ? getPrimaryTableInputBlock(cell) : null;
  return inputBlock
    ? updateTableCellInputBlockCorrectValueSource(
        model,
        cellId,
        inputBlock.id,
        correctValueSource,
      )
    : model;
}

export function makeSelectedCellsContent(
  model: TableEditorModel,
  selection: TableEditorSelection,
): TableEditorModel {
  const state = createTableBatchEditState(model, selection);
  if (state.selectedCoordinateKeys.size === 0) {
    return model;
  }
  const primitiveIds = createTableBatchIdAllocator(
    state.cells.flatMap((cell) => cell.blocks.map((block) => block.id)),
  );

  return pruneUnusedResponseFields({
    ...model,
    cells: state.cells.map((cell) =>
      state.selectedCoordinateKeys.has(coordinateKeyForCell(cell))
        ? contentCellForBatch(model, cell, primitiveIds)
        : cell,
    ),
  });
}

export function makeSelectedCellsResponse(
  model: TableEditorModel,
  selection: TableEditorSelection,
): TableEditorModel {
  return makeSelectedCellsResponseWithCellResolution(model, selection, () => ({
    type: "convert",
  })).model;
}

export function makeSelectedCellsResponseWithCellResolution(
  model: TableEditorModel,
  selection: TableEditorSelection,
  resolveCellConversion: (
    cell: TableEditorCell,
  ) => TableSelectedCellAnswerResolution,
): SelectedTableCellsResponseBatchResult {
  const state = createTableBatchEditState(model, selection);
  if (state.selectedCoordinateKeys.size === 0) {
    return { convertedCellCount: 0, model, skippedCellCount: 0 };
  }
  const primitiveIds = createTableBatchIdAllocator(
    state.cells.flatMap((cell) => cell.blocks.map((block) => block.id)),
  );
  const responseFieldIds = createTableBatchIdAllocator([
    ...model.responseFields.map((field) => field.id),
    ...state.cells.flatMap((cell) =>
      cell.blocks.flatMap((block) =>
        block.type === "input" ? [block.responseFieldId] : [],
      ),
    ),
  ]);
  const responseFields = [...model.responseFields];
  const responseFieldsById = new Map(
    responseFields.map((field) => [field.id, field]),
  );
  let convertedCellCount = 0;
  let skippedCellCount = 0;
  let tableChanged = state.cells.length !== model.cells.length;

  const cells = state.cells.map((cell) => {
    if (!state.selectedCoordinateKeys.has(coordinateKeyForCell(cell))) {
      return cell;
    }

    const inputBlock = getPrimaryTableInputBlock(cell);
    if (inputBlock) {
      if (!responseFieldsById.has(inputBlock.responseFieldId)) {
        const responseField: TableResponseField = {
          id: inputBlock.responseFieldId,
          label: inputBlock.label ?? tableAnswerLabel(responseFields.length),
          type: inputBlock.input?.type ?? DEFAULT_TABLE_ANSWER_FIELD_TYPE,
        };
        responseFields.push(responseField);
        responseFieldsById.set(responseField.id, responseField);
        tableChanged = true;
      }
      convertedCellCount += 1;
      return cell;
    }

    const resolution = resolveCellConversion(cell);
    if (resolution.type === "skip") {
      skippedCellCount += 1;
      return cell;
    }

    const responseField = createTableAnswerField(
      allocateTableBatchId(responseFieldIds, "answer"),
      responseFields.length,
    );
    responseFields.push(responseField);
    responseFieldsById.set(responseField.id, responseField);
    convertedCellCount += 1;
    tableChanged = true;
    return createAnswerCell({
      cellId: cell.id,
      columnId: cell.columnId,
      inputBlockId: allocateTableBatchId(
        primitiveIds,
        `${model.blockId ?? "table"}_${cell.id}_input`,
      ),
      previousCell: cell,
      responseField,
      rowId: cell.rowId,
      options: resolution.options,
    });
  });

  return {
    convertedCellCount,
    model: tableChanged
      ? pruneUnusedResponseFields({ ...model, cells, responseFields })
      : model,
    skippedCellCount,
  };
}

export function applyFormattingToSelectedCells(
  model: TableEditorModel,
  selection: TableEditorSelection,
  formatting: TableCellFormatting,
): TableEditorModel {
  return updateSelectedCellsInBatch(
    model,
    selection,
    (cell) => ({
      ...cell,
      formatting: mergeCellFormatting(cell.formatting, formatting),
    }),
    true,
  );
}

export function clearFormattingFromSelectedCells(
  model: TableEditorModel,
  selection: TableEditorSelection,
): TableEditorModel {
  return updateSelectedCellsInBatch(
    model,
    selection,
    (cell) => {
      const { formatting: _formatting, ...rest } = cell;
      return rest;
    },
    false,
  );
}

export function getSelectedTableCoordinateSummary(
  model: TableEditorModel,
  selection: TableEditorSelection,
  cellsByCoordinateKey = createTableCellsByCoordinateKey(model),
): SelectedTableCoordinateSummary {
  const normalizedSelection = normalizeTableSelection(model, selection);
  const coordinates = getSelectedTableCoordinates(model, normalizedSelection);
  const coordinateKeys = new Set(
    coordinates.map((coordinate) => tableCoordinateKey(coordinate)),
  );
  const hasRangeBackedReferences = coordinates.some((coordinate) => {
    const cell = cellsByCoordinateKey.get(tableCoordinateKey(coordinate));
    return cell ? tableCellHasRangeBackedReference(cell) : false;
  });

  return {
    coordinateKeys,
    coordinates,
    count: coordinates.length,
    hasRangeBackedReferences,
  };
}

export function selectionHasRangeBackedReferences(
  model: TableEditorModel,
  selection: TableEditorSelection,
): boolean {
  return getSelectedTableCoordinateSummary(model, selection)
    .hasRangeBackedReferences;
}

export function tableCellHasRangeBackedReference(
  cell: TableEditorCell,
): boolean {
  return getTableCellPrimitiveBlocks(cell).some((block) =>
    blockHasRangeBackedReference(block),
  );
}

export function updateTableCellInputBlockCorrectValueSource(
  model: TableEditorModel,
  cellId: string,
  cellBlockId: string,
  correctValueSource: ValueExpression,
): TableEditorModel {
  return updateTableCellPrimitiveBlock(model, cellId, cellBlockId, (block) =>
    block.type === "input" ? { ...block, correctValueSource } : block,
  );
}

function updateTableCellPrimitiveBlock(
  model: TableEditorModel,
  cellId: string,
  cellBlockId: string,
  update: (block: TableEditorPrimitiveBlock) => TableEditorPrimitiveBlock,
): TableEditorModel {
  return updateTableCell(model, cellId, (cell) => ({
    ...cell,
    blocks: getTableCellPrimitiveBlocks(cell).map((block) =>
      block.id === cellBlockId ? update(block) : block,
    ),
  }));
}

export function pruneUnusedResponseFields(
  model: TableEditorModel,
): TableEditorModel {
  const usedResponseFieldIds = new Set(
    model.cells.flatMap((cell) =>
      getTableCellPrimitiveBlocks(cell).flatMap((block) =>
        block.type === "input" ? [block.responseFieldId] : [],
      ),
    ),
  );

  return {
    ...model,
    responseFields: model.responseFields.filter((field) =>
      usedResponseFieldIds.has(field.id),
    ),
  };
}

export function duplicateTableCell({
  cell,
  rowId = cell.rowId,
  columnId = cell.columnId,
  usedCellIds,
  usedPrimitiveBlockIds,
  responseFields,
}: {
  cell: TableEditorCell;
  rowId?: string;
  columnId?: string;
  usedCellIds: Set<string>;
  usedPrimitiveBlockIds: Set<string>;
  responseFields: TableResponseField[];
}): TableEditorCell {
  const nextCellId = nextAvailableId("cell", usedCellIds);
  usedCellIds.add(nextCellId);

  return {
    blocks: getTableCellPrimitiveBlocks(cell).map((block) => {
      const id = nextAvailableId(`${block.id}_copy`, usedPrimitiveBlockIds);
      usedPrimitiveBlockIds.add(id);
      return block.type === "input"
        ? duplicateInputBlock(block, id, responseFields)
        : { ...block, id };
    }),
    columnId,
    ...(cell.formatting === undefined ? {} : { formatting: cell.formatting }),
    id: nextCellId,
    rowId,
  };
}

function updateSelectedCellsInBatch(
  model: TableEditorModel,
  selection: TableEditorSelection,
  update: (cell: TableEditorCell) => TableEditorCell,
  createMissingCells: boolean,
): TableEditorModel {
  const state = createTableBatchEditState(model, selection, createMissingCells);
  if (state.selectedCoordinateKeys.size === 0) {
    return model;
  }
  return pruneUnusedResponseFields({
    ...model,
    cells: state.cells.map((cell) =>
      state.selectedCoordinateKeys.has(coordinateKeyForCell(cell))
        ? update(cell)
        : cell,
    ),
  });
}

function createTableBatchEditState(
  model: TableEditorModel,
  selection: TableEditorSelection,
  createMissingCells = true,
): TableBatchEditState {
  const coordinates = getSelectedTableCoordinates(model, selection);
  const selectedCoordinateKeys = new Set(
    coordinates.map((coordinate) => tableCoordinateKey(coordinate)),
  );
  if (coordinates.length === 0 || !createMissingCells) {
    return { cells: model.cells, selectedCoordinateKeys };
  }

  const cells = [...model.cells];
  const cellsByCoordinateKey = new Map(createTableCellsByCoordinateKey(model));
  const cellIds = createTableBatchIdAllocator(
    model.cells.map((cell) => cell.id),
  );
  for (const coordinate of coordinates) {
    if (cellsByCoordinateKey.has(tableCoordinateKey(coordinate))) {
      continue;
    }
    const cell: TableEditorCell = {
      blocks: [],
      columnId: coordinate.columnId,
      id: allocateTableBatchId(cellIds, "cell"),
      rowId: coordinate.rowId,
    };
    cells.push(cell);
    cellsByCoordinateKey.set(tableCoordinateKey(coordinate), cell);
  }
  return { cells, selectedCoordinateKeys };
}

function createTableBatchIdAllocator(
  ids: Iterable<string>,
): TableBatchIdAllocator {
  return { nextIndexByPrefix: new Map(), usedIds: new Set(ids) };
}

function allocateTableBatchId(
  allocator: TableBatchIdAllocator,
  prefix: string,
): string {
  let index = allocator.nextIndexByPrefix.get(prefix) ?? 1;
  let id = `${prefix}_${index}`;
  while (allocator.usedIds.has(id)) {
    index += 1;
    id = `${prefix}_${index}`;
  }
  allocator.nextIndexByPrefix.set(prefix, index + 1);
  allocator.usedIds.add(id);
  return id;
}

function coordinateKeyForCell(cell: TableEditorCell): string {
  return tableCoordinateKey({ columnId: cell.columnId, rowId: cell.rowId });
}

function contentCellForBatch(
  model: TableEditorModel,
  cell: TableEditorCell,
  primitiveIds: TableBatchIdAllocator,
): TableEditorCell {
  return {
    blocks: contentBlocksForContentCellWithId(cell, () =>
      allocateTableBatchId(
        primitiveIds,
        `${model.blockId ?? "table"}_${cell.id}_text`,
      ),
    ),
    columnId: cell.columnId,
    ...(cell.formatting === undefined ? {} : { formatting: cell.formatting }),
    id: cell.id,
    rowId: cell.rowId,
  };
}

function mergeCellFormatting(
  current: TableCellFormatting | undefined,
  update: TableCellFormatting,
): TableCellFormatting {
  const next: TableCellFormatting = {};
  const textAlign = update.textAlign ?? current?.textAlign;
  const emphasis = update.emphasis ?? current?.emphasis;
  const tone = update.tone ?? current?.tone;
  if (textAlign !== undefined) {
    next.textAlign = textAlign;
  }
  if (emphasis !== undefined) {
    next.emphasis = emphasis;
  }
  if (tone !== undefined) {
    next.tone = tone;
  }
  return next;
}

function duplicateInputBlock(
  block: TableEditorInputBlock,
  id: string,
  responseFields: TableResponseField[],
): TableEditorInputBlock {
  const sourceField = responseFields.find(
    (field) => field.id === block.responseFieldId,
  );
  if (!sourceField) {
    throw new Error(
      `Cannot duplicate table input block ${block.id}: missing response field ${block.responseFieldId}.`,
    );
  }

  const responseField = createNextTableAnswerField(
    modelForDuplicate(responseFields),
    {
      label: block.label,
      type: sourceField.type,
    },
  );
  responseFields.push(responseField);

  return {
    ...block,
    id,
    input:
      block.input ??
      createDefaultRequiredInputPrimitiveForNewAnswer(responseField.type),
    label: block.label ?? responseField.label,
    responseFieldId: responseField.id,
  };
}

function createAnswerCellForPosition({
  model,
  cellId,
  rowId,
  columnId,
  previousCell,
  options,
}: {
  model: TableEditorModel;
  cellId: string;
  rowId: string;
  columnId: string;
  previousCell?: TableEditorCell;
  options?: {
    correctValueSource?: ValueExpression;
    dropSingleReferenceContent?: boolean;
  };
}): {
  cell: TableEditorCell;
  responseField: TableResponseField;
} {
  const previousInputBlock = previousCell
    ? getPrimaryTableInputBlock(previousCell)
    : null;
  const responseField = createNextTableAnswerField(model, {
    label: previousInputBlock?.label,
  });
  const inputBlockId = nextAvailableId(
    `${model.blockId ?? "table"}_${cellId}_input`,
    model.cells.flatMap((cell) => cell.blocks.map((block) => block.id)),
  );

  return {
    cell: createAnswerCell({
      cellId,
      columnId,
      inputBlockId,
      options,
      previousCell,
      responseField,
      rowId,
    }),
    responseField,
  };
}

function createAnswerCell({
  cellId,
  rowId,
  columnId,
  previousCell,
  responseField,
  inputBlockId,
  options,
}: {
  cellId: string;
  rowId: string;
  columnId: string;
  previousCell?: TableEditorCell;
  responseField: TableResponseField;
  inputBlockId: string;
  options?: {
    correctValueSource?: ValueExpression;
    dropSingleReferenceContent?: boolean;
  };
}): TableEditorCell {
  const preservedBlocks = previousCell
    ? getTableCellPrimitiveBlocks(previousCell).filter(
        (block) => block.type !== "input",
      )
    : [];
  const correctValueSource: ValueExpression = options?.correctValueSource ??
    correctValueSourceFromContentBlocks(preservedBlocks) ?? {
      type: "literal",
      value: "",
    };
  const visibleContentBlocks = contentBlocksForConvertedAnswerCell(
    preservedBlocks,
    correctValueSource,
    options?.dropSingleReferenceContent ?? true,
  );

  return {
    blocks: [
      ...visibleContentBlocks,
      {
        correctValueSource,
        grading: { mode: "exact" },
        id: inputBlockId,
        input: createDefaultRequiredInputPrimitiveForNewAnswer(
          responseField.type,
        ),
        label: responseField.label,
        points: 1,
        responseFieldId: responseField.id,
        type: "input",
      },
    ],
    columnId,
    ...(previousCell?.formatting === undefined
      ? {}
      : { formatting: previousCell.formatting }),
    id: cellId,
    rowId,
  };
}

function contentBlocksForContentCell(
  model: TableEditorModel,
  cell: TableEditorCell,
): Array<
  TableEditorTextBlock | TableEditorRichTextBlock | TableEditorSeparatorBlock
> {
  return contentBlocksForContentCellWithId(cell, () =>
    nextAvailableId(
      `${model.blockId ?? "table"}_${cell.id}_text`,
      model.cells.flatMap((item) => item.blocks.map((block) => block.id)),
    ),
  );
}

function contentBlocksForContentCellWithId(
  cell: TableEditorCell,
  allocateTextBlockId: () => string,
): Array<
  TableEditorTextBlock | TableEditorRichTextBlock | TableEditorSeparatorBlock
> {
  const preservedBlocks = getTableCellPrimitiveBlocks(cell).filter(
    (block) => block.type !== "input",
  );
  if (preservedBlocks.length > 0) {
    return preservedBlocks;
  }

  return [
    {
      content: referenceContentFromInputBlocks(cell),
      id: allocateTextBlockId(),
      type: "text",
    },
  ];
}

function referenceContentFromInputBlocks(
  cell: TableEditorCell,
): ComposedInlineContent[] {
  return getTableCellPrimitiveBlocks(cell).flatMap((block) =>
    block.type === "input" && block.correctValueSource?.type === "reference"
      ? [
          {
            referenceId: block.correctValueSource.referenceId,
            type: "reference",
          },
        ]
      : [],
  );
}

function correctValueSourceFromContentBlocks(
  blocks: TableEditorPrimitiveBlock[],
): ValueExpression | null {
  for (const block of blocks) {
    if (block.type === "text") {
      const referenceId = firstDirectInlineReferenceId(block.content);
      if (referenceId) {
        return { referenceId, type: "reference" };
      }
    }
    if (block.type === "rich_text") {
      const referenceId = firstDirectReferenceInRichContent(block.content);
      if (referenceId) {
        return { referenceId, type: "reference" };
      }
    }
  }
  return null;
}

function contentBlocksForConvertedAnswerCell(
  blocks: TableEditorPrimitiveBlock[],
  correctValueSource: ValueExpression,
  dropSingleReferenceContent: boolean,
): TableEditorPrimitiveBlock[] {
  if (correctValueSource.type !== "reference" || !dropSingleReferenceContent) {
    return blocks;
  }

  return blocks.filter((block) => !isSingleReferenceContentBlock(block));
}

function isSingleReferenceContentBlock(
  block: TableEditorPrimitiveBlock,
): boolean {
  if (block.type === "text") {
    return isSingleInlineReference(block.content);
  }
  if (block.type === "rich_text") {
    const inlineContent = flattenRichInlineContent(block.content);
    return isSingleInlineReference(inlineContent);
  }
  return false;
}

function isSingleInlineReference(content: ComposedInlineContent[]): boolean {
  return content.length === 1 && content[0]?.type === "reference";
}

function firstDirectInlineReferenceId(
  content: ComposedInlineContent[],
): string | null {
  for (const item of content) {
    if (item.type === "reference" && item.rangeCell === undefined) {
      return item.referenceId;
    }
  }
  return null;
}

function firstDirectReferenceInRichContent(
  content: TableEditorRichTextBlock["content"],
): string | null {
  return firstDirectInlineReferenceId(flattenRichInlineContent(content));
}

function flattenRichInlineContent(
  content: TableEditorRichTextBlock["content"],
): ComposedInlineContent[] {
  return content.content.flatMap((node) => {
    if (node.type === "paragraph" || node.type === "heading") {
      return node.content;
    }
    return node.items.flatMap(flattenRichListItemInlineContent);
  });
}

function flattenRichListItemInlineContent(
  item: ComposedRichListItem,
): ComposedInlineContent[] {
  return item.content.flatMap((child) =>
    child.type === "paragraph"
      ? child.content
      : child.items.flatMap(flattenRichListItemInlineContent),
  );
}

export function getFirstRangeBackedReferenceInTableCell(
  cell: TableEditorCell,
): { referenceId: string; rangeCell: RangeCellOffset } | null {
  for (const block of getTableCellPrimitiveBlocks(cell)) {
    const reference = firstRangeBackedReferenceInBlock(block);
    if (reference) {
      return reference;
    }
  }
  return null;
}

function firstRangeBackedReferenceInBlock(
  block: TableEditorPrimitiveBlock,
): { referenceId: string; rangeCell: RangeCellOffset } | null {
  if (block.type === "text") {
    return firstRangeBackedReferenceInInlineContent(block.content);
  }
  if (block.type === "rich_text") {
    return firstRangeBackedReferenceInRichContent(block.content);
  }
  return null;
}

function firstRangeBackedReferenceInInlineContent(
  content: ComposedInlineContent[],
): { referenceId: string; rangeCell: RangeCellOffset } | null {
  for (const item of content) {
    if (item.type === "reference" && item.rangeCell !== undefined) {
      return { rangeCell: item.rangeCell, referenceId: item.referenceId };
    }
  }
  return null;
}

function firstRangeBackedReferenceInRichContent(
  content: TableEditorRichTextBlock["content"],
): { referenceId: string; rangeCell: RangeCellOffset } | null {
  for (const node of content.content) {
    if (node.type === "paragraph" || node.type === "heading") {
      const reference = firstRangeBackedReferenceInInlineContent(node.content);
      if (reference) {
        return reference;
      }
      continue;
    }
    for (const item of node.items) {
      const reference = firstRangeBackedReferenceInRichListItem(item);
      if (reference) {
        return reference;
      }
    }
  }
  return null;
}

function firstRangeBackedReferenceInRichListItem(
  item: ComposedRichListItem,
): { referenceId: string; rangeCell: RangeCellOffset } | null {
  for (const child of item.content) {
    if (child.type === "paragraph") {
      const reference = firstRangeBackedReferenceInInlineContent(child.content);
      if (reference) {
        return reference;
      }
      continue;
    }
    for (const nested of child.items) {
      const reference = firstRangeBackedReferenceInRichListItem(nested);
      if (reference) {
        return reference;
      }
    }
  }
  return null;
}

function blockHasRangeBackedReference(
  block: TableEditorPrimitiveBlock,
): boolean {
  if (block.type === "text") {
    return inlineContentHasRangeBackedReference(block.content);
  }
  if (block.type === "rich_text") {
    return richContentHasRangeBackedReference(block.content);
  }
  return false;
}

function inlineContentHasRangeBackedReference(
  content: ComposedInlineContent[],
): boolean {
  return content.some(
    (item) => item.type === "reference" && item.rangeCell !== undefined,
  );
}

function richContentHasRangeBackedReference(
  content: TableEditorRichTextBlock["content"],
): boolean {
  return content.content.some((node) => {
    if (node.type === "paragraph" || node.type === "heading") {
      return inlineContentHasRangeBackedReference(node.content);
    }
    return node.items.some((item) => richListItemHasRangeBackedReference(item));
  });
}

function richListItemHasRangeBackedReference(
  item: ComposedRichListItem,
): boolean {
  return item.content.some((child) => {
    if (child.type === "paragraph") {
      return inlineContentHasRangeBackedReference(child.content);
    }
    return child.items.some((nested) =>
      richListItemHasRangeBackedReference(nested),
    );
  });
}

function modelForDuplicate(
  responseFields: TableResponseField[],
): TableEditorModel {
  return {
    cells: [],
    columns: [],
    prompt: "",
    responseFields,
    rows: [],
    showColumnNames: true,
    showRowNames: true,
  };
}

function createNextTableAnswerField(
  model: TableEditorModel,
  input?: {
    label?: string;
    type?: TableResponseField["type"];
  },
): TableResponseField {
  const id = nextAvailableId("answer", getUsedTableAnswerFieldIds(model));

  return createTableAnswerField(id, model.responseFields.length, input);
}

function createTableAnswerField(
  id: string,
  existingFieldCount: number,
  input?: {
    label?: string;
    type?: TableResponseField["type"];
  },
): TableResponseField {
  return {
    id,
    label: input?.label ?? tableAnswerLabel(existingFieldCount),
    type: input?.type ?? DEFAULT_TABLE_ANSWER_FIELD_TYPE,
  };
}

function getUsedTableAnswerFieldIds(model: TableEditorModel): Set<string> {
  const ids = new Set(model.responseFields.map((field) => field.id));
  for (const cell of model.cells) {
    for (const block of getTableCellPrimitiveBlocks(cell)) {
      if (block.type === "input") {
        ids.add(block.responseFieldId);
      }
    }
  }
  return ids;
}

function nextTableAnswerLabel(model: TableEditorModel) {
  return tableAnswerLabel(model.responseFields.length);
}

function tableAnswerLabel(existingFieldCount: number) {
  const nextIndex = existingFieldCount + 1;
  return nextIndex === 1 ? "Answer" : `Answer ${nextIndex}`;
}
