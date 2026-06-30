import type {
  QuestionBlueprintDocument,
  QuestionBlueprintPrimitiveBlock,
  QuestionBlueprintTableBlock,
  QuestionResponseField,
  QuestionTableBlock,
} from "#/api/generated/model";
import {
  extractInlineReferenceIds,
  inlineContentToPlainText,
  plainTextToInlineContent,
} from "#/domains/questions/authoring/inline-content";
import type {
  TableBlockPreviewCell,
  TableBlockPreviewModel,
  TableBlockPreviewPrimitiveBlock,
  TableBlockPreviewTextBlock,
  TableEditorModel,
  TableEditorPrimitiveBlock,
} from "../table-model";
import {
  getTableCellPrimitiveBlocks,
  validateTableEditorModelAnswers,
} from "../table-model";
import {
  asRecord,
  canonicalRichContentToComposed,
  composedRichContentToCanonicalRichContent,
  fromCanonicalTableAnswerFieldId,
  questionResponseFieldToTable,
  readAxisArray,
  readString,
  toCanonicalTableAnswerFieldId,
  toCanonicalTableCellId,
  toQuestionValueExpression,
  toValueExpression,
} from "./shared";

export function tableEditorModelToQuestionBlueprintDocument(
  model: TableEditorModel,
): QuestionBlueprintDocument {
  validateTableEditorModelAnswers(model);
  assertStandaloneTableHasOnlyLiteralValues(model);

  return {
    blocks: [
      {
        content: plainTextToInlineContent(model.prompt),
        id: "prompt",
        kind: "primitive",
        type: "text",
      },
      tableEditorModelToQuestionBlueprintTableBlock(model, "table"),
    ],
    references: [],
    responseFields: tableEditorModelToResponseFields(model),
    schemaVersion: 2,
  };
}

export function questionBlueprintDocumentToTableEditorModel(
  blueprint: QuestionBlueprintDocument,
): TableEditorModel {
  const promptBlock = blueprint.blocks.find((block) => block.type === "text");
  const tableBlock = blueprint.blocks.find((block) => block.type === "table");
  if (!tableBlock) {
    throw new Error(
      "Unsupported question blueprint document for table editor.",
    );
  }

  return {
    ...questionBlueprintTableBlockToTableEditorModel(
      tableBlock,
      blueprint.responseFields,
    ),
    prompt: promptBlock ? inlineContentToPlainText(promptBlock.content) : "",
  };
}

export function tableEditorModelToQuestionBlueprintTableBlock(
  model: TableEditorModel,
  blockId: string,
  options?: { responseFieldIdPrefix?: string },
): QuestionBlueprintTableBlock {
  return {
    cells: model.cells.map((cell) => ({
      blocks: getTableCellPrimitiveBlocks(cell).map((cellBlock) =>
        tableEditorPrimitiveBlockToQuestionBlueprintPrimitiveBlock(
          cellBlock,
          blockId,
          Boolean(options?.responseFieldIdPrefix),
        ),
      ),
      columnId: cell.columnId,
      id: toCanonicalTableCellId(cell.id),
      rowId: cell.rowId,
    })),
    columns: model.columns,
    id: blockId,
    kind: "complex",
    rows: model.rows,
    showColumnNames: model.showColumnNames,
    showRowNames: model.showRowNames,
    type: "table",
  };
}

function assertStandaloneTableHasOnlyLiteralValues(
  model: TableEditorModel,
): void {
  for (const cell of model.cells) {
    for (const block of getTableCellPrimitiveBlocks(cell)) {
      if (
        block.type === "text" &&
        extractInlineReferenceIds(block.content).length > 0
      ) {
        throw new Error(
          `Standalone table text block ${block.id} references a reference, but standalone table conversion does not support references.`,
        );
      }

      if (
        block.type === "input" &&
        block.correctValueSource?.type === "reference"
      ) {
        throw new Error(
          `Standalone table input block ${block.id} references ${block.correctValueSource.referenceId}, but standalone table conversion does not support references.`,
        );
      }
    }
  }
}

