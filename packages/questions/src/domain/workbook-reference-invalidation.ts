import { extractInlineBlueprintReferences } from "./blueprint-document/inline-blueprint.js";
import type { QuestionBlueprintDocument } from "./question-blueprint-document.js";
import type {
  BlueprintInlineContent,
  RangeCellOffset,
  RichContent,
  RichContentNode,
  RichListItemNode,
  RichTextNode,
} from "./question-body.js";
import type { QuestionReference } from "./question-reference.js";
import {
  type ParsedStructuredWorkbookReference,
  parseQuestionReferenceSourceWorkbookRef,
} from "./reference-key.js";
import type {
  QuestionWorkbookReferenceTargetAvailability,
  QuestionWorkbookReferenceTargetSheet,
  QuestionWorkbookReferenceTargets,
} from "./workbook-reference-targets.js";

export type UsedWorkbookReferenceUsage = {
  referenceId: string;
  sourceId: string;
  sourceRef: string;
  sourceType: "workbook_cell" | "workbook_range";
  rangeCell?: RangeCellOffset;
  location:
    | "text_inline"
    | "rich_text_inline"
    | "table_content_inline"
    | "response_correct_value"
    | "table_response_correct_value";
};

export type AffectedInsertedValue = {
  label: string;
  problem: string;
};

export type WorkbookReferenceInvalidationResult =
  | { status: "valid" }
  | {
      status: "invalid";
      affectedInsertedValues: readonly AffectedInsertedValue[];
    };

type CollectedUsage = {
  reference: QuestionReference | null;
  usage: UsedWorkbookReferenceUsage;
};

type CellPosition = {
  row: number;
  column: number;
};

export function checkWorkbookReferenceInvalidation(input: {
  document: QuestionBlueprintDocument;
  sourceId: string;
  targetAvailability: QuestionWorkbookReferenceTargetAvailability;
}): WorkbookReferenceInvalidationResult {
  const usedReferences = workbookReferencesUsedByDocument(
    input.document,
    input.sourceId,
  );

  if (usedReferences.length === 0) {
    return { status: "valid" };
  }

  const affected: AffectedInsertedValue[] = [];

  if (input.targetAvailability.status === "unavailable") {
    for (const used of usedReferences) {
      const parsed =
        used.reference?.source.type === "workbook_cell" ||
        used.reference?.source.type === "workbook_range"
          ? parseQuestionReferenceSourceWorkbookRef(used.reference.source)
          : null;
      affected.push({
        label: userFacingInsertedValueLabel(
          used.reference,
          parsed?.status === "parsed" ? parsed.parts : null,
        ),
        problem: problemForUnavailableTargets(input.targetAvailability.reason),
      });
    }
    return invalidResult(affected);
  }

  for (const used of usedReferences) {
    const reference = used.reference;
    if (!reference) {
      affected.push({
        label: "Inserted workbook value",
        problem: "This inserted value could not be checked.",
      });
      continue;
    }
    if (
      reference.source.type !== "workbook_cell" &&
      reference.source.type !== "workbook_range"
    ) {
      affected.push({
        label: userFacingInsertedValueLabel(reference, null),
        problem: "This inserted value could not be checked.",
      });
      continue;
    }

    const parsed = parseQuestionReferenceSourceWorkbookRef(reference.source);
    if (parsed.status === "invalid") {
      affected.push({
        label: userFacingInsertedValueLabel(reference, null),
        problem: "This inserted value could not be checked.",
      });
      continue;
    }

    const invalidation = invalidationForUsage(
      parsed.parts,
      used.usage,
      input.targetAvailability.targets,
    );
    if (!invalidation) continue;

    affected.push({
      label: userFacingInsertedValueLabel(reference, parsed.parts),
      problem: invalidation.problem,
    });
  }

  return affected.length === 0 ? { status: "valid" } : invalidResult(affected);
}

