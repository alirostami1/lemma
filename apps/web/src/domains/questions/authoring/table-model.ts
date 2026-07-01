import type { ComposedRenderedInlineContent } from "./composed-model";
import type { ComposedInlineContent } from "./inline-content";
import {
  createDefaultRequiredInputPrimitiveForNewAnswer,
  type InputPrimitive,
  type InputPrimitivePreviewState,
  type InputPrimitiveType,
  inputPrimitivePreviewStateFromEditorInput,
} from "./input-primitive";
import type { ComposedRichContent } from "./rich-content-types";

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
      sourceId: string;
      ref: string;
    }
  | {
      type: "workbook_range";
      sourceId: string;
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

export type InputCorrectValueContract = {
  grading: TableGrading;
  correctValueSource?: ValueExpression;
};

export function requiresCorrectValueSource(grading: TableGrading): boolean {
  return grading.mode !== "manual";
}

export function createDefaultCorrectValueSource(): ValueExpression {
  return { type: "literal", value: "" };
}

export function applyInputGrading<T extends InputCorrectValueContract>(
  block: T,
  grading: TableGrading,
): T {
  const next: T = { ...block, grading };
  if (!requiresCorrectValueSource(grading)) {
    delete next.correctValueSource;
    return next;
  }

  next.correctValueSource =
    block.correctValueSource ?? createDefaultCorrectValueSource();
  return next;
}

export type TableAxis = {
  id: string;
  label: string;
};

export type TableCellFormatting = {
  textAlign?: "left" | "center" | "right";
  emphasis?: "normal" | "strong";
  tone?: "default" | "muted" | "highlight";
};

export type TableResponseField = {
  id: string;
  type: InputPrimitiveType;
  label?: string;
};

export type TableEditorTextBlock = {
  id: string;
  type: "text";
  content: ComposedInlineContent[];
};

export type TableEditorRichTextBlock = {
  id: string;
  type: "rich_text";
  content: ComposedRichContent;
};

export type TableEditorSeparatorBlock = {
  id: string;
  type: "separator";
};

export type TableEditorInputBlock = {
  id: string;
  type: "input";
  responseFieldId: string;
  input?: InputPrimitive;
  label?: string;
  placeholder?: string;
  correctValueSource?: ValueExpression;
  points: number;
  grading: TableGrading;
};

export type TableEditorPrimitiveBlock =
  | TableEditorTextBlock
  | TableEditorRichTextBlock
  | TableEditorSeparatorBlock
  | TableEditorInputBlock;

export type TableEditorCell = {
  id: string;
  rowId: string;
  columnId: string;
  blocks: TableEditorPrimitiveBlock[];
  formatting?: TableCellFormatting;
};

export type TableEditorModel = {
  blockId?: string;
  prompt: string;
  columns: TableAxis[];
  rows: TableAxis[];
  showColumnNames: boolean;
  showRowNames: boolean;
  responseFields: TableResponseField[];
  cells: TableEditorCell[];
};

export type TableBlockPreviewTextBlock = {
  id: string;
  type: "text";
  content: Array<ComposedInlineContent | ComposedRenderedInlineContent>;
};

export type TableBlockPreviewRichTextBlock = TableEditorRichTextBlock;
export type TableBlockPreviewSeparatorBlock = TableEditorSeparatorBlock;

export type TableBlockPreviewInputBlock = {
  id: string;
  type: "input";
  responseFieldId: string;
  inputState?: InputPrimitivePreviewState;
  label?: string;
  placeholder?: string;
};

export type TableBlockPreviewPrimitiveBlock =
  | TableBlockPreviewTextBlock
  | TableBlockPreviewRichTextBlock
  | TableBlockPreviewSeparatorBlock
  | TableBlockPreviewInputBlock;

export type TableBlockPreviewCell = {
  id: string;
  rowId: string;
  columnId: string;
  blocks: TableBlockPreviewPrimitiveBlock[];
  formatting?: TableCellFormatting;
};

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

export function createDefaultTableEditorModel(
  tableBlockId = "table_1",
): TableEditorModel {
  return {
    blockId: tableBlockId,
    cells: [
      {
        blocks: [
          {
            content: [{ text: "1", type: "text" }],
            id: `${tableBlockId}_cell_1_text`,
            type: "text",
          },
        ],
        columnId: "column_1",
        id: "cell_1",
        rowId: "row_1",
      },
      {
        blocks: [
          {
            correctValueSource: { type: "literal", value: 3 },
            grading: { mode: "exact" },
            id: `${tableBlockId}_cell_2_input`,
            input: createDefaultRequiredInputPrimitiveForNewAnswer("number"),
            points: 1,
            responseFieldId: "answer_1",
            type: "input",
          },
        ],
        columnId: "column_2",
        id: "cell_2",
        rowId: "row_1",
      },
      {
        blocks: [
          {
            content: [{ text: "2", type: "text" }],
            id: `${tableBlockId}_cell_3_text`,
            type: "text",
          },
        ],
        columnId: "column_1",
        id: "cell_3",
        rowId: "row_2",
      },
      {
        blocks: [
          {
            content: [{ text: "4", type: "text" }],
            id: `${tableBlockId}_cell_4_text`,
            type: "text",
          },
        ],
        columnId: "column_2",
        id: "cell_4",
        rowId: "row_2",
      },
    ],
    columns: [
      { id: "column_1", label: "Column 1" },
      { id: "column_2", label: "Column 2" },
    ],
    prompt: "Solve this question",
    responseFields: [
      {
        id: "answer_1",
        label: "Answer",
        type: "number",
      },
    ],
    rows: [
      { id: "row_1", label: "Row 1" },
      { id: "row_2", label: "Row 2" },
    ],
    showColumnNames: true,
    showRowNames: true,
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

export function validateTableEditorModel(model: TableEditorModel): void {
  validateTableGrid(model);
  validateTableEditorModelAnswers(model);
}

function validateTableGrid(model: TableEditorModel): void {
  const rowIds = validateTableAxes("Row", model.rows);
  const columnIds = validateTableAxes("Column", model.columns);
  const cellIds = new Set<string>();
  const primitiveBlockIds = new Set<string>();
  const coordinateKeys = new Set<string>();

  for (const cell of model.cells) {
    if (!cell.id) {
      throw new Error("Table cell id must not be empty.");
    }
    if (cellIds.has(cell.id)) {
      throw new Error(`Table cell id ${cell.id} is duplicated.`);
    }
    cellIds.add(cell.id);

    if (!cell.rowId) {
      throw new Error(`Table cell ${cell.id} row id must not be empty.`);
    }
    if (!cell.columnId) {
      throw new Error(`Table cell ${cell.id} column id must not be empty.`);
    }
    if (!rowIds.has(cell.rowId)) {
      throw new Error(
        `Table cell ${cell.id} references missing row ${cell.rowId}.`,
      );
    }
    if (!columnIds.has(cell.columnId)) {
      throw new Error(
        `Table cell ${cell.id} references missing column ${cell.columnId}.`,
      );
    }

    const coordinateKey = `${cell.rowId}:${cell.columnId}`;
    if (coordinateKeys.has(coordinateKey)) {
      throw new Error(
        `Table cell coordinate ${cell.rowId}/${cell.columnId} is duplicated.`,
      );
    }
    coordinateKeys.add(coordinateKey);

    validateTableCellFormatting(cell);
    for (const block of cell.blocks) {
      if (!block.id) {
        throw new Error(
          `Primitive block id in table cell ${cell.id} must not be empty.`,
        );
      }
      if (primitiveBlockIds.has(block.id)) {
        throw new Error(`Primitive block id ${block.id} is duplicated.`);
      }
      primitiveBlockIds.add(block.id);
    }
  }
}

function validateTableAxes(
  label: "Row" | "Column",
  axes: TableAxis[],
): Set<string> {
  const ids = new Set<string>();
  for (const axis of axes) {
    if (!axis.id) {
      throw new Error(`${label} id must not be empty.`);
    }
    if (ids.has(axis.id)) {
      throw new Error(`${label} id ${axis.id} is duplicated.`);
    }
    ids.add(axis.id);
  }
  return ids;
}

function validateTableCellFormatting(cell: TableEditorCell): void {
  const formatting = cell.formatting;
  if (formatting === undefined) {
    return;
  }

  if (
    formatting.textAlign !== undefined &&
    formatting.textAlign !== "left" &&
    formatting.textAlign !== "center" &&
    formatting.textAlign !== "right"
  ) {
    throw new Error(`Table cell ${cell.id} has invalid text alignment.`);
  }
  if (
    formatting.emphasis !== undefined &&
    formatting.emphasis !== "normal" &&
    formatting.emphasis !== "strong"
  ) {
    throw new Error(`Table cell ${cell.id} has invalid emphasis.`);
  }
  if (
    formatting.tone !== undefined &&
    formatting.tone !== "default" &&
    formatting.tone !== "muted" &&
    formatting.tone !== "highlight"
  ) {
    throw new Error(`Table cell ${cell.id} has invalid tone.`);
  }
}

export function validateTableEditorModelAnswers(model: TableEditorModel): void {
  const responseFieldIds = new Set<string>();
  const responseFieldsById = new Map<string, TableResponseField>();
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
      field.type !== "select"
    ) {
      throw new Error(`Response field ${field.id} has an invalid type.`);
    }
    responseFieldIds.add(field.id);
    responseFieldsById.set(field.id, field);
  }

  const usedResponseFieldIds = new Set<string>();
  for (const cell of model.cells) {
    for (const block of cell.blocks) {
      if (block.type !== "input") {
        continue;
      }
      if (!responseFieldIds.has(block.responseFieldId)) {
        throw new Error(
          `Input block ${block.id} in cell ${cell.id} references missing response field ${block.responseFieldId}.`,
        );
      }
      const responseField = responseFieldsById.get(block.responseFieldId);
      if (
        responseField &&
        block.input &&
        block.input.type !== responseField.type
      ) {
        throw new Error(
          `Input block ${block.id} type must match response field ${responseField.id}.`,
        );
      }
      if (!Number.isFinite(block.points)) {
        throw new Error(`Input block ${block.id} has invalid points.`);
      }
      if (
        requiresCorrectValueSource(block.grading) &&
        block.correctValueSource === undefined
      ) {
        throw new Error(
          `Input block ${block.id} in cell ${cell.id} is missing correct value source for ${block.grading.mode} grading.`,
        );
      }
      if (block.grading.mode === "number") {
        const { tolerance } = block.grading;
        if (!Number.isFinite(tolerance.value) || tolerance.value < 0) {
          throw new Error(
            `Input block ${block.id} has invalid number tolerance.`,
          );
        }
      }
      usedResponseFieldIds.add(block.responseFieldId);
    }
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
  const responseFieldsById = new Map(
    model.responseFields.map((field) => [field.id, field]),
  );
  return {
    cells: model.cells.map((cell) => ({
      ...cell,
      blocks: cell.blocks.map((block) =>
        tableEditorPrimitiveToPreviewPrimitive(block, responseFieldsById),
      ),
    })),
    columns: [...model.columns],
    prompt: model.prompt,
    responseFields: [...model.responseFields],
    rows: [...model.rows],
    showColumnNames: model.showColumnNames,
    showRowNames: model.showRowNames,
  };
}

export function getPrimaryTableTextBlock(
  cell: TableEditorCell,
): TableEditorTextBlock | null {
  return cell.blocks.find((block) => block.type === "text") ?? null;
}

export function getPrimaryTableInputBlock(
  cell: TableEditorCell,
): TableEditorInputBlock | null {
  return cell.blocks.find((block) => block.type === "input") ?? null;
}

export function getTableCellEditingKind(
  cell: TableEditorCell,
): "content" | "response" {
  return getPrimaryTableInputBlock(cell) ? "response" : "content";
}

export function getTableCellPrimitiveBlocks(
  cell: TableEditorCell,
): TableEditorPrimitiveBlock[] {
  return cell.blocks;
}

export function getTablePreviewCellPrimitiveBlocks(
  cell: TableBlockPreviewCell,
): TableBlockPreviewPrimitiveBlock[] {
  return cell.blocks;
}

function tableEditorPrimitiveToPreviewPrimitive(
  block: TableEditorPrimitiveBlock,
  responseFieldsById: ReadonlyMap<string, TableResponseField>,
): TableBlockPreviewPrimitiveBlock {
  if (block.type === "input") {
    const responseField = responseFieldsById.get(block.responseFieldId);
    return {
      id: block.id,
      inputState: inputPrimitivePreviewStateFromEditorInput(block.input, {
        required: true,
        type: responseField?.type ?? "text",
      }),
      label: block.label,
      placeholder: block.placeholder,
      responseFieldId: block.responseFieldId,
      type: "input",
    };
  }
  return block;
}
