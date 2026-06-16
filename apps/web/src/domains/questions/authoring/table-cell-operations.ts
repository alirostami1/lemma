import {
  nextAvailableId,
  type TableEditorCell,
  type TableEditorContentCell,
  type TableEditorModel,
  type TableEditorResponseCell,
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
    return { model, cell: existing };
  }

  const cell: TableEditorContentCell = {
    id: nextAvailableId(
      "cell",
      model.cells.map((item) => item.id),
    ),
    rowId,
    columnId,
    type: "content",
    content: [],
  };

  return {
    model: {
      ...model,
      cells: [...model.cells, cell],
    },
    cell,
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
    id: cell.id,
    rowId: cell.rowId,
    columnId: cell.columnId,
    type: "content",
    content: cell.type === "content" ? [...cell.content] : [],
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

  if (cell.type === "response") {
    return ensureResponseFieldForCell(model, cell.id);
  }

  const { cell: responseCell, responseField } = createAnswerCellForPosition({
    model,
    cellId: cell.id,
    rowId: cell.rowId,
    columnId: cell.columnId,
    previousCell: cell,
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
  if (!cell || cell.type !== "response") {
    return model;
  }

  if (model.responseFields.some((field) => field.id === cell.responseFieldId)) {
    return model;
  }

  return repairMissingAnswerFieldForCell(model, cell.id);
}

export function repairMissingAnswerFieldForCell(
  model: TableEditorModel,
  cellId: string,
): TableEditorModel {
  const cell = getTableCell(model, cellId);
  if (!cell || cell.type !== "response") {
    return model;
  }

  if (model.responseFields.some((field) => field.id === cell.responseFieldId)) {
    return model;
  }

  const responseField: TableResponseField = {
    id: cell.responseFieldId,
    type: DEFAULT_TABLE_ANSWER_FIELD_TYPE,
    label: cell.label ?? nextTableAnswerLabel(model),
    required: true,
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
  if (!cell || cell.type !== "response") {
    return model;
  }

  return {
    ...model,
    responseFields: model.responseFields.map((field) =>
      field.id === cell.responseFieldId ? update(field) : field,
    ),
  };
}

export function updateContentCellContent(
  model: TableEditorModel,
  cellId: string,
  content: TableEditorContentCell["content"],
): TableEditorModel {
  return updateTableCell(model, cellId, (cell) =>
    cell.type === "content" ? { ...cell, content } : cell,
  );
}

export function updateResponseCellCorrectValueSource(
  model: TableEditorModel,
  cellId: string,
  correctValueSource: ValueExpression,
): TableEditorModel {
  return updateTableCell(model, cellId, (cell) =>
    cell.type === "response" ? { ...cell, correctValueSource } : cell,
  );
}

export function pruneUnusedResponseFields(
  model: TableEditorModel,
): TableEditorModel {
  const usedResponseFieldIds = new Set(
    model.cells
      .filter(
        (cell): cell is TableEditorResponseCell => cell.type === "response",
      )
      .map((cell) => cell.responseFieldId),
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
  responseFields,
}: {
  cell: TableEditorCell;
  rowId?: string;
  columnId?: string;
  usedCellIds: Set<string>;
  responseFields: TableResponseField[];
}): TableEditorCell {
  const nextCellId = nextAvailableId("cell", usedCellIds);
  usedCellIds.add(nextCellId);

  if (cell.type === "content") {
    return {
      ...cell,
      id: nextCellId,
      rowId,
      columnId,
      content: [...cell.content],
    };
  }

  const responseField = createNextTableAnswerField(
    modelForDuplicate(responseFields),
    {
      label: cell.label,
      type:
        cell.type === "response"
          ? responseFields.find((field) => field.id === cell.responseFieldId)
              ?.type
          : undefined,
      required: responseFields.find((field) => field.id === cell.responseFieldId)
        ?.required,
    },
  );
  responseFields.push(responseField);

  return {
    ...cell,
    id: nextCellId,
    rowId,
    columnId,
    responseFieldId: responseField.id,
    label: cell.label ?? responseField.label,
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
  cell: TableEditorResponseCell;
  responseField: TableResponseField;
} {
  const responseField = createNextTableAnswerField(model, {
    label: previousCell?.type === "response" ? previousCell.label : undefined,
  });

  return {
    responseField,
    cell: {
      id: cellId,
      rowId,
      columnId,
      type: "response",
      responseFieldId: responseField.id,
      correctValueSource: { type: "literal", value: "" },
      points: 1,
      grading: { mode: "exact" },
      label: responseField.label,
    },
  };
}

function modelForDuplicate(responseFields: TableResponseField[]): TableEditorModel {
  return {
    prompt: "",
    columns: [],
    rows: [],
    showColumnNames: true,
    showRowNames: true,
    responseFields,
    cells: [],
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
    type: input?.type ?? DEFAULT_TABLE_ANSWER_FIELD_TYPE,
    label: input?.label ?? nextTableAnswerLabel(model),
    required: input?.required ?? true,
  };
}

function getUsedTableAnswerFieldIds(model: TableEditorModel): Set<string> {
  const ids = new Set(model.responseFields.map((field) => field.id));
  for (const cell of model.cells) {
    if (cell.type === "response") {
      ids.add(cell.responseFieldId);
    }
  }
  return ids;
}

function nextTableAnswerLabel(model: TableEditorModel) {
  const nextIndex = model.responseFields.length + 1;
  return nextIndex === 1 ? "Answer" : `Answer ${nextIndex}`;
}