function workbookReferencesUsedByDocument(
  document: QuestionBlueprintDocument,
  sourceId: string,
): CollectedUsage[] {
  const referencesById = new Map(
    document.references.map((reference) => [reference.id, reference]),
  );
  const used: CollectedUsage[] = [];

  const collect = (
    referenceId: string,
    location: UsedWorkbookReferenceUsage["location"],
    rangeCell?: RangeCellOffset,
  ) => {
    const reference = referencesById.get(referenceId) ?? null;
    if (!reference) {
      used.push({
        reference,
        usage: {
          referenceId,
          sourceId,
          sourceRef: "",
          sourceType: "workbook_cell",
          ...(rangeCell === undefined ? {} : { rangeCell }),
          location,
        },
      });
      return;
    }
    if (
      reference.source.type !== "workbook_cell" &&
      reference.source.type !== "workbook_range"
    ) {
      return;
    }
    if (reference.source.sourceId !== sourceId) {
      return;
    }
    used.push({
      reference,
      usage: {
        referenceId,
        sourceId: reference.source.sourceId,
        sourceRef: reference.source.ref,
        sourceType: reference.source.type,
        ...(rangeCell === undefined ? {} : { rangeCell }),
        location,
      },
    });
  };

  for (const block of document.blocks) {
    if (block.type === "text") {
      collectInlineReferences(block.content, "text_inline", collect);
      continue;
    }
    if (block.type === "rich_text") {
      collectRichTextReferences(block.content, collect);
      continue;
    }
    if (block.type === "response") {
      if (block.correctValueSource?.type === "reference") {
        collect(block.correctValueSource.referenceId, "response_correct_value");
      }
      continue;
    }
    if (block.type === "table") {
      for (const cell of block.cells) {
        if (cell.type === "content") {
          collectInlineReferences(
            cell.content,
            "table_content_inline",
            collect,
          );
        } else if (cell.correctValueSource?.type === "reference") {
          collect(
            cell.correctValueSource.referenceId,
            "table_response_correct_value",
          );
        }
      }
    }
  }

  return used;
}

function collectRichTextReferences(
  content: RichContent,
  collect: (
    referenceId: string,
    location: UsedWorkbookReferenceUsage["location"],
    rangeCell?: RangeCellOffset,
  ) => void,
): void {
  for (const node of content.content) {
    collectRichContentNodeReferences(node, collect);
  }
}

function collectRichContentNodeReferences(
  node: RichContentNode,
  collect: (
    referenceId: string,
    location: UsedWorkbookReferenceUsage["location"],
    rangeCell?: RangeCellOffset,
  ) => void,
): void {
  if (node.type === "paragraph" || node.type === "heading") {
    collectRichInlineReferences(node.content ?? [], collect);
    return;
  }
  for (const item of node.content) {
    collectRichListItemReferences(item, collect);
  }
}

function collectRichListItemReferences(
  item: RichListItemNode,
  collect: (
    referenceId: string,
    location: UsedWorkbookReferenceUsage["location"],
    rangeCell?: RangeCellOffset,
  ) => void,
): void {
  for (const child of item.content) {
    if (child.type === "paragraph") {
      collectRichInlineReferences(child.content ?? [], collect);
      continue;
    }
    for (const nested of child.content) {
      collectRichListItemReferences(nested, collect);
    }
  }
}

function collectRichInlineReferences(
  content: readonly RichTextNode[],
  collect: (
    referenceId: string,
    location: UsedWorkbookReferenceUsage["location"],
    rangeCell?: RangeCellOffset,
  ) => void,
): void {
  for (const node of content) {
    for (const reference of extractInlineBlueprintReferences(node.text)) {
      collect(reference.referenceId, "rich_text_inline", reference.rangeCell);
    }
  }
}

function collectInlineReferences(
  content: readonly BlueprintInlineContent[],
  location: UsedWorkbookReferenceUsage["location"],
  collect: (
    referenceId: string,
    location: UsedWorkbookReferenceUsage["location"],
    rangeCell?: RangeCellOffset,
  ) => void,
): void {
  for (const part of content) {
    if (part.type === "reference") {
      collect(part.referenceId, location, part.rangeCell);
    }
  }
}

function invalidationForUsage(
  parts: ParsedStructuredWorkbookReference,
  usage: UsedWorkbookReferenceUsage,
  targets: QuestionWorkbookReferenceTargets,
): { problem: string } | null {
  const sheet = findSheet(targets, parts.sheetName);
  if (!sheet) {
    return { problem: "The workbook sheet is no longer available." };
  }

  if (usage.rangeCell) {
    if (parts.kind !== "range" || usage.sourceType !== "workbook_range") {
      return {
        problem: "This inserted range cell no longer resolves to a range.",
      };
    }
    const targetCell = rangeCellTarget(parts, usage.rangeCell);
    if (!targetCell) {
      return {
        problem: "This inserted range cell is outside the referenced range.",
      };
    }
    return isCellAvailable(sheet, targetCell)
      ? null
      : {
          problem:
            "This inserted range cell is no longer available in the workbook.",
        };
  }

  if (parts.kind === "cell") {
    return isCellAvailable(sheet, parts.startCell)
      ? null
      : { problem: "The referenced cell is no longer available." };
  }

  return isRangeAvailable(sheet, parts.startCell, parts.endCell)
    ? null
    : { problem: "The referenced range is no longer available." };
}