export function tableEditorModelToResponseFields(
  model: TableEditorModel,
  blockId?: string,
): QuestionResponseField[] {
  validateTableEditorModelAnswers(model);
  return model.responseFields.map((field) => ({
    id: blockId ? toCanonicalTableAnswerFieldId(blockId, field.id) : field.id,
    label: field.label,
    required: field.required,
    type: field.type,
  }));
}

export function questionBlueprintTableBlockToTableEditorModel(
  block: QuestionBlueprintTableBlock,
  responseFields: QuestionResponseField[],
  prompt?: string,
): TableEditorModel {
  const prefixedFields = responseFields.filter((field) =>
    field.id.startsWith(`${block.id}_`),
  );
  const sourceFields =
    prefixedFields.length > 0 ? prefixedFields : responseFields;
  const tableResponseFields = sourceFields.map((field) => ({
    ...field,
    id: fromCanonicalTableAnswerFieldId(block.id, field.id),
  }));
  const responseFieldIds = new Set(
    tableResponseFields.map((field) => field.id),
  );
  const tableResponseFieldIds = new Set<string>();

  const cells = block.cells.map((cell) => {
    const blocks = cell.blocks.map((cellBlock) => {
      if (cellBlock.type === "input") {
        if (cellBlock.points === undefined || cellBlock.grading === undefined) {
          throw new Error(
            "Unsupported question blueprint document for composed editor.",
          );
        }
        const responseFieldId = fromCanonicalTableAnswerFieldId(
          block.id,
          cellBlock.responseFieldId,
        );
        if (!responseFieldIds.has(responseFieldId)) {
          throw new Error(
            "Unsupported question blueprint document for composed editor.",
          );
        }
        tableResponseFieldIds.add(responseFieldId);
        return {
          grading: cellBlock.grading,
          id: cellBlock.id,
          points: cellBlock.points,
          responseFieldId,
          type: "input" as const,
          ...(cellBlock.correctValueSource === undefined
            ? {}
            : {
                correctValueSource: toValueExpression(
                  cellBlock.correctValueSource,
                ),
              }),
          ...(cellBlock.label === undefined ? {} : { label: cellBlock.label }),
          ...(cellBlock.placeholder === undefined
            ? {}
            : { placeholder: cellBlock.placeholder }),
        };
      }

      return questionBlueprintPrimitiveBlockToTableEditorPrimitiveBlock(
        cellBlock,
      );
    });
    return {
      blocks,
      columnId: cell.columnId,
      id: cell.id,
      rowId: cell.rowId,
    };
  });

  return {
    blockId: block.id,
    cells,
    columns: block.columns,
    prompt: prompt ?? "",
    responseFields: tableResponseFields
      .filter((field) => tableResponseFieldIds.has(field.id))
      .map(questionResponseFieldToTable),
    rows: block.rows,
    showColumnNames: block.showColumnNames,
    showRowNames: block.showRowNames,
  };
}

export function questionTableBlockToPreviewModel(
  block: QuestionTableBlock,
  responseFields: QuestionResponseField[],
): TableBlockPreviewModel {
  const tableResponseFieldIds = new Set<string>();
  const cells = block.cells.map((cell) => {
    const previewCell = tableQuestionCellToPreviewCell(cell);
    for (const cellBlock of previewCell.blocks ?? []) {
      if (cellBlock.type === "input") {
        tableResponseFieldIds.add(cellBlock.responseFieldId);
      }
    }
    return previewCell;
  });

  return {
    cells,
    columns: readAxisArray(block.columns),
    prompt: "",
    responseFields: responseFields
      .filter((field) => tableResponseFieldIds.has(field.id))
      .map(questionResponseFieldToTable),
    rows: readAxisArray(block.rows),
    showColumnNames: block.showColumnNames !== false,
    showRowNames: block.showRowNames !== false,
  };
}

