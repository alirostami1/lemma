import {
  assertArray,
  assertBoolean,
  assertNonEmptyString,
  assertPlainRecord,
  assertSchemaVersion,
  assertString,
  assertUniqueIds,
  type PlainObject,
  responseFieldIds,
} from "./canonical-validation.js";
import { InvalidQuestionBlueprintDocumentError } from "./errors.js";
import {
  type BlueprintInlineContent,
  blueprintInlineContent,
  grading,
  type QuestionGrading,
  type QuestionResponseField,
  type RichContent,
  richContent,
  validatedResponseFields,
} from "./question-body.js";
import {
  assertQuestionReferenceId,
  type QuestionReference,
  questionReferenceSource,
} from "./question-reference.js";
import {
  type QuestionValueExpression,
  questionValueExpression,
} from "./question-value-expression.js";

export type QuestionBlueprintTextBlock = {
  id: string;
  type: "text";
  content: BlueprintInlineContent[];
};

export type QuestionBlueprintRichTextBlock = {
  id: string;
  type: "rich_text";
  content: RichContent;
};

export type QuestionBlueprintResponseBlock = {
  id: string;
  type: "response";
  responseFieldId: string;
  label?: string;
  placeholder?: string;
  correctValueSource?: QuestionValueExpression;
  points: number;
  grading: QuestionGrading;
};

export type QuestionBlueprintSeparatorBlock = {
  id: string;
  type: "separator";
};

export type QuestionBlueprintTableCell =
  | {
      id: string;
      rowId: string;
      columnId: string;
      type: "content";
      content: BlueprintInlineContent[];
    }
  | {
      id: string;
      rowId: string;
      columnId: string;
      type: "response";
      responseFieldId: string;
      label?: string;
      placeholder?: string;
      correctValueSource?: QuestionValueExpression;
      points: number;
      grading: QuestionGrading;
    };

export type QuestionBlueprintTableBlock = {
  id: string;
  type: "table";
  showColumnNames: boolean;
  showRowNames: boolean;
  columns: Array<{ id: string; label: string }>;
  rows: Array<{ id: string; label: string }>;
  cells: QuestionBlueprintTableCell[];
};

export type QuestionBlueprintBlock =
  | QuestionBlueprintTextBlock
  | QuestionBlueprintRichTextBlock
  | QuestionBlueprintResponseBlock
  | QuestionBlueprintTableBlock
  | QuestionBlueprintSeparatorBlock;

export type QuestionBlueprintDocument = {
  schemaVersion: 1;
  blocks: QuestionBlueprintBlock[];
  responseFields: QuestionResponseField[];
  references: QuestionReference[];
};

export function questionBlueprintDocument(
  input: unknown,
): QuestionBlueprintDocument {
  assertPlainRecord(
    input,
    "question blueprint document must be an object",
    fail,
  );
  assertSchemaVersion(input, fail);
  const responseFields = validatedResponseFields(input, fail);
  const references = validatedReferences(input.references, fail);
  const referenceIds = new Set(references.map((reference) => reference.id));
  const blocks = validatedBlueprintBlocks(
    input.blocks,
    responseFieldIds(responseFields),
    referenceIds,
    fail,
  );
  return { schemaVersion: 1, blocks, responseFields, references };
}

function validatedReferences(
  value: unknown,
  failWith: (message: string) => never,
): QuestionReference[] {
  assertArray(value, "references", failWith);
  assertUniqueIds(value, "references", failWith);
  return value.map((reference) => {
    assertPlainRecord(reference, "reference must be an object", failWith);
    assertQuestionReferenceId(reference.id, "reference.id", failWith);
    if (reference.label !== undefined) {
      assertString(reference.label, "reference.label", failWith);
    }
    return {
      id: reference.id,
      ...(reference.label === undefined ? {} : { label: reference.label }),
      source: questionReferenceSource(reference.source, failWith),
    };
  });
}

function validatedBlueprintBlocks(
  blocks: unknown,
  responseIds: ReadonlySet<string>,
  referenceIds: ReadonlySet<string>,
  failWith: (message: string) => never,
): QuestionBlueprintBlock[] {
  assertArray(blocks, "blocks", failWith);
  assertUniqueIds(blocks, "blocks", failWith);
  return blocks.map((block) => {
    assertPlainRecord(block, "block must be an object", failWith);
    assertNonEmptyString(block.id, "block.id", failWith);
    if (block.type === "text") {
      return {
        id: block.id,
        type: "text",
        content: blueprintInlineContent(block.content, failWith, referenceIds),
      };
    }
    if (block.type === "rich_text") {
      return {
        id: block.id,
        type: "rich_text",
        content: richContent(block.content, failWith),
      };
    }
    if (block.type === "response") {
      return validatedBlueprintResponseBlock(
        block,
        responseIds,
        referenceIds,
        failWith,
      );
    }
    if (block.type === "separator") {
      return { id: block.id, type: "separator" };
    }
    if (block.type === "table") {
      return validatedBlueprintTableBlock(
        block,
        responseIds,
        referenceIds,
        failWith,
      );
    }
    return failWith("block type is invalid");
  });
}

