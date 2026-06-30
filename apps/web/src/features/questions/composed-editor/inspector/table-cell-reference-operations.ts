import type {
  ComposedEditorModel,
  ComposedInlineContent,
  ComposedReferenceDraft,
  TableEditorCell,
  ValueExpression,
} from "#/domains/questions/authoring";
import {
  formatAnswerInputValue,
  getPrimaryTableInputBlock,
  getPrimaryTableTextBlock,
  getTableCellPrimitiveBlocks,
  updateComposedBlock,
} from "#/domains/questions/authoring";

export function updateTableCellValueInComposedModel(input: {
  editorModel: ComposedEditorModel;
  tableBlockId: string;
  cellId: string;
  cellBlockId?: string;
  value: ValueExpression;
}): ComposedEditorModel {
  return updateComposedBlock(input.editorModel, input.tableBlockId, (block) =>
    block.type === "table"
      ? {
          ...block,
          table: {
            ...block.table,
            cells: block.table.cells.map((cell) =>
              updateTableCellValueExpression(cell, {
                cellBlockId: input.cellBlockId,
                cellId: input.cellId,
                value: input.value,
              }),
            ),
          },
        }
      : block,
  );
}

function updateTableCellValueExpression(
  cell: TableEditorCell,
  input: {
    cellId: string;
    cellBlockId?: string;
    value: ValueExpression;
  },
): TableEditorCell {
  if (cell.id !== input.cellId) {
    return cell;
  }

  if (input.cellBlockId) {
    return updateCellBlockValueExpression(cell, input.cellBlockId, input.value);
  }

  const inputBlock = getPrimaryTableInputBlock(cell);
  if (inputBlock) {
    return updateCellBlockValueExpression(cell, inputBlock.id, input.value);
  }

  const textBlock = getPrimaryTableTextBlock(cell);
  return textBlock
    ? updateCellBlockValueExpression(cell, textBlock.id, input.value)
    : cell;
}

function updateCellBlockValueExpression(
  cell: TableEditorCell,
  cellBlockId: string,
  value: ValueExpression,
): TableEditorCell {
  return {
    ...cell,
    blocks: getTableCellPrimitiveBlocks(cell).map((block) => {
      if (block.id !== cellBlockId) {
        return block;
      }

      if (block.type === "input") {
        return { ...block, correctValueSource: value };
      }

      if (block.type === "text") {
        return {
          ...block,
          content:
            value.type === "reference"
              ? [{ referenceId: value.referenceId, type: "reference" }]
              : [
                  {
                    text: formatAnswerInputValue(value.value),
                    type: "text",
                  },
                ],
        };
      }

      return block;
    }),
  };
}

export function addReferenceAndUpdateTableCellValue(input: {
  editorModel: ComposedEditorModel;
  tableBlockId: string;
  cellId: string;
  cellBlockId?: string;
  reference: ComposedReferenceDraft;
}): ComposedEditorModel {
  return updateTableCellValueInComposedModel({
    cellBlockId: input.cellBlockId,
    cellId: input.cellId,
    editorModel: {
      ...input.editorModel,
      references: [...input.editorModel.references, input.reference],
    },
    tableBlockId: input.tableBlockId,
    value: {
      referenceId: input.reference.id,
      type: "reference",
    },
  });
}

export function updateTableContentCellInlineContentInComposedModel(input: {
  editorModel: ComposedEditorModel;
  tableBlockId: string;
  cellId: string;
  cellBlockId?: string;
  content: ComposedInlineContent[];
}): ComposedEditorModel {
  return updateComposedBlock(input.editorModel, input.tableBlockId, (block) =>
    block.type === "table"
      ? {
          ...block,
          table: {
            ...block.table,
            cells: block.table.cells.map((cell) => {
              if (cell.id !== input.cellId) {
                return cell;
              }

              const targetTextBlockId =
                input.cellBlockId ?? getPrimaryTableTextBlock(cell)?.id;
              if (!targetTextBlockId) {
                return cell;
              }

              return {
                ...cell,
                blocks: getTableCellPrimitiveBlocks(cell).map((block) =>
                  block.id === targetTextBlockId && block.type === "text"
                    ? { ...block, content: input.content }
                    : block,
                ),
              };
            }),
          },
        }
      : block,
  );
}
