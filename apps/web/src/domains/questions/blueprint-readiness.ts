import {
  type ComposedEditorBlock,
  type ComposedEditorModel,
  extractInlineReferenceIds,
  extractReferenceIdsFromValueExpression,
  extractRichReferenceIds,
  extractUsedReferenceIdsFromComposedEditorModel,
  isValidReferenceId,
  isValidWorkbookReferenceSource,
} from "#/domains/questions/authoring";
import { getBlueprintSourceRequirement } from "./source-requirements";

export type BlueprintReadinessIssueCode =
  | "missing_name"
  | "missing_block"
  | "missing_answer"
  | "invalid_reference_id"
  | "duplicate_reference_id"
  | "invalid_reference_source"
  | "missing_text_reference"
  | "missing_rich_text_reference"
  | "missing_response_field"
  | "missing_response_source"
  | "missing_table_response_field"
  | "missing_table_response_source"
  | "missing_source"
  | "missing_source_preview";

export type BlueprintReadinessIssue = {
  code: BlueprintReadinessIssueCode;
  target?: {
    blockId?: string;
    cellId?: string;
    referenceId?: string;
  };
};

export function getBlueprintReadinessIssues(input: {
  model: ComposedEditorModel;
  hasWorkbookSelection: boolean;
  hasWorkbookPreview: boolean;
  name: string;
}): BlueprintReadinessIssue[] {
  const issues: BlueprintReadinessIssue[] = [];

  if (input.name.trim().length === 0) {
    issues.push({ code: "missing_name" });
  }

  if (input.model.blocks.length === 0) {
    issues.push({ code: "missing_block" });
  }

  if (!hasAnyAnswer(input.model)) {
    issues.push({ code: "missing_answer" });
  }

  issues.push(...getReferenceIssues(input.model));
  issues.push(...getBlockIssues(input.model));

  const requiresWorkbookSource =
    getBlueprintSourceRequirement(input.model).status === "required";
  if (requiresWorkbookSource && !input.hasWorkbookSelection) {
    issues.push({ code: "missing_source" });
  } else if (
    requiresWorkbookSource &&
    input.hasWorkbookSelection &&
    !input.hasWorkbookPreview
  ) {
    issues.push({ code: "missing_source_preview" });
  }

  return issues;
}

function hasAnyAnswer(model: ComposedEditorModel) {
  return model.blocks.some((block) => {
    if (block.type === "response") {
      return true;
    }

    if (block.type === "table") {
      return block.table.cells.some((cell) => cell.type === "response");
    }

    return false;
  });
}

function getReferenceIssues(
  model: ComposedEditorModel,
): BlueprintReadinessIssue[] {
  const issues: BlueprintReadinessIssue[] = [];
  const referenceIds = new Set(
    model.references.map((reference) => reference.id),
  );
  const seenReferenceIds = new Set<string>();
  const usedReferenceIds = new Set(
    extractUsedReferenceIdsFromComposedEditorModel(model),
  );

  for (const reference of model.references) {
    if (!usedReferenceIds.has(reference.id)) {
      continue;
    }
    if (!isValidReferenceId(reference.id)) {
      issues.push({
        code: "invalid_reference_id",
        target: { referenceId: reference.id },
      });
    } else if (seenReferenceIds.has(reference.id)) {
      issues.push({
        code: "duplicate_reference_id",
        target: { referenceId: reference.id },
      });
    }
    seenReferenceIds.add(reference.id);

    if (!isValidWorkbookReferenceSource(reference.source)) {
      issues.push({
        code: "invalid_reference_source",
        target: { referenceId: reference.id },
      });
    }
  }

  for (const block of model.blocks) {
    if (block.type === "text") {
      for (const referenceId of extractInlineReferenceIds(block.content)) {
        if (!referenceIds.has(referenceId)) {
          issues.push({
            code: "missing_text_reference",
            target: { blockId: block.id, referenceId },
          });
        }
      }
      continue;
    }

    if (block.type === "rich_text") {
      for (const referenceId of extractRichReferenceIds(block.content)) {
        if (!referenceIds.has(referenceId)) {
          issues.push({
            code: "missing_rich_text_reference",
            target: { blockId: block.id, referenceId },
          });
        }
      }
    }
  }

  return issues;
}

function getBlockIssues(model: ComposedEditorModel): BlueprintReadinessIssue[] {
  const issues: BlueprintReadinessIssue[] = [];
  const responseFieldIds = new Set(
    model.responseFields.map((field) => field.id),
  );
  const referenceIds = new Set(
    model.references.map((reference) => reference.id),
  );

  for (const block of model.blocks) {
    if (block.type === "response") {
      if (!responseFieldIds.has(block.responseFieldId)) {
        issues.push({
          code: "missing_response_field",
          target: { blockId: block.id },
        });
      }
      for (const referenceId of extractReferenceIdsFromValueExpression(
        block.correctValueSource,
      )) {
        if (!referenceIds.has(referenceId)) {
          issues.push({
            code: "missing_response_source",
            target: { blockId: block.id, referenceId },
          });
        }
      }
      continue;
    }

    if (block.type === "table") {
      issues.push(...getTableIssues(block, referenceIds));
    }
  }

  return issues;
}

function getTableIssues(
  block: Extract<ComposedEditorBlock, { type: "table" }>,
  referenceIds: Set<string>,
): BlueprintReadinessIssue[] {
  const issues: BlueprintReadinessIssue[] = [];
  const responseFieldIds = new Set(
    block.table.responseFields.map((field) => field.id),
  );

  for (const cell of block.table.cells) {
    if (cell.type === "content") {
      for (const referenceId of extractInlineReferenceIds(cell.content)) {
        if (!referenceIds.has(referenceId)) {
          issues.push({
            code: "missing_text_reference",
            target: { blockId: block.id, cellId: cell.id, referenceId },
          });
        }
      }
      continue;
    }

    if (!responseFieldIds.has(cell.responseFieldId)) {
      issues.push({
        code: "missing_table_response_field",
        target: { blockId: block.id, cellId: cell.id },
      });
    }

    for (const referenceId of extractReferenceIdsFromValueExpression(
      cell.correctValueSource,
    )) {
      if (!referenceIds.has(referenceId)) {
        issues.push({
          code: "missing_table_response_source",
          target: { blockId: block.id, cellId: cell.id, referenceId },
        });
      }
    }
  }

  return issues;
}
