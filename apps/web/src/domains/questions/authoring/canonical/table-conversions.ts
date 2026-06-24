import type {
  QuestionBlueprintDocument,
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
  TableEditorModel,
} from "../table-model";
import { validateTableEditorModelAnswers } from "../table-model";
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
    blocks: [
      {
        content: plainTextToInlineContent(model.prompt),
        id: "prompt",
        type: "text",
      },
      tableEditorModelToQuestionBlueprintTableBlock(model, "table"),
    ],
    references: [],
    responseFields: tableEditorModelToResponseFields(model),
    schemaVersion: 1,
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
    cells: model.cells.map((cell) => {
      if (cell.type === "content") {
        return {
          columnId: cell.columnId,
          content: cell.content,
          id: toCanonicalTableCellId(blockId, cell.id),
          rowId: cell.rowId,
          type: "content" as const,
        };
      }

      return {
        columnId: cell.columnId,
        correctValueSource: toQuestionValueExpression(cell.correctValueSource),
        grading: cell.grading,
        id: toCanonicalTableCellId(blockId, cell.id),
        points: cell.points,
        responseFieldId: options?.responseFieldIdPrefix
          ? toCanonicalTableAnswerFieldId(blockId, cell.responseFieldId)
          : cell.responseFieldId,
        rowId: cell.rowId,
        type: "response" as const,
        ...(cell.label === undefined ? {} : { label: cell.label }),
        ...(cell.placeholder === undefined
          ? {}
          : { placeholder: cell.placeholder }),
      };
    }),
    columns: model.columns,
    id: blockId,
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
    if (cell.type === "content") {
      return {
        columnId: cell.columnId,
        content: [...cell.content],
        id: cell.id,
        rowId: cell.rowId,
        type: "content" as const,
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
      columnId: cell.columnId,
      correctValueSource: toValueExpression(cell.correctValueSource),
      grading: cell.grading,
      id: cell.id,
      points: cell.points,
      responseFieldId,
      rowId: cell.rowId,
      type: "response" as const,
      ...(cell.label === undefined ? {} : { label: cell.label }),
      ...(cell.placeholder === undefined
        ? {}
        : { placeholder: cell.placeholder }),
    };
  });

  return {
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
  const cells = readArray(block.cells).map((cell) => {
    const previewCell = tableQuestionCellToPreviewCell(asRecord(cell));
    if (previewCell.type === "response") {
      tableResponseFieldIds.add(previewCell.responseFieldId);
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
  cell: Record<string, unknown>,
): TableBlockPreviewCell {
  if (cell.type === "content") {
    return {
      columnId: readString(cell.columnId),
      content: [{ text: readString(cell.text), type: "text" }],
      id: readString(cell.id),
      rowId: readString(cell.rowId),
      type: "content",
    };
  }
  if (cell.type === "response") {
    return {
      columnId: readString(cell.columnId),
      id: readString(cell.id),
      responseFieldId: readString(cell.responseFieldId),
      rowId: readString(cell.rowId),
      type: "response",
    };
  }
  throw new Error("Unsupported table block cell.");
}