function tableQuestionCellToPreviewCell(
  cell: QuestionTableBlock["cells"][number],
): TableBlockPreviewCell {
  return {
    blocks: cell.blocks.map((cellBlock) =>
      questionPrimitiveBlockToTablePreviewPrimitiveBlock(cellBlock),
    ),
    columnId: cell.columnId,
    id: cell.id,
    rowId: cell.rowId,
  };
}

function tableEditorPrimitiveBlockToQuestionBlueprintPrimitiveBlock(
  block: TableEditorPrimitiveBlock,
  tableBlockId: string,
  prefixResponseFieldId: boolean,
): QuestionBlueprintPrimitiveBlock {
  if (block.type === "text") {
    return {
      content: block.content,
      id: block.id,
      kind: "primitive",
      type: "text",
    };
  }
  if (block.type === "rich_text") {
    return {
      content: composedRichContentToCanonicalRichContent(block.content),
      id: block.id,
      kind: "primitive",
      type: "rich_text",
    };
  }
  if (block.type === "separator") {
    return { id: block.id, kind: "primitive", type: "separator" };
  }
  return {
    grading: block.grading,
    id: block.id,
    kind: "primitive",
    points: block.points,
    responseFieldId: prefixResponseFieldId
      ? toCanonicalTableAnswerFieldId(tableBlockId, block.responseFieldId)
      : block.responseFieldId,
    type: "input",
    ...(block.correctValueSource === undefined
      ? {}
      : {
          correctValueSource: toQuestionValueExpression(
            block.correctValueSource,
          ),
        }),
    ...(block.label === undefined ? {} : { label: block.label }),
    ...(block.placeholder === undefined
      ? {}
      : { placeholder: block.placeholder }),
  };
}

function questionBlueprintPrimitiveBlockToTableEditorPrimitiveBlock(
  block: QuestionBlueprintPrimitiveBlock,
): TableEditorPrimitiveBlock {
  if (block.type === "text") {
    return {
      content: [...block.content],
      id: block.id,
      type: "text",
    };
  }
  if (block.type === "rich_text") {
    return {
      content: canonicalRichContentToComposed(block.content),
      id: block.id,
      type: "rich_text",
    };
  }
  if (block.type === "separator") {
    return { id: block.id, type: "separator" };
  }
  throw new Error("Input blocks are handled before generic conversion.");
}

function questionPrimitiveBlockToTablePreviewPrimitiveBlock(
  block: QuestionTableBlock["cells"][number]["blocks"][number],
): TableBlockPreviewPrimitiveBlock {
  if (block.type === "text") {
    return {
      content: readInlineContent(block.content),
      id: readString(block.id),
      type: "text",
    };
  }
  if (block.type === "rich_text") {
    return {
      content: canonicalRichContentToComposed(block.content),
      id: block.id,
      type: "rich_text",
    };
  }
  if (block.type === "separator") {
    return { id: block.id, type: "separator" };
  }
  if (block.type === "input") {
    return {
      id: block.id,
      label: block.label,
      placeholder: block.placeholder,
      responseFieldId: block.responseFieldId,
      type: "input",
    };
  }
  throw new Error("Unsupported table block cell primitive.");
}

function readInlineContent(
  value: unknown,
): TableBlockPreviewTextBlock["content"] {
  if (!Array.isArray(value)) {
    throw new Error("Expected inline content.");
  }
  return value.map((item) => {
    const record = asRecord(item);
    if (record.type === "text") {
      return { text: readString(record.text), type: "text" };
    }
    if (record.type === "reference") {
      return {
        referenceId: readString(record.referenceId),
        type: "reference",
      };
    }
    if (record.type === "value") {
      return {
        displayValue: readString(record.displayValue),
        referenceId: readString(record.referenceId),
        type: "value",
      };
    }
    throw new Error("Unsupported inline content.");
  });
}
