import type {
  QuestionResponseField,
  QuestionTableBlock,
  QuestionBlueprintDocument,
  QuestionBlueprintTableBlock,
} from "#/api/generated/model";
import type {
  TableBlockPreviewCell,
  TableBlockPreviewModel,
  TableEditorModel,
} from "../table-model";
import { validateTableEditorModelAnswers } from "../table-model";
import {
  extractInlineReferenceIds,
  inlineContentToPlainText,
  plainTextToInlineContent,
} from "#/domains/questions/authoring/inline-content";
import {
  asRecord,
  fromCanonicalTableAnswerFieldId,
  questionResponseFieldToTable,
  readArray,
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
    schemaVersion: 1,
    blocks: [
      {
        id: "prompt",
        type: "text",
        content: plainTextToInlineContent(model.prompt),
      },
      tableEditorModelToQuestionBlueprintTableBlock(model, "table"),
    ],
    responseFields: tableEditorModelToResponseFields(model),
    references: [],
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
    id: blockId,
    type: "table",
    columns: model.columns,
    rows: model.rows,
    showColumnNames: model.showColumnNames,
    showRowNames: model.showRowNames,
    cells: model.cells.map((cell) => {
      if (cell.type === "content") {
        return {
          id: toCanonicalTableCellId(blockId, cell.id),
          rowId: cell.rowId,
          columnId: cell.columnId,
          type: "content" as const,
          content: cell.content,
        };
      }

      return {
        id: toCanonicalTableCellId(blockId, cell.id),
        rowId: cell.rowId,
        columnId: cell.columnId,
        type: "response" as const,
        responseFieldId: options?.responseFieldIdPrefix
          ? toCanonicalTableAnswerFieldId(blockId, cell.responseFieldId)
          : cell.responseFieldId,
        correctValueSource: toQuestionValueExpression(cell.correctValueSource),
        points: cell.points,
        grading: cell.grading,
        ...(cell.label === undefined ? {} : { label: cell.label }),
        ...(cell.placeholder === undefined
          ? {} : { placeholder: cell.placeholder }),
      };
    }),
  };
}

function assertStandaloneTableHasOnlyLiteralValues(
  model: TableEditorModel,
): void {
  for (const cell of model.cells) {
    if (
      cell.type === "content" &&
      extractInlineReferenceIds(cell.content).length > 0
    ) {
      throw new Error(
        `Standalone table content cell ${cell.id} references a reference, but standalone table conversion does not support references.`,
      );
    }

    if (
      cell.type === "response" &&
      cell.correctValueSource.type === "reference"
    ) {
      throw new Error(
        `Standalone table answer cell ${cell.id} references ${cell.correctValueSource.referenceId}, but standalone table conversion does not support references.`,
      );
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
    type: field.type,
    label: field.label,
    required: field.required,
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
  const responseFieldIds = new Set(tableResponseFields.map((field) => field.id));
  const tableResponseFieldIds = new Set<string>();

  const cells = block.cells.map((cell) => {
    if (cell.type === "content") {
      return {
        id: cell.id,
        rowId: cell.rowId,
        columnId: cell.columnId,
        type: "content" as const,
        content: [...cell.content],
      };
    }

    if (
      cell.correctValueSource === undefined ||
      cell.points === undefined ||
      cell.grading === undefined
    ) {
      throw new Error(
        "Unsupported question blueprint document for composed editor.",
      );
    }
    const responseFieldId = fromCanonicalTableAnswerFieldId(
      block.id,
      cell.responseFieldId,
    );
    if (!responseFieldIds.has(responseFieldId)) {
      throw new Error(
        "Unsupported question blueprint document for composed editor.",
      );
    }
    tableResponseFieldIds.add(responseFieldId);
    return {
      id: cell.id,
      rowId: cell.rowId,
      columnId: cell.columnId,
      type: "response" as const,
      responseFieldId,
      correctValueSource: toValueExpression(cell.correctValueSource),
      points: cell.points,
      grading: cell.grading,
      ...(cell.label === undefined ? {} : { label: cell.label }),
      ...(cell.placeholder === undefined ? {} : { placeholder: cell.placeholder }),
    };
  });

  return {
    prompt: prompt ?? "",
    columns: block.columns,
    rows: block.rows,
    showColumnNames: block.showColumnNames,
    showRowNames: block.showRowNames,
    responseFields: tableResponseFields
      .filter((field) => tableResponseFieldIds.has(field.id))
      .map(questionResponseFieldToTable),
    cells,
  };
}

export function questionTableBlockToPreviewModel(
  block: QuestionTableBlock,
  responseFields: QuestionResponseField[],
): TableBlockPreviewModel {
  const tableResponseFieldIds = new Set<string>();
  const cells = readArray(block.cells).map((cell) => {
    const previewCell = tableQuestionCellToPreviewCell(asRecord(cell));
    if (previewCell.type === "response") {
      tableResponseFieldIds.add(previewCell.responseFieldId);
    }
    return previewCell;
  });

  return {
    prompt: "",
    columns: readAxisArray(block.columns),
    rows: readAxisArray(block.rows),
    showColumnNames: block.showColumnNames !== false,
    showRowNames: block.showRowNames !== false,
    responseFields: responseFields
      .filter((field) => tableResponseFieldIds.has(field.id))
      .map(questionResponseFieldToTable),
    cells,
  };
}

function tableQuestionCellToPreviewCell(
  cell: Record<string, unknown>,
): TableBlockPreviewCell {
  if (cell.type === "content") {
    return {
      id: readString(cell.id),
      rowId: readString(cell.rowId),
      columnId: readString(cell.columnId),
      type: "content",
      content: [{ type: "text", text: readString(cell.text) }],
    };
  }
  if (cell.type === "response") {
    return {
      id: readString(cell.id),
      rowId: readString(cell.rowId),
      columnId: readString(cell.columnId),
      type: "response",
      responseFieldId: readString(cell.responseFieldId),
    };
  }
  throw new Error("Unsupported table block cell.");
}