function rangeCellTarget(
  parts: Extract<ParsedStructuredWorkbookReference, { kind: "range" }>,
  rangeCell: RangeCellOffset,
): string | null {
  const start = cellPosition(parts.startCell);
  const end = cellPosition(parts.endCell);
  if (!start || !end) return null;
  const rowCount = end.row - start.row + 1;
  const columnCount = end.column - start.column + 1;
  if (
    rangeCell.rowOffset < 0 ||
    rangeCell.columnOffset < 0 ||
    rangeCell.rowOffset >= rowCount ||
    rangeCell.columnOffset >= columnCount
  ) {
    return null;
  }
  return formatCellPosition({
    column: start.column + rangeCell.columnOffset,
    row: start.row + rangeCell.rowOffset,
  });
}

function findSheet(
  targets: QuestionWorkbookReferenceTargets,
  sheetName: string,
): QuestionWorkbookReferenceTargetSheet | null {
  const normalized = sheetName.trim().toLowerCase();
  return (
    targets.sheets.find(
      (sheet) => sheet.name.trim().toLowerCase() === normalized,
    ) ?? null
  );
}

function isCellAvailable(
  sheet: QuestionWorkbookReferenceTargetSheet,
  cell: string,
): boolean {
  const position = cellPosition(cell);
  if (!position) return false;
  if (
    position.row > sheet.dimensions.rowCount ||
    position.column > sheet.dimensions.columnCount
  ) {
    return false;
  }
  // V1 valueCells metadata represents referenceable value/output cells. Direct
  // inserted cells and rangeCell usages must continue to point at one of those
  // cells when the workbook boundary can provide that metadata.
  if (!sheet.valueCells) return true;
  return normalizedCellSet(sheet).has(normalizeCellAddress(cell));
}

function isRangeAvailable(
  sheet: QuestionWorkbookReferenceTargetSheet,
  startCell: string,
  endCell: string,
): boolean {
  const start = cellPosition(startCell);
  const end = cellPosition(endCell);
  if (!start || !end) return false;
  if (
    end.row > sheet.dimensions.rowCount ||
    end.column > sheet.dimensions.columnCount
  ) {
    return false;
  }
  // Whole-range preservation is dimensional in v1. Sparse workbook values omit
  // blanks, so requiring every cell in a range to be listed would reject valid
  // ranges that still exist but contain blank cells.
  return true;
}

function normalizedCellSet(
  sheet: QuestionWorkbookReferenceTargetSheet,
): ReadonlySet<string> {
  return new Set((sheet.valueCells ?? []).map(normalizeCellAddress));
}

function problemForUnavailableTargets(
  reason: Exclude<
    QuestionWorkbookReferenceTargetAvailability,
    { status: "available" }
  >["reason"],
): string {
  if (reason === "pending_validation") {
    return "The new workbook has not been checked yet.";
  }
  if (reason === "invalid_workbook") {
    return "The new workbook could not be read.";
  }
  return "The new workbook could not be checked for this inserted value.";
}

function userFacingInsertedValueLabel(
  reference: QuestionReference | null,
  parts: ParsedStructuredWorkbookReference | null,
): string {
  if (reference?.label?.trim()) {
    return reference.label.trim();
  }
  if (!parts) {
    return "Inserted workbook value";
  }
  const target =
    parts.kind === "cell"
      ? `${parts.sheetName} ${parts.startCell}`
      : `${parts.sheetName} ${parts.startCell}:${parts.endCell}`;
  return `Inserted value from ${target}`;
}

function invalidResult(
  affected: readonly AffectedInsertedValue[],
): WorkbookReferenceInvalidationResult {
  return {
    affectedInsertedValues: dedupeAffectedInsertedValues(affected),
    status: "invalid",
  };
}

function dedupeAffectedInsertedValues(
  affected: readonly AffectedInsertedValue[],
): AffectedInsertedValue[] {
  const seen = new Set<string>();
  const deduped: AffectedInsertedValue[] = [];
  for (const item of affected) {
    const key = `${item.label}\n${item.problem}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
}

function cellPosition(cell: string): CellPosition | null {
  const match = normalizeCellAddress(cell).match(
    /^([A-Z]{1,3})([1-9][0-9]*)$/u,
  );
  if (!match) return null;
  return {
    column: columnLabelToNumber(match[1] ?? ""),
    row: Number(match[2] ?? "0"),
  };
}

function formatCellPosition(input: CellPosition): string {
  return `${columnNumberToLabel(input.column)}${input.row}`;
}

function normalizeCellAddress(cell: string): string {
  return cell.replace(/\$/gu, "").trim().toUpperCase();
}

function columnLabelToNumber(label: string): number {
  let value = 0;
  for (const char of label) {
    value = value * 26 + char.charCodeAt(0) - 64;
  }
  return value;
}

function columnNumberToLabel(column: number): string {
  let value = column;
  let label = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }
  return label;
}
