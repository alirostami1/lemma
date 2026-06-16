import type { ComposedInlineContent } from "./inline-content";

export type TableCellValue = string | number | boolean | null;

export type TableAnswerValue =
  | TableCellValue
  | { [key: string]: TableAnswerValue }
  | TableAnswerValue[];

export type ValueExpression =
  | {
      type: "literal";
      value: TableAnswerValue;
    }
  | {
      type: "reference";
      referenceId: string;
    };

export type ReferenceSourceDraft =
  | {
      type: "literal";
      value: TableAnswerValue;
    }
  | {
      type: "workbook_cell";
      ref: string;
    }
  | {
      type: "workbook_range";
      ref: string;
    };

export type TableGrading =
  | { mode: "exact" }
  | {
      mode: "number";
      tolerance: {
        type: "absolute" | "relative";
        value: number;
      };
    }
  | { mode: "case_insensitive_text" }
  | { mode: "manual" };

export type TableAxis = {
  id: string;
  label: string;
};

export type TableResponseField = {
  id: string;
  type: "text" | "number" | "boolean";
  label?: string;
  required?: boolean;
};

export type TableEditorContentCell = {
  id: string;
  rowId: string;
  columnId: string;
  type: "content";
  content: ComposedInlineContent[];
};

export type TableEditorResponseCell = {
  id: string;
  rowId: string;
  columnId: string;
  type: "response";
  responseFieldId: string;
  label?: string;
  placeholder?: string;
  correctValueSource: ValueExpression;
  points: number;
  grading: TableGrading;
};

export type TableEditorCell = TableEditorContentCell | TableEditorResponseCell;

export type TableEditorModel = {
  prompt: string;
  columns: TableAxis[];
  rows: TableAxis[];
  showColumnNames: boolean;
  showRowNames: boolean;
  responseFields: TableResponseField[];
  cells: TableEditorCell[];
};

export type TableBlockPreviewContentCell = {
  id: string;
  rowId: string;
  columnId: string;
  type: "content";
  content: ComposedInlineContent[];
};

export type TableBlockPreviewResponseCell = {
  id: string;
  rowId: string;
  columnId: string;
  type: "response";
  responseFieldId: string;
};

export type TableBlockPreviewCell =
  | TableBlockPreviewContentCell
  | TableBlockPreviewResponseCell;

export type TableBlockPreviewModel = {
  prompt: string;
  columns: TableAxis[];
  rows: TableAxis[];
  showColumnNames: boolean;
  showRowNames: boolean;
  responseFields: TableResponseField[];
  cells: TableBlockPreviewCell[];
};

export type TableAnswerState = Record<string, TableAnswerValue>;

export type TableWorkbookEditorTools = {
  hasWorkbookFile: boolean;
};

export type TableBlockEditorProps = {
  model: TableEditorModel;
  onModelChange(model: TableEditorModel): void;
  workbookTools?: TableWorkbookEditorTools;
  disabled?: boolean;
};

export type TableBlockPreviewProps = {
  model: TableBlockPreviewModel;
  answer: TableAnswerState;
  onAnswerChange(answer: TableAnswerState): void;
  disabled?: boolean;
  showPrompt?: boolean;
};

export function createDefaultTableEditorModel(): TableEditorModel {
  return {
    prompt: "Solve this question",
    columns: [
      { id: "column_1", label: "Column 1" },
      { id: "column_2", label: "Column 2" },
    ],
    rows: [
      { id: "row_1", label: "Row 1" },
      { id: "row_2", label: "Row 2" },
    ],
    showColumnNames: true,
    showRowNames: true,
    responseFields: [
      {
        id: "answer_1",
        type: "number",
        label: "Answer",
        required: true,
      },
    ],
    cells: [
      {
        id: "cell_1",
        rowId: "row_1",
        columnId: "column_1",
        type: "content",
        content: [{ type: "text", text: "1" }],
      },
      {
        id: "cell_2",
        rowId: "row_1",
        columnId: "column_2",
        type: "response",
        responseFieldId: "answer_1",
        correctValueSource: { type: "literal", value: 3 },
        points: 1,
        grading: { mode: "exact" },
      },
      {
        id: "cell_3",
        rowId: "row_2",
        columnId: "column_1",
        type: "content",
        content: [{ type: "text", text: "2" }],
      },
      {
        id: "cell_4",
        rowId: "row_2",
        columnId: "column_2",
        type: "content",
        content: [{ type: "text", text: "4" }],
      },
    ],
  };
}

