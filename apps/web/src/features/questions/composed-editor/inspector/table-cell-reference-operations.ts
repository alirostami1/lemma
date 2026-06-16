import type {
  ComposedReferenceDraft,
  ComposedEditorModel,
  ComposedInlineContent,
  TableEditorCell,
  ValueExpression,
} from "#/domains/questions/authoring";
import { formatAnswerInputValue } from "#/domains/questions/authoring";

export function updateTableCellValueInComposedModel(input: {
  editorModel: ComposedEditorModel;
  tableBlockId: string;
  cellId: string;
  value: ValueExpression;
}): ComposedEditorModel {
  let updated = false;

  const nextModel = {
    ...input.editorModel,
    blocks: input.editorModel.blocks.map((block) => {
      if (block.id !== input.tableBlockId || block.type !== "table") {
        return block;
      }

      updated = true;

      return {
        ...block,
        table: {
          ...block.table,
          cells: block.table.cells.map((cell) =>
            updateTableCellValueExpression(cell, input.cellId, input.value),
          ),
        },
      };
    }),
  };

  return updated ? nextModel : input.editorModel;
}

function updateTableCellValueExpression(
  cell: TableEditorCell,
  cellId: string,
  value: ValueExpression,
): TableEditorCell {
  if (cell.id !== cellId) {
    return cell;
  }

  if (cell.type === "content") {
    return {
      ...cell,
      content:
        value.type === "reference"
          ? [{ type: "reference", referenceId: value.referenceId }]
          : [{ type: "text", text: formatAnswerInputValue(value.value) }],
    };
  }

  return {
    ...cell,
    correctValueSource: value,
  };
}

export function addReferenceAndUpdateTableCellValue(input: {
  editorModel: ComposedEditorModel;
  tableBlockId: string;
  cellId: string;
  reference: ComposedReferenceDraft;
}): ComposedEditorModel {
  return updateTableCellValueInComposedModel({
    editorModel: {
      ...input.editorModel,
      references: [...input.editorModel.references, input.reference],
    },
    tableBlockId: input.tableBlockId,
    cellId: input.cellId,
    value: {
      type: "reference",
      referenceId: input.reference.id,
    },
  });
}

export function updateTableContentCellInlineContentInComposedModel(input: {
  editorModel: ComposedEditorModel;
  tableBlockId: string;
  cellId: string;
  content: ComposedInlineContent[];
}): ComposedEditorModel {
  let updated = false;

  const nextModel = {
    ...input.editorModel,
    blocks: input.editorModel.blocks.map((block) => {
      if (block.id !== input.tableBlockId || block.type !== "table") {
        return block;
      }

      return {
        ...block,
        table: {
          ...block.table,
          cells: block.table.cells.map((cell) => {
            if (cell.id !== input.cellId || cell.type !== "content") {
              return cell;
            }

            updated = true;

            return {
              ...cell,
              content: input.content,
            };
          }),
        },
      };
    }),
  };

  return updated ? nextModel : input.editorModel;
}
