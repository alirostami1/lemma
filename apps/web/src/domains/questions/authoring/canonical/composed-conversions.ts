import type {
  BlueprintInlineContent,
  QuestionBlueprintBlock,
  QuestionBlueprintDocument,
  QuestionReference,
  QuestionResponseField,
} from "#/api/generated/model";
import type {
  ComposedEditorBlock,
  ComposedEditorModel,
  ComposedResponseField,
} from "../composed-model";
import {
  COMPOSED_AUTHORING_SCHEMA_VERSION,
  createDefaultComposedEditorModel,
  stripUnusedComposedReferences,
} from "../composed-model";
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
  const modelForSave = stripUnusedComposedReferences(model);
  validateComposedEditorModel(modelForSave);
  const responseFields: QuestionResponseField[] = [];
  const responseFieldIds = new Set<string>();
  const references: QuestionReference[] = [];
  const referenceIds = new Set<string>();

  for (const reference of modelForSave.references) {
    pushUniqueReference(references, referenceIds, {
      id: reference.id,
      ...(reference.label === undefined ? {} : { label: reference.label }),
      source: toQuestionReferenceSource(reference.source),
    });
  }

  return {
    blocks: composedBlocksToQuestionBlueprintBlocks({
      blocks: modelForSave.blocks,
      modelResponseFields: modelForSave.responseFields,
      responseFieldIds,
      responseFields,
    }),
    references,
    responseFields,
    schemaVersion: COMPOSED_AUTHORING_SCHEMA_VERSION,
  };
}

function composedBlocksToQuestionBlueprintBlocks(input: {
  blocks: ComposedEditorBlock[];
  modelResponseFields: ComposedResponseField[];
  responseFields: QuestionResponseField[];
  responseFieldIds: Set<string>;
}): QuestionBlueprintBlock[] {
  const blocks: QuestionBlueprintBlock[] = [];

  for (const block of input.blocks) {
    if (block.type === "text") {
      blocks.push({
        content: block.content,
        id: block.id,
        kind: "primitive",
        type: "text",
      });
      continue;
    }

    if (block.type === "rich_text") {
      blocks.push({
        content: composedRichContentToCanonicalRichContent(block.content),
        id: block.id,
        kind: "primitive",
        type: "rich_text",
      });
      continue;
    }

    if (block.type === "separator") {
      blocks.push({
        id: block.id,
        kind: "primitive",
        type: "separator",
      });
      continue;
    }

    if (block.type === "response") {
      const responseField = input.modelResponseFields.find(
        (field) => field.id === block.responseFieldId,
      );
      if (!responseField) {
        throw new Error(
          `Response block ${block.id} references missing response field ${block.responseFieldId}.`,
        );
      }
      pushUniqueResponseField(
        input.responseFields,
        input.responseFieldIds,
        responseField,
      );
      blocks.push({
        grading: block.grading,
        id: block.id,
        kind: "primitive",
        label: block.label,
        placeholder: block.placeholder,
        points: block.points,
        responseFieldId: block.responseFieldId,
        type: "input",
        ...(block.correctValueSource === undefined
          ? {}
          : {
              correctValueSource: toQuestionValueExpression(
                block.correctValueSource,
              ),
            }),
      });
      continue;
    }

    if (block.type === "container") {
      blocks.push({
        blocks: composedBlocksToQuestionBlueprintBlocks({
          blocks: block.blocks,
          modelResponseFields: input.modelResponseFields,
          responseFieldIds: input.responseFieldIds,
          responseFields: input.responseFields,
        }),
        id: block.id,
        kind: "container",
        ...(block.title === undefined ? {} : { title: block.title }),
        type: block.containerType,
      });
      continue;
    }

    validateTableEditorModelAnswers(block.table);
    if (block.table.prompt.length > 0) {
      blocks.push({
        content: plainTextToInlineContent(block.table.prompt),
        id: `${block.id}_prompt`,
        kind: "primitive",
        type: "text",
      });
    }
    const tableResponseFields = tableEditorModelToResponseFields(
      block.table,
      block.id,
    );
    for (const responseField of tableResponseFields) {
      pushUniqueResponseField(
        input.responseFields,
        input.responseFieldIds,
        responseField,
      );
    }
    blocks.push(
      tableEditorModelToQuestionBlueprintTableBlock(block.table, block.id, {
        responseFieldIdPrefix: `${block.id}_`,
      }),
    );
  }

  return blocks;
}