export function moveTableRow(
  model: TableEditorModel,
  rowId: string,
  direction: "up" | "down",
): TableEditorModel {
  const index = model.rows.findIndex((row) => row.id === rowId);
  if (index < 0) {
    return model;
  }
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= model.rows.length) {
    return model;
  }
  const rows = [...model.rows];
  const [row] = rows.splice(index, 1);
  rows.splice(targetIndex, 0, row);
  return reorderTableRows(model, rows);
}

export function moveTableColumn(
  model: TableEditorModel,
  columnId: string,
  direction: "left" | "right",
): TableEditorModel {
  const index = model.columns.findIndex((column) => column.id === columnId);
  if (index < 0) {
    return model;
  }
  const targetIndex = direction === "left" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= model.columns.length) {
    return model;
  }
  const columns = [...model.columns];
  const [column] = columns.splice(index, 1);
  columns.splice(targetIndex, 0, column);
  return reorderTableColumns(model, columns);
}

export function reorderTableRows(
  model: TableEditorModel,
  rows: TableEditorModel["rows"],
): TableEditorModel {
  return {
    ...model,
    rows: [...rows],
  };
}

export function reorderTableColumns(
  model: TableEditorModel,
  columns: TableEditorModel["columns"],
): TableEditorModel {
  return {
    ...model,
    columns: [...columns],
  };
}

export function nextAvailableId(prefix: string, existingIds: Iterable<string>) {
  const ids = new Set(existingIds);
  for (let index = 1; ; index += 1) {
    const id = `${prefix}_${index}`;
    if (!ids.has(id)) {
      return id;
    }
  }
}

export function validateTableEditorModelAnswers(model: TableEditorModel): void {
  const responseFieldIds = new Set<string>();
  for (const field of model.responseFields) {
    if (!field.id) {
      throw new Error("Response field id must not be empty.");
    }
    if (responseFieldIds.has(field.id)) {
      throw new Error(`Response field id ${field.id} is duplicated.`);
    }
    if (
      field.type !== "text" &&
      field.type !== "number" &&
      field.type !== "boolean"
    ) {
      throw new Error(`Response field ${field.id} has an invalid type.`);
    }
    responseFieldIds.add(field.id);
  }

  const usedResponseFieldIds = new Set<string>();
  for (const cell of model.cells) {
    if (cell.type !== "response") {
      continue;
    }
    if (!responseFieldIds.has(cell.responseFieldId)) {
      throw new Error(
        `Response cell ${cell.id} references missing response field ${cell.responseFieldId}.`,
      );
    }
    if (!Number.isFinite(cell.points)) {
      throw new Error(`Response cell ${cell.id} has invalid points.`);
    }
    if (cell.grading.mode === "number") {
      const { tolerance } = cell.grading;
      if (!Number.isFinite(tolerance.value) || tolerance.value < 0) {
        throw new Error(
          `Response cell ${cell.id} has invalid number tolerance.`,
        );
      }
    }
    usedResponseFieldIds.add(cell.responseFieldId);
  }

  for (const field of model.responseFields) {
    if (!usedResponseFieldIds.has(field.id)) {
      throw new Error(`Response field ${field.id} is not used by any cell.`);
    }
  }
}

export function tableEditorModelToStaticPreviewModel(
  model: TableEditorModel,
): TableBlockPreviewModel {
  return {
    prompt: model.prompt,
    columns: [...model.columns],
    rows: [...model.rows],
    showColumnNames: model.showColumnNames,
    showRowNames: model.showRowNames,
    responseFields: [...model.responseFields],
    cells: model.cells.map((cell) =>
      cell.type === "content"
        ? {
            id: cell.id,
            rowId: cell.rowId,
            columnId: cell.columnId,
            type: "content" as const,
            content: [...cell.content],
          }
        : {
            id: cell.id,
            rowId: cell.rowId,
            columnId: cell.columnId,
            type: "response" as const,
            responseFieldId: cell.responseFieldId,
          },
    ),
  };
}
