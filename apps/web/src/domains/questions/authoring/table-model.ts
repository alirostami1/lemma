import type { ComposedRenderedInlineContent } from "./composed-model";
import type { ComposedInlineContent } from "./inline-content";
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

export type TableResponseField = {
  id: string;
  type: "text" | "number" | "boolean";
  label?: string;
  required?: boolean;
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
        required: true,
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
    for (const block of cell.blocks) {
      if (block.type !== "input") {
        continue;
      }
      if (!responseFieldIds.has(block.responseFieldId)) {
        throw new Error(
          `Input block ${block.id} in cell ${cell.id} references missing response field ${block.responseFieldId}.`,
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
  return {
    cells: model.cells.map((cell) => ({
      ...cell,
      blocks: cell.blocks.map(tableEditorPrimitiveToPreviewPrimitive),
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
): TableBlockPreviewPrimitiveBlock {
  if (block.type === "input") {
    return {
      id: block.id,
      label: block.label,
      placeholder: block.placeholder,
      responseFieldId: block.responseFieldId,
      type: "input",
    };
  }
  return block;
}
