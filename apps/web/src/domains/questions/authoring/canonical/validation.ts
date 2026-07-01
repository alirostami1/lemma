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
import {
  type ComposedEditorModel,
  flattenComposedBlocks,
} from "../composed-model";
import {
  extractReferenceIdsFromInputPrimitive,
  type InputPrimitive,
  normalizeInputPrimitiveForType,
  validateInputPrimitiveConfig,
} from "../input-primitive";
import {
  getTableCellPrimitiveBlocks,
  requiresCorrectValueSource,
  type TableEditorInputBlock,
} from "../table-model";
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
    validateBlockResponseFieldReferences(block, fieldIds);
  }
}

function validateBlockResponseFieldReferences(
  block: QuestionBlueprintBlock,
  fieldIds: ReadonlySet<string>,
): void {
  if (block.kind === "container") {
    for (const childBlock of block.blocks) {
      validateBlockResponseFieldReferences(childBlock, fieldIds);
    }
    return;
  }
  if (block.kind === "primitive" && block.type === "input") {
    if (!fieldIds.has(block.responseFieldId)) {
      throw new Error(
        `Input block ${block.id} references missing response field ${block.responseFieldId}.`,
      );
    }
    return;
  }
  if (block.kind !== "complex") {
    return;
  }
  for (const cell of block.cells) {
    for (const cellBlock of cell.blocks) {
      if (
        cellBlock.type === "input" &&
        !fieldIds.has(cellBlock.responseFieldId)
      ) {
        throw new Error(
          `Input cell block ${cellBlock.id} references missing response field ${cellBlock.responseFieldId}.`,
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

  for (const block of flattenComposedBlocks(model.blocks)) {
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
      const responseField = model.responseFields.find(
        (field) => field.id === block.responseFieldId,
      );
      if (
        responseField &&
        block.input &&
        block.input.type !== responseField.type
      ) {
        throw new Error(
          `Input block ${block.id} type must match response field ${responseField.id}.`,
        );
      }
      validateEditorInputPrimitiveConfig(
        responseField
          ? normalizeInputPrimitiveForType(block.input, responseField.type)
          : block.input,
        `Input block ${block.id}`,
      );
      if (
        requiresCorrectValueSource(block.grading) &&
        block.correctValueSource === undefined
      ) {
        throw new Error(
          `Input block ${block.id} is missing correct value source for ${block.grading.mode} grading.`,
        );
      }
      validateReferenceIds(
        [
          ...extractReferenceIdsFromValueExpression(block.correctValueSource),
          ...extractReferenceIdsFromInputPrimitive(block.input),
        ],
        referenceIds,
      );
      continue;
    }
    if (block.type !== "table") {
      continue;
    }
    for (const cell of block.table.cells) {
      const responseFieldsById = new Map(
        block.table.responseFields.map((field) => [field.id, field]),
      );
      for (const cellBlock of getTableCellPrimitiveBlocks(cell)) {
        if (cellBlock.type === "input") {
          const responseField = responseFieldsById.get(
            cellBlock.responseFieldId,
          );
          if (
            responseField &&
            cellBlock.input &&
            cellBlock.input.type !== responseField.type
          ) {
            throw new Error(
              `Input block ${cellBlock.id} type must match response field ${responseField.id}.`,
            );
          }
          validateEditorInputPrimitiveConfig(
            responseField
              ? normalizeInputPrimitiveForType(
                  cellBlock.input,
                  responseField.type,
                )
              : cellBlock.input,
            `Input block ${cellBlock.id} in cell ${cell.id}`,
          );
        }
        const source =
          cellBlock.type === "text"
            ? extractInlineReferenceIds(cellBlock.content)
            : cellBlock.type === "rich_text"
              ? extractRichReferenceIds(cellBlock.content)
              : cellBlock.type === "input"
                ? extractTableInputReferenceIds(cellBlock, cell.id)
                : [];
        validateReferenceIds(source, referenceIds);
      }
    }
  }
}

function validateEditorInputPrimitiveConfig(
  input: InputPrimitive | undefined,
  label: string,
): void {
  if (!input) {
    return;
  }
  const result = validateInputPrimitiveConfig(input);
  if (!result.valid) {
    throw new Error(
      `${label} settings are invalid: ${result.errors[0]?.message ?? "Answer settings are invalid."}`,
    );
  }
}

function extractTableInputReferenceIds(
  block: TableEditorInputBlock,
  cellId: string,
): string[] {
  if (
    requiresCorrectValueSource(block.grading) &&
    block.correctValueSource === undefined
  ) {
    throw new Error(
      `Input block ${block.id} in cell ${cellId} is missing correct value source for ${block.grading.mode} grading.`,
    );
  }
  return [
    ...extractReferenceIdsFromValueExpression(block.correctValueSource),
    ...extractReferenceIdsFromInputPrimitive(block.input),
  ];
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
