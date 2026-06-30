import {
  getPrimaryTableInputBlock,
  getPrimaryTableTextBlock,
  getTableCellPrimitiveBlocks,
  nextAvailableId,
  type TableEditorCell,
  type TableEditorInputBlock,
  type TableEditorModel,
  type TableEditorPrimitiveBlock,
  type TableEditorTextBlock,
  type TableResponseField,
  type ValueExpression,
} from "./table-model";

const DEFAULT_TABLE_ANSWER_FIELD_TYPE: TableResponseField["type"] = "number";

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
    blocks: [
      {
        content: getPrimaryTableTextBlock(cell)?.content ?? [],
        id: nextAvailableId(
          `${model.blockId ?? "table"}_${cell.id}_text`,
          model.cells.flatMap((item) => item.blocks.map((block) => block.id)),
        ),
        type: "text",
      },
    ],
    columnId: cell.columnId,
    id: cell.id,
    rowId: cell.rowId,
  }));
}

export function makeResponseCell(
  model: TableEditorModel,
  cellId: string,
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
    required: true,
    type: DEFAULT_TABLE_ANSWER_FIELD_TYPE,
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
    id: nextCellId,
    rowId,
  };
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
      required: sourceField.required,
      type: sourceField.type,
    },
  );
  responseFields.push(responseField);

  return {
    ...block,
    id,
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
}: {
  model: TableEditorModel;
  cellId: string;
  rowId: string;
  columnId: string;
  previousCell?: TableEditorCell;
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

  return {
    cell: {
      blocks: [
        {
          correctValueSource: { type: "literal", value: "" },
          grading: { mode: "exact" },
          id: nextAvailableId(
            `${model.blockId ?? "table"}_${cellId}_input`,
            model.cells.flatMap((cell) => cell.blocks.map((block) => block.id)),
          ),
          label: responseField.label,
          points: 1,
          responseFieldId: responseField.id,
          type: "input",
        },
      ],
      columnId,
      id: cellId,
      rowId,
    },
    responseField,
  };
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
    required?: boolean;
  },
): TableResponseField {
  const id = nextAvailableId("answer", getUsedTableAnswerFieldIds(model));

  return {
    id,
    label: input?.label ?? nextTableAnswerLabel(model),
    required: input?.required ?? true,
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
  const nextIndex = model.responseFields.length + 1;
  return nextIndex === 1 ? "Answer" : `Answer ${nextIndex}`;
}
