import {
  assertArray,
  assertBoolean,
  assertNonEmptyString,
  assertPlainRecord,
  assertSchemaVersion,
  assertString,
  assertUniqueIds,
  type PlainObject,
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
  type QuestionBlueprintInputPrimitive,
  questionBlueprintInputPrimitive,
} from "./question-input-primitive.js";
import {
  assertQuestionReferenceId,
  type QuestionReference,
  questionReferenceSource,
} from "./question-reference.js";
import {
  type QuestionValueExpression,
  questionValueExpression,
} from "./question-value-expression.js";
import { assertReferenceIdMatchesStructuredSource } from "./reference-key.js";

export type QuestionBlueprintTextBlock = {
  id: string;
  kind: "primitive";
  type: "text";
  content: BlueprintInlineContent[];
};

export type QuestionBlueprintRichTextBlock = {
  id: string;
  kind: "primitive";
  type: "rich_text";
  content: RichContent;
};

export type QuestionBlueprintInputBlock = {
  id: string;
  kind: "primitive";
  type: "input";
  responseFieldId: string;
  input: QuestionBlueprintInputPrimitive;
  label?: string;
  placeholder?: string;
  correctValueSource?: QuestionValueExpression;
  points: number;
  grading: QuestionGrading;
};

export type QuestionBlueprintSeparatorBlock = {
  id: string;
  kind: "primitive";
  type: "separator";
};

export type QuestionBlueprintPrimitiveBlock =
  | QuestionBlueprintTextBlock
  | QuestionBlueprintRichTextBlock
  | QuestionBlueprintInputBlock
  | QuestionBlueprintSeparatorBlock;

export type QuestionBlueprintContainerBlock = {
  id: string;
  kind: "container";
  type: "page" | "step";
  title?: string;
  blocks: QuestionBlueprintBlock[];
};

export type QuestionBlueprintTableCell = {
  id: string;
  rowId: string;
  columnId: string;
  blocks: QuestionBlueprintPrimitiveBlock[];
};

export type QuestionBlueprintTableBlock = {
  id: string;
  kind: "complex";
  type: "table";
  showColumnNames: boolean;
  showRowNames: boolean;
  columns: Array<{ id: string; label: string }>;
  rows: Array<{ id: string; label: string }>;
  cells: QuestionBlueprintTableCell[];
};

export type QuestionBlueprintComplexBlock = QuestionBlueprintTableBlock;

export type QuestionBlueprintBlock =
  | QuestionBlueprintPrimitiveBlock
  | QuestionBlueprintContainerBlock
  | QuestionBlueprintComplexBlock;

export type QuestionBlueprintDocument = {
  schemaVersion: 2;
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
  assertSchemaVersion(input, fail, 2);
  const responseFields = validatedResponseFields(input, fail);
  const responseFieldsById = new Map(
    responseFields.map((field) => [field.id, field]),
  );
  const references = validatedReferences(input.references, fail);
  const referenceIds = new Set(references.map((reference) => reference.id));
  const blocks = validatedBlueprintBlocks(
    input.blocks,
    responseFieldsById,
    referenceIds,
    createBlockIdRegistry(),
    fail,
  );
  return {
    blocks,
    references,
    responseFields,
    schemaVersion: 2,
  };
}

function validatedReferences(
  value: unknown,
  failWith: (message: string) => never,
): QuestionReference[] {
  assertArray(value, "references", failWith);
  assertUniqueIds(value, "references", failWith);
  return value.map((reference) => {
    assertPlainRecord(reference, "reference must be an object", failWith);
    if (reference.label !== undefined) {
      assertString(reference.label, "reference.label", failWith);
    }
    const source = questionReferenceSource(reference.source, failWith);
    if (source.type === "literal") {
      assertQuestionReferenceId(reference.id, "reference.id", failWith);
    } else {
      if (typeof reference.id !== "string" || reference.id.length === 0) {
        failWith("reference.id must be a non-empty string");
      }
      try {
        assertReferenceIdMatchesStructuredSource({
          referenceId: reference.id,
          source,
        });
      } catch (error) {
        failWith(
          error instanceof Error
            ? error.message
            : "workbook reference id must match structured source",
        );
      }
    }
    return {
      id: reference.id,
      ...(reference.label === undefined ? {} : { label: reference.label }),
      source,
    };
  });
}

function validatedBlueprintBlocks(
  blocks: unknown,
  responseFieldsById: ReadonlyMap<string, QuestionResponseField>,
  referenceIds: ReadonlySet<string>,
  blockIds: BlockIdRegistry,
  failWith: (message: string) => never,
): QuestionBlueprintBlock[] {
  assertArray(blocks, "blocks", failWith);
  return blocks.map((block) => {
    assertPlainRecord(block, "block must be an object", failWith);
    assertNonEmptyString(block.id, "block.id", failWith);
    blockIds.register(block.id, "block", failWith);
    if (block.kind === "primitive") {
      return validatedBlueprintPrimitiveBlock(
        block,
        responseFieldsById,
        referenceIds,
        failWith,
      );
    }
    if (block.kind === "container") {
      return validatedBlueprintContainerBlock(
        block,
        responseFieldsById,
        referenceIds,
        blockIds,
        failWith,
      );
    }
    if (block.kind === "complex" && block.type === "table") {
      return validatedBlueprintTableBlock(
        block,
        responseFieldsById,
        referenceIds,
        blockIds,
        failWith,
      );
    }
    return failWith("block kind or type is invalid");
  });
}