function validatedBlueprintResponseBlock(
  block: PlainObject,
  responseIds: ReadonlySet<string>,
  referenceIds: ReadonlySet<string>,
  failWith: (message: string) => never,
): QuestionBlueprintResponseBlock {
  assertNonEmptyString(block.responseFieldId, "responseFieldId", failWith);
  if (!responseIds.has(block.responseFieldId)) {
    failWith("response block references unknown response field");
  }
  const out: QuestionBlueprintResponseBlock = {
    id: block.id as string,
    type: "response",
    responseFieldId: block.responseFieldId,
    points: positiveNumber(block.points, "response block points", failWith),
    grading: grading(block.grading, failWith),
  };
  addOptionalStrings(out, block, ["label", "placeholder"], failWith);
  if (block.correctValueSource !== undefined) {
    out.correctValueSource = questionValueExpression(
      block.correctValueSource,
      failWith,
      referenceIds,
    );
  }
  return out;
}

function validatedBlueprintTableBlock(
  block: PlainObject,
  responseIds: ReadonlySet<string>,
  referenceIds: ReadonlySet<string>,
  failWith: (message: string) => never,
): QuestionBlueprintTableBlock {
  assertBoolean(block.showColumnNames, "table.showColumnNames", failWith);
  assertBoolean(block.showRowNames, "table.showRowNames", failWith);
  const columns = tableAxis(block.columns, "table.columns", failWith);
  const rows = tableAxis(block.rows, "table.rows", failWith);
  assertArray(block.cells, "table.cells", failWith);
  assertUniqueIds(block.cells, "table.cells", failWith);
  const columnIds = new Set(columns.map((column) => column.id));
  const rowIds = new Set(rows.map((row) => row.id));
  const positions = new Set<string>();
  const cells: QuestionBlueprintTableCell[] = block.cells.map((cell) => {
    assertPlainRecord(cell, "table cell must be an object", failWith);
    assertNonEmptyString(cell.rowId, "cell.rowId", failWith);
    assertNonEmptyString(cell.columnId, "cell.columnId", failWith);
    if (!rowIds.has(cell.rowId) || !columnIds.has(cell.columnId)) {
      failWith("table cell references unknown row or column");
    }
    const position = `${cell.rowId}:${cell.columnId}`;
    if (positions.has(position)) {
      failWith("table cells must be unique by rowId and columnId");
    }
    positions.add(position);
    if (cell.type === "content") {
      return {
        id: cell.id,
        rowId: cell.rowId,
        columnId: cell.columnId,
        type: "content" as const,
        content: blueprintInlineContent(cell.content, failWith, referenceIds),
      };
    }
    if (cell.type === "response") {
      assertNonEmptyString(cell.responseFieldId, "responseFieldId", failWith);
      if (!responseIds.has(cell.responseFieldId)) {
        failWith("response cell references unknown response field");
      }
      const out: Extract<QuestionBlueprintTableCell, { type: "response" }> = {
        id: cell.id,
        rowId: cell.rowId,
        columnId: cell.columnId,
        type: "response",
        responseFieldId: cell.responseFieldId,
        points: positiveNumber(cell.points, "response cell points", failWith),
        grading: grading(cell.grading, failWith),
      };
      addOptionalStrings(out, cell, ["label", "placeholder"], failWith);
      if (cell.correctValueSource !== undefined) {
        out.correctValueSource = questionValueExpression(
          cell.correctValueSource,
          failWith,
          referenceIds,
        );
      }
      return out;
    }
    return failWith("table cell type is invalid");
  });
  return {
    id: block.id as string,
    type: "table",
    showColumnNames: block.showColumnNames,
    showRowNames: block.showRowNames,
    columns,
    rows,
    cells,
  };
}

function tableAxis(
  value: unknown,
  label: string,
  failWith: (message: string) => never,
) {
  assertArray(value, label, failWith);
  assertUniqueIds(value, label, failWith);
  return value.map((item) => {
    assertPlainRecord(item, `${label} item must be an object`, failWith);
    assertNonEmptyString(item.label, `${label} label`, failWith);
    return { id: item.id, label: item.label };
  });
}

function addOptionalStrings<T extends object, K extends string>(
  out: T,
  input: PlainObject,
  keys: readonly K[],
  failWith: (message: string) => never,
): void {
  for (const key of keys) {
    if (input[key] !== undefined) {
      assertString(input[key], key, failWith);
      Object.assign(out, { [key]: input[key] });
    }
  }
}

function positiveNumber(
  value: unknown,
  field: string,
  failWith: (message: string) => never,
): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    failWith(`${field} must be positive`);
  }
  return value;
}

function fail(message: string): never {
  throw new InvalidQuestionBlueprintDocumentError(message);
}
