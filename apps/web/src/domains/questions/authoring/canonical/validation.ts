import type {
  QuestionBlueprintBlock,
  QuestionBlueprintDocument,
  QuestionResponseField,
} from "#/api/generated/model";
import {
  extractInlineReferenceIds,
  isValidReferenceId,
} from "#/domains/questions/authoring/inline-content";
import { extractRichReferenceIds } from "#/domains/questions/authoring/rich-content";
import type { ComposedEditorModel } from "../composed-model";
import {
  extractReferenceIdsFromValueExpression,
  isValidWorkbookReferenceSource,
} from "../value-source";

export function addBlueprintBlock(
  blueprint: QuestionBlueprintDocument,
  block: QuestionBlueprintBlock,
): QuestionBlueprintDocument {
  return { ...blueprint, blocks: [...blueprint.blocks, block] };
}

export function updateBlueprintBlock(
  blueprint: QuestionBlueprintDocument,
  blockId: string,
  update: (block: QuestionBlueprintBlock) => QuestionBlueprintBlock,
): QuestionBlueprintDocument {
  return {
    ...blueprint,
    blocks: blueprint.blocks.map((block) =>
      block.id === blockId ? update(block) : block,
    ),
  };
}

export function removeBlueprintBlock(
  blueprint: QuestionBlueprintDocument,
  blockId: string,
): QuestionBlueprintDocument {
  return {
    ...blueprint,
    blocks: blueprint.blocks.filter((block) => block.id !== blockId),
  };
}

export function addResponseField(
  blueprint: QuestionBlueprintDocument,
  field: QuestionResponseField,
): QuestionBlueprintDocument {
  validateResponseFieldReferences({
    ...blueprint,
    responseFields: [...blueprint.responseFields, field],
  });
  return { ...blueprint, responseFields: [...blueprint.responseFields, field] };
}

export function updateResponseField(
  blueprint: QuestionBlueprintDocument,
  fieldId: string,
  update: (field: QuestionResponseField) => QuestionResponseField,
): QuestionBlueprintDocument {
  const next = {
    ...blueprint,
    responseFields: blueprint.responseFields.map((field) =>
      field.id === fieldId ? update(field) : field,
    ),
  };
  validateResponseFieldReferences(next);
  return next;
}

export function removeResponseField(
  blueprint: QuestionBlueprintDocument,
  fieldId: string,
): QuestionBlueprintDocument {
  const next = {
    ...blueprint,
    responseFields: blueprint.responseFields.filter(
      (field) => field.id !== fieldId,
    ),
  };
  validateResponseFieldReferences(next);
  return next;
}

export function validateResponseFieldReferences(
  blueprint: QuestionBlueprintDocument,
): void {
  const fieldIds = new Set<string>();
  for (const field of blueprint.responseFields) {
    if (!field.id) {
      throw new Error("Response field id must not be empty.");
    }
    if (fieldIds.has(field.id)) {
      throw new Error(`Response field id ${field.id} is duplicated.`);
    }
    fieldIds.add(field.id);
  }

  for (const block of blueprint.blocks) {
    if (block.type === "response" && !fieldIds.has(block.responseFieldId)) {
      throw new Error(
        `Response block ${block.id} references missing response field ${block.responseFieldId}.`,
      );
    }
    if (block.type !== "table") {
      continue;
    }
    for (const cell of block.cells) {
      if (cell.type === "response" && !fieldIds.has(cell.responseFieldId)) {
        throw new Error(
          `Response cell ${cell.id} references missing response field ${cell.responseFieldId}.`,
        );
      }
    }
  }
}

export function validateComposedEditorModel(model: ComposedEditorModel) {
  const referenceIds = new Set<string>();
  for (const reference of model.references) {
    if (!isValidReferenceId(reference.id)) {
      throw new Error(`Invalid reference id: ${reference.id}`);
    }
    if (referenceIds.has(reference.id)) {
      throw new Error(`Duplicate reference id: ${reference.id}`);
    }
    referenceIds.add(reference.id);
    if (!isValidWorkbookReferenceSource(reference.source)) {
      throw new Error(
        `Workbook reference ${reference.id} has an invalid source cell or range.`,
      );
    }
  }

  for (const block of model.blocks) {
    if (block.type === "text") {
      validateReferenceIds(
        extractInlineReferenceIds(block.content),
        referenceIds,
      );
      continue;
    }
    if (block.type === "rich_text") {
      const richReferenceIds = extractRichReferenceIds(block.content);
      validateReferenceIds(richReferenceIds, referenceIds);
      continue;
    }
    if (block.type === "response") {
      validateReferenceIds(
        extractReferenceIdsFromValueExpression(block.correctValueSource),
        referenceIds,
      );
      continue;
    }
    if (block.type !== "table") {
      continue;
    }
    for (const cell of block.table.cells) {
      const source =
        cell.type === "content"
          ? extractInlineReferenceIds(cell.content)
          : extractReferenceIdsFromValueExpression(cell.correctValueSource);
      validateReferenceIds(source, referenceIds);
    }
  }
}

function validateReferenceIds(
  ids: string[],
  referenceIds: ReadonlySet<string>,
) {
  for (const referenceId of ids) {
    if (!referenceIds.has(referenceId)) {
      throw new Error(`Unknown reference: ${referenceId}`);
    }
  }
}