function validatedBlueprintPrimitiveBlock(
  block: PlainObject,
  responseFieldsById: ReadonlyMap<string, QuestionResponseField>,
  referenceIds: ReadonlySet<string>,
  failWith: (message: string) => never,
): QuestionBlueprintPrimitiveBlock {
  if (block.type === "text") {
    return {
      content: blueprintInlineContent(block.content, failWith, referenceIds),
      id: block.id as string,
      kind: "primitive",
      type: "text",
    };
  }
  if (block.type === "rich_text") {
    return {
      content: richContent(block.content, failWith),
      id: block.id as string,
      kind: "primitive",
      type: "rich_text",
    };
  }
  if (block.type === "input") {
    return validatedBlueprintInputBlock(
      block,
      responseFieldsById,
      referenceIds,
      failWith,
    );
  }
  if (block.type === "separator") {
    return { id: block.id as string, kind: "primitive", type: "separator" };
  }
  return failWith("primitive block type is invalid");
}

function validatedBlueprintContainerBlock(
  block: PlainObject,
  responseFieldsById: ReadonlyMap<string, QuestionResponseField>,
  referenceIds: ReadonlySet<string>,
  blockIds: BlockIdRegistry,
  failWith: (message: string) => never,
): QuestionBlueprintContainerBlock {
  const type = block.type;
  if (type !== "page" && type !== "step") {
    failWith("container block type is invalid");
  }
  if (block.title !== undefined) {
    assertString(block.title, "container.title", failWith);
  }
  return {
    blocks: validatedBlueprintBlocks(
      block.blocks,
      responseFieldsById,
      referenceIds,
      blockIds,
      failWith,
    ),
    id: block.id as string,
    kind: "container",
    ...(block.title === undefined ? {} : { title: block.title }),
    type,
  };
}

function validatedBlueprintInputBlock(
  block: PlainObject,
  responseFieldsById: ReadonlyMap<string, QuestionResponseField>,
  referenceIds: ReadonlySet<string>,
  failWith: (message: string) => never,
): QuestionBlueprintInputBlock {
  assertNonEmptyString(block.responseFieldId, "responseFieldId", failWith);
  const responseField = responseFieldsById.get(block.responseFieldId);
  if (!responseField) {
    failWith(
      `input block ${block.id} references unknown response field ${block.responseFieldId}`,
    );
  }
  const inputGrading = grading(block.grading, failWith);
  if (
    inputGrading.mode !== "manual" &&
    block.correctValueSource === undefined
  ) {
    failWith(`non-manual input block ${block.id} requires correctValueSource`);
  }
  const input = questionBlueprintInputPrimitive(
    block.input,
    {
      required: responseField.required,
      type: responseField.type,
    },
    failWith,
    referenceIds,
  );
  if (input.type !== responseField.type) {
    failWith(
      `input block ${block.id} type must match response field ${responseField.id}`,
    );
  }
  const out: QuestionBlueprintInputBlock = {
    grading: inputGrading,
    id: block.id as string,
    input,
    kind: "primitive",
    points: positiveNumber(block.points, "input block points", failWith),
    responseFieldId: block.responseFieldId,
    type: "input",
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
  responseFieldsById: ReadonlyMap<string, QuestionResponseField>,
  referenceIds: ReadonlySet<string>,
  blockIds: BlockIdRegistry,
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
    assertArray(cell.blocks, "table cell blocks", failWith);
    return {
      blocks: cell.blocks.map((cellBlock) => {
        assertPlainRecord(
          cellBlock,
          "table cell block must be an object",
          failWith,
        );
        assertNonEmptyString(cellBlock.id, "cell block.id", failWith);
        blockIds.register(
          cellBlock.id,
          `table cell ${cell.id} block`,
          failWith,
        );
        if (cellBlock.kind !== "primitive") {
          failWith("table cell blocks must be primitive blocks");
        }
        return validatedBlueprintPrimitiveBlock(
          cellBlock,
          responseFieldsById,
          referenceIds,
          failWith,
        );
      }),
      columnId: cell.columnId,
      id: cell.id,
      rowId: cell.rowId,
    };
  });
  return {
    cells,
    columns,
    id: block.id as string,
    kind: "complex",
    rows,
    showColumnNames: block.showColumnNames,
    showRowNames: block.showRowNames,
    type: "table",
  };
}

type BlockIdRegistry = {
  register(
    id: string,
    label: string,
    failWith: (message: string) => never,
  ): void;
};

function createBlockIdRegistry(): BlockIdRegistry {
  const ids = new Map<string, string>();
  return {
    register(id, label, failWith) {
      const existingLabel = ids.get(id);
      if (existingLabel !== undefined) {
        failWith(
          `block id ${id} is duplicated between ${existingLabel} and ${label}`,
        );
      }
      ids.set(id, label);
    },
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
