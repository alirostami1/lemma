import type {
  BlueprintInlineContent,
  QuestionBlueprintBlock,
  QuestionBlueprintDocument,
  QuestionReference,
  QuestionResponseField,
} from "#/api/generated/model";
import type {
  ComposedEditorModel,
  ComposedResponseField,
} from "../composed-model";
import { createDefaultComposedEditorModel } from "../composed-model";
import { plainTextToInlineContent } from "../inline-content";
import { validateTableEditorModelAnswers } from "../table-model";
import {
  canonicalRichContentToComposed,
  composedRichContentToCanonicalRichContent,
  pushUniqueReference,
  pushUniqueResponseField,
  questionReferenceToComposedReferenceDraft,
  questionResponseFieldToComposed,
  toQuestionReferenceSource,
  toQuestionValueExpression,
  toValueExpression,
} from "./shared";
import {
  questionBlueprintTableBlockToTableEditorModel,
  tableEditorModelToQuestionBlueprintTableBlock,
  tableEditorModelToResponseFields,
} from "./table-conversions";
import { validateComposedEditorModel } from "./validation";

function blueprintContentToText(content: BlueprintInlineContent[]): string {
  return content
    .map((item) =>
      item.type === "text"
        ? item.text
        : (item.fallbackText ?? `{{ .${item.referenceId} }}`),
    )
    .join("");
}

export function createDefaultQuestionBlueprintDocument(): QuestionBlueprintDocument {
  return composedEditorModelToQuestionBlueprintDocument(
    createDefaultComposedEditorModel(),
  );
}

export function composedEditorModelToQuestionBlueprintDocument(
  model: ComposedEditorModel,
): QuestionBlueprintDocument {
  validateComposedEditorModel(model);
  const responseFields: QuestionResponseField[] = [];
  const responseFieldIds = new Set<string>();
  const references: QuestionReference[] = [];
  const referenceIds = new Set<string>();
  const blocks: QuestionBlueprintBlock[] = [];

  for (const reference of model.references) {
    pushUniqueReference(references, referenceIds, {
      id: reference.id,
      ...(reference.label === undefined ? {} : { label: reference.label }),
      source: toQuestionReferenceSource(reference.source),
    });
  }

  for (const block of model.blocks) {
    if (block.type === "text") {
      blocks.push({
        content: block.content,
        id: block.id,
        type: "text",
      });
      continue;
    }

    if (block.type === "rich_text") {
      blocks.push({
        content: composedRichContentToCanonicalRichContent(block.content),
        id: block.id,
        type: "rich_text",
      });
      continue;
    }

    if (block.type === "separator") {
      blocks.push({
        id: block.id,
        type: "separator",
      });
      continue;
    }

    if (block.type === "response") {
      const responseField = model.responseFields.find(
        (field) => field.id === block.responseFieldId,
      );
      if (!responseField) {
        throw new Error(
          `Response block ${block.id} references missing response field ${block.responseFieldId}.`,
        );
      }
      pushUniqueResponseField(responseFields, responseFieldIds, responseField);
      blocks.push({
        correctValueSource: toQuestionValueExpression(block.correctValueSource),
        grading: block.grading,
        id: block.id,
        label: block.label,
        placeholder: block.placeholder,
        points: block.points,
        responseFieldId: block.responseFieldId,
        type: "response",
      });
      continue;
    }

    validateTableEditorModelAnswers(block.table);
    if (block.table.prompt.length > 0) {
      blocks.push({
        content: plainTextToInlineContent(block.table.prompt),
        id: `${block.id}_prompt`,
        type: "text",
      });
    }
    const tableResponseFields = tableEditorModelToResponseFields(
      block.table,
      block.id,
    );
    for (const responseField of tableResponseFields) {
      pushUniqueResponseField(responseFields, responseFieldIds, responseField);
    }
    blocks.push(
      tableEditorModelToQuestionBlueprintTableBlock(block.table, block.id, {
        responseFieldIdPrefix: `${block.id}_`,
      }),
    );
  }

  return {
    blocks,
    references,
    responseFields,
    schemaVersion: 1,
  };
}

export function questionBlueprintDocumentToComposedEditorModel(
  blueprint: QuestionBlueprintDocument,
): ComposedEditorModel {
  const blocks: ComposedEditorModel["blocks"] = [];
  const responseFields: ComposedResponseField[] = [];
  const responseFieldIds = new Set<string>();
  const references = blueprint.references.map(
    questionReferenceToComposedReferenceDraft,
  );
  for (const responseField of blueprint.responseFields) {
    questionResponseFieldToComposed(responseField);
  }

  const tablePromptById = new Map<string, string>();

  for (let index = 0; index < blueprint.blocks.length; index += 1) {
    const block = blueprint.blocks[index];
    if (block.type === "text" && block.id.endsWith("_prompt")) {
      const nextBlock = blueprint.blocks[index + 1];
      if (
        nextBlock?.type === "table" &&
        block.id.replace(/_prompt$/u, "") === nextBlock.id
      ) {
        tablePromptById.set(
          nextBlock.id,
          blueprintContentToText(block.content),
        );
        continue;
      }
    }

    if (block.type === "text") {
      blocks.push({
        content: block.content,
        id: block.id,
        type: "text",
      });
      continue;
    }

    if (block.type === "rich_text") {
      blocks.push({
        content: canonicalRichContentToComposed(block.content),
        id: block.id,
        type: "rich_text",
      });
      continue;
    }

    if (block.type === "separator") {
      blocks.push({
        id: block.id,
        type: "separator",
      });
      continue;
    }

    if (block.type === "response") {
      if (
        block.correctValueSource === undefined ||
        block.points === undefined ||
        block.grading === undefined
      ) {
        throw new Error(
          "Unsupported question blueprint document for composed editor.",
        );
      }
      const responseField = blueprint.responseFields.find(
        (field) => field.id === block.responseFieldId,
      );
      if (!responseField) {
        throw new Error(
          "Unsupported question blueprint document for composed editor.",
        );
      }
      if (!responseFieldIds.has(responseField.id)) {
        responseFieldIds.add(responseField.id);
        responseFields.push(questionResponseFieldToComposed(responseField));
      }
      blocks.push({
        correctValueSource: toValueExpression(block.correctValueSource),
        grading: block.grading,
        id: block.id,
        label: block.label,
        placeholder: block.placeholder,
        points: block.points,
        responseFieldId: block.responseFieldId,
        type: "response",
      });
      continue;
    }

    if (block.type === "table") {
      const table = questionBlueprintTableBlockToTableEditorModel(
        block,
        blueprint.responseFields,
        tablePromptById.get(block.id),
      );
      blocks.push({
        id: block.id,
        table,
        type: "table",
      });
      continue;
    }

    throw new Error(
      "Unsupported question blueprint document for composed editor.",
    );
  }

  return {
    blocks,
    references,
    responseFields,
    schemaVersion: 1,
  };
}