export function questionBlueprintDocumentToComposedEditorModel(
  blueprint: QuestionBlueprintDocument,
): ComposedEditorModel {
  const responseFields: ComposedResponseField[] = [];
  const responseFieldIds = new Set<string>();
  const references = blueprint.references.map(
    questionReferenceToComposedReferenceDraft,
  );
  validateSupportedResponseFields(blueprint.responseFields);

  return {
    blocks: questionBlueprintBlocksToComposedEditorBlocks({
      blueprintBlocks: blueprint.blocks,
      blueprintResponseFields: blueprint.responseFields,
      responseFieldIds,
      responseFields,
    }),
    references,
    responseFields,
    schemaVersion: COMPOSED_AUTHORING_SCHEMA_VERSION,
  };
}

function validateSupportedResponseFields(
  responseFields: QuestionResponseField[],
): void {
  for (const responseField of responseFields) {
    questionResponseFieldToComposed(responseField);
  }
}

function questionBlueprintBlocksToComposedEditorBlocks(input: {
  blueprintBlocks: QuestionBlueprintBlock[];
  blueprintResponseFields: QuestionResponseField[];
  responseFields: ComposedResponseField[];
  responseFieldIds: Set<string>;
}): ComposedEditorBlock[] {
  const blocks: ComposedEditorBlock[] = [];
  const tablePromptById = new Map<string, string>();

  for (let index = 0; index < input.blueprintBlocks.length; index += 1) {
    const block = input.blueprintBlocks[index];
    if (
      block.kind === "primitive" &&
      block.type === "text" &&
      block.id.endsWith("_prompt")
    ) {
      const nextBlock = input.blueprintBlocks[index + 1];
      if (
        nextBlock?.kind === "complex" &&
        nextBlock.type === "table" &&
        block.id.replace(/_prompt$/u, "") === nextBlock.id
      ) {
        tablePromptById.set(
          nextBlock.id,
          blueprintContentToText(block.content),
        );
        continue;
      }
    }

    if (block.kind === "primitive" && block.type === "text") {
      blocks.push({
        content: block.content,
        id: block.id,
        type: "text",
      });
      continue;
    }

    if (block.kind === "primitive" && block.type === "rich_text") {
      blocks.push({
        content: canonicalRichContentToComposed(block.content),
        id: block.id,
        type: "rich_text",
      });
      continue;
    }

    if (block.kind === "primitive" && block.type === "separator") {
      blocks.push({
        id: block.id,
        type: "separator",
      });
      continue;
    }

    if (block.kind === "primitive" && block.type === "input") {
      if (block.points === undefined || block.grading === undefined) {
        throw new Error(
          "Unsupported question blueprint document for composed editor.",
        );
      }
      const responseField = input.blueprintResponseFields.find(
        (field) => field.id === block.responseFieldId,
      );
      if (!responseField) {
        throw new Error(
          "Unsupported question blueprint document for composed editor.",
        );
      }
      if (!input.responseFieldIds.has(responseField.id)) {
        input.responseFieldIds.add(responseField.id);
        input.responseFields.push(
          questionResponseFieldToComposed(responseField),
        );
      }
      blocks.push({
        grading: block.grading,
        id: block.id,
        label: block.label,
        placeholder: block.placeholder,
        points: block.points,
        responseFieldId: block.responseFieldId,
        type: "response",
        ...(block.correctValueSource === undefined
          ? {}
          : {
              correctValueSource: toValueExpression(block.correctValueSource),
            }),
      });
      continue;
    }

    if (block.kind === "container") {
      blocks.push({
        blocks: questionBlueprintBlocksToComposedEditorBlocks({
          blueprintBlocks: block.blocks,
          blueprintResponseFields: input.blueprintResponseFields,
          responseFieldIds: input.responseFieldIds,
          responseFields: input.responseFields,
        }),
        containerType: block.type,
        id: block.id,
        title: block.title,
        type: "container",
      });
      continue;
    }

    const table = questionBlueprintTableBlockToTableEditorModel(
      block,
      input.blueprintResponseFields,
      tablePromptById.get(block.id),
    );
    blocks.push({
      id: block.id,
      table,
      type: "table",
    });
  }

  return blocks;
}
