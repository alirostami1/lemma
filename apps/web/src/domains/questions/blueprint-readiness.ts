import {
  type ComposedEditorBlock,
  type ComposedEditorModel,
  extractInlineReferenceIds,
  extractReferenceIdsFromValueExpression,
  extractRichReferenceIds,
  extractUsedReferenceIdsFromComposedEditorModel,
  flattenComposedBlocks,
  getTableCellPrimitiveBlocks,
  isValidReferenceId,
  isValidWorkbookReferenceSource,
  requiresCorrectValueSource,
} from "#/domains/questions/authoring";
import type { QuestionBlueprintWorkbookSource } from "./model";
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
  attachedSources: QuestionBlueprintWorkbookSource[];
  name: string;
}): BlueprintReadinessIssue[] {
  const issues: BlueprintReadinessIssue[] = [];
  const attachedSourceIds = new Set(
    input.attachedSources.map((source) => source.sourceId),
  );

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
  if (requiresWorkbookSource && attachedSourceIds.size === 0) {
    issues.push({ code: "missing_source" });
  }

  if (attachedSourceIds.size > 0) {
    const usedReferenceIds = new Set(
      extractUsedReferenceIdsFromComposedEditorModel(input.model),
    );

    for (const reference of input.model.references) {
      if (!usedReferenceIds.has(reference.id)) {
        continue;
      }
      if (
        reference.source.type !== "workbook_cell" &&
        reference.source.type !== "workbook_range"
      ) {
        continue;
      }

      if (!attachedSourceIds.has(reference.source.sourceId)) {
        issues.push({
          code: "invalid_reference_source",
          target: { referenceId: reference.id },
        });
      }
    }
  }

  return issues;
}

function hasAnyAnswer(model: ComposedEditorModel): boolean {
  return model.blocks.some((block) => {
    if (block.type === "response") {
      return true;
    }

    if (block.type === "table") {
      return block.table.cells.some((cell) =>
        getTableCellPrimitiveBlocks(cell).some(
          (cellBlock) => cellBlock.type === "input",
        ),
      );
    }

    if (block.type === "container") {
      return block.blocks.some((childBlock) =>
        hasAnyAnswer({
          blocks: [childBlock],
          references: [],
          responseFields: [],
          schemaVersion: model.schemaVersion,
        }),
      );
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

  for (const block of flattenComposedBlocks(model.blocks)) {
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

  for (const block of flattenComposedBlocks(model.blocks)) {
    if (block.type === "response") {
      if (!responseFieldIds.has(block.responseFieldId)) {
        issues.push({
          code: "missing_response_field",
          target: { blockId: block.id },
        });
      }
      if (
        requiresCorrectValueSource(block.grading) &&
        block.correctValueSource === undefined
      ) {
        issues.push({
          code: "missing_response_source",
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
    for (const cellBlock of getTableCellPrimitiveBlocks(cell)) {
      if (cellBlock.type === "text") {
        for (const referenceId of extractInlineReferenceIds(
          cellBlock.content,
        )) {
          if (!referenceIds.has(referenceId)) {
            issues.push({
              code: "missing_text_reference",
              target: { blockId: block.id, cellId: cell.id, referenceId },
            });
          }
        }
      }

      if (cellBlock.type === "rich_text") {
        for (const referenceId of extractRichReferenceIds(cellBlock.content)) {
          if (!referenceIds.has(referenceId)) {
            issues.push({
              code: "missing_rich_text_reference",
              target: { blockId: block.id, cellId: cell.id, referenceId },
            });
          }
        }
      }

      if (cellBlock.type !== "input") {
        continue;
      }

      if (!responseFieldIds.has(cellBlock.responseFieldId)) {
        issues.push({
          code: "missing_table_response_field",
          target: { blockId: block.id, cellId: cell.id },
        });
      }

      if (
        requiresCorrectValueSource(cellBlock.grading) &&
        cellBlock.correctValueSource === undefined
      ) {
        issues.push({
          code: "missing_table_response_source",
          target: { blockId: block.id, cellId: cell.id },
        });
      }

      for (const referenceId of extractReferenceIdsFromValueExpression(
        cellBlock.correctValueSource,
      )) {
        if (!referenceIds.has(referenceId)) {
          issues.push({
            code: "missing_table_response_source",
            target: { blockId: block.id, cellId: cell.id, referenceId },
          });
        }
      }
    }
  }

  return issues;
}
