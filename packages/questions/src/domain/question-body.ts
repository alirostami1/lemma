import {
  assertArray,
  assertBoolean,
  assertInteger,
  assertNonEmptyString,
  assertPlainRecord,
  assertSchemaVersion,
  assertString,
  assertUniqueIds,
  oneOf,
  type PlainObject,
} from "./canonical-validation.js";
import { InvalidQuestionBodyError } from "./errors.js";
import {
  QUESTION_INPUT_TYPES,
  type QuestionInputPrimitive,
  type QuestionInputType,
  questionInputPrimitive,
} from "./question-input-primitive.js";
import { assertQuestionReferenceId } from "./question-reference.js";

export type QuestionResponseField = {
  id: string;
  type: QuestionInputType;
  label?: string;
  required?: boolean;
};

export type BlueprintInlineContent =
  | { type: "text"; text: string }
  | {
      type: "reference";
      referenceId: string;
      rangeCell?: RangeCellOffset;
      fallbackText?: string;
    };

export type RangeCellOffset = {
  rowOffset: number;
  columnOffset: number;
};

export type RenderedInlineContent =
  | { type: "text"; text: string }
  | { type: "value"; referenceId: string; displayValue: string };

export type RichContent = {
  type: "doc";
  content: RichContentNode[];
};

export type RichContentNode =
  | { type: "paragraph"; content?: RichTextNode[] }
  | {
      type: "heading";
      attrs: { level: 1 | 2 | 3 | 4 | 5 | 6 };
      content?: RichTextNode[];
    }
  | { type: "bullet_list"; content: RichListItemNode[] }
  | { type: "ordered_list"; content: RichListItemNode[] };

export type RichListItemNode = {
  type: "list_item";
  content: Array<
    | { type: "paragraph"; content?: RichTextNode[] }
    | { type: "bullet_list"; content: RichListItemNode[] }
    | { type: "ordered_list"; content: RichListItemNode[] }
  >;
};

export type RichTextNode = { type: "text"; text: string };

export type QuestionGrading =
  | { mode: "exact" }
  | {
      mode: "number";
      tolerance: { type: "absolute" | "relative"; value: number };
    }
  | { mode: "case_insensitive_text" }
  | { mode: "manual" };

export type QuestionTextBlock = {
  id: string;
  kind: "primitive";
  type: "text";
  content: RenderedInlineContent[];
};

export type QuestionRichTextBlock = {
  id: string;
  kind: "primitive";
  type: "rich_text";
  content: RichContent;
};

export type QuestionInputBlock = {
  id: string;
  kind: "primitive";
  type: "input";
  responseFieldId: string;
  input: QuestionInputPrimitive;
  label?: string;
  placeholder?: string;
};

export type QuestionSeparatorBlock = {
  id: string;
  kind: "primitive";
  type: "separator";
};

export type QuestionPrimitiveBlock =
  | QuestionTextBlock
  | QuestionRichTextBlock
  | QuestionInputBlock
  | QuestionSeparatorBlock;

export type QuestionContainerBlock = {
  id: string;
  kind: "container";
  type: "page" | "step";
  title?: string;
  blocks: QuestionBlock[];
};

export type QuestionTableCell = {
  id: string;
  rowId: string;
  columnId: string;
  blocks: QuestionPrimitiveBlock[];
};

export type QuestionTableBlock = {
  id: string;
  kind: "complex";
  type: "table";
  showColumnNames: boolean;
  showRowNames: boolean;
  columns: Array<{ id: string; label: string }>;
  rows: Array<{ id: string; label: string }>;
  cells: QuestionTableCell[];
};

export type QuestionComplexBlock = QuestionTableBlock;

export type QuestionBlock =
  | QuestionPrimitiveBlock
  | QuestionContainerBlock
  | QuestionComplexBlock;

export type QuestionBody = {
  schemaVersion: 2;
  blocks: QuestionBlock[];
  responseFields: QuestionResponseField[];
};

export function questionBody(input: unknown): QuestionBody {
  assertPlainRecord(input, "question body must be an object", fail);
  assertSchemaVersion(input, fail, 2);
  const responseFields = validatedResponseFields(input, fail);
  const responseFieldsById = new Map(
    responseFields.map((field) => [field.id, field]),
  );
  const blocks = validatedBlocks(
    input,
    responseFieldsById,
    createBlockIdRegistry(),
    fail,
  );
  return {
    blocks,
    responseFields,
    schemaVersion: 2,
  };
}

export function validateResponseFields(
  value: PlainObject & { responseFields?: unknown },
  failWith: (message: string) => never,
): asserts value is PlainObject & { responseFields: QuestionResponseField[] } {
  validatedResponseFields(value, failWith);
}

export function validatedResponseFields(
  value: PlainObject & { responseFields?: unknown },
  failWith: (message: string) => never,
): QuestionResponseField[] {
  assertArray(value.responseFields, "responseFields", failWith);
  assertUniqueIds(value.responseFields, "responseFields", failWith);
  return value.responseFields.map((field) => {
    assertPlainRecord(field, "response field must be an object", failWith);
    const type = oneOf(
      field.type,
      QUESTION_INPUT_TYPES,
      "response field type",
      failWith,
    );
    if (field.label !== undefined) {
      assertString(field.label, "response field label", failWith);
    }
    if (field.required !== undefined) {
      assertBoolean(field.required, "response field required", failWith);
    }
    return {
      id: field.id,
      type,
      ...(field.label === undefined ? {} : { label: field.label }),
      ...(field.required === undefined ? {} : { required: field.required }),
    };
  });
}

export function validatedBlocks(
  value: PlainObject & { blocks?: unknown },
  responseFieldsById: ReadonlyMap<string, QuestionResponseField>,
  blockIds: BlockIdRegistry,
  failWith: (message: string) => never,
): QuestionBlock[] {
  assertArray(value.blocks, "blocks", failWith);
  return value.blocks.map((block) =>
    validatedBlock(block, responseFieldsById, blockIds, failWith),
  );
}

function validatedBlock(
  block: unknown,
  responseFieldsById: ReadonlyMap<string, QuestionResponseField>,
  blockIds: BlockIdRegistry,
  failWith: (message: string) => never,
): QuestionBlock {
  assertPlainRecord(block, "block must be an object", failWith);
  assertNonEmptyString(block.id, "block.id", failWith);
  blockIds.register(block.id, "block", failWith);
  if (block.kind === "primitive") {
    return validatedPrimitiveBlock(block, responseFieldsById, failWith);
  }
  if (block.kind === "container") {
    return validatedContainerBlock(
      block,
      responseFieldsById,
      blockIds,
      failWith,
    );
  }
  if (block.kind === "complex" && block.type === "table") {
    return validatedTableBlock(block, responseFieldsById, blockIds, failWith);
  }
  failWith("block kind or type is invalid");
}

function validatedPrimitiveBlock(
  block: PlainObject,
  responseFieldsById: ReadonlyMap<string, QuestionResponseField>,
  failWith: (message: string) => never,
): QuestionPrimitiveBlock {
  if (block.type === "text") {
    return {
      content: renderedInlineContent(block.content, failWith),
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
    return validatedInputBlock(block, responseFieldsById, failWith);
  }
  if (block.type === "separator") {
    return { id: block.id as string, kind: "primitive", type: "separator" };
  }
  failWith("primitive block type is invalid");
}

function validatedContainerBlock(
  block: PlainObject,
  responseFieldsById: ReadonlyMap<string, QuestionResponseField>,
  blockIds: BlockIdRegistry,
  failWith: (message: string) => never,
): QuestionContainerBlock {
  const type = block.type;
  if (type !== "page" && type !== "step") {
    failWith("container block type is invalid");
  }
  if (block.title !== undefined) {
    assertString(block.title, "container.title", failWith);
  }
  return {
    blocks: validatedBlocks(block, responseFieldsById, blockIds, failWith),
    id: block.id as string,
    kind: "container",
    ...(block.title === undefined ? {} : { title: block.title }),
    type,
  };
}

function validatedInputBlock(
  block: PlainObject,
  responseFieldsById: ReadonlyMap<string, QuestionResponseField>,
  failWith: (message: string) => never,
): QuestionInputBlock {
  assertNonEmptyString(block.responseFieldId, "responseFieldId", failWith);
  const responseField = responseFieldsById.get(block.responseFieldId);
  if (!responseField) {
    failWith(
      `input block ${block.id} references unknown response field ${block.responseFieldId}`,
    );
  }
  const input = questionInputPrimitive(
    block.input,
    {
      required: responseField.required,
      type: responseField.type,
    },
    failWith,
  );
  if (input.type !== responseField.type) {
    failWith(
      `input block ${block.id} type must match response field ${responseField.id}`,
    );
  }
  return {
    id: block.id as string,
    input,
    kind: "primitive",
    responseFieldId: block.responseFieldId,
    type: "input",
    ...optionalStringProps(block, ["label", "placeholder"], failWith),
  };
}

function validatedTableBlock(
  block: PlainObject,
  responseFieldsById: ReadonlyMap<string, QuestionResponseField>,
  blockIds: BlockIdRegistry,
  failWith: (message: string) => never,
): QuestionTableBlock {
  assertBoolean(block.showColumnNames, "table.showColumnNames", failWith);
  assertBoolean(block.showRowNames, "table.showRowNames", failWith);
  const columns = tableAxis(block.columns, "table.columns", failWith);
  const rows = tableAxis(block.rows, "table.rows", failWith);
  assertArray(block.cells, "table.cells", failWith);
  assertUniqueIds(block.cells, "table.cells", failWith);
  const columnIds = new Set(columns.map((column) => column.id));
  const rowIds = new Set(rows.map((row) => row.id));
  const positions = new Set<string>();
  const cells: QuestionTableCell[] = block.cells.map((cell) => {
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
        return validatedPrimitiveBlock(cellBlock, responseFieldsById, failWith);
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

export function blueprintInlineContent(
  value: unknown,
  failWith: (message: string) => never,
  referenceIds?: ReadonlySet<string>,
): BlueprintInlineContent[] {
  assertArray(value, "inline content", failWith);
  return value.map((part) => {
    assertPlainRecord(part, "inline content item must be an object", failWith);
    if (part.type === "text") {
      assertString(part.text, "inline text", failWith);
      return { text: part.text, type: "text" };
    }
    if (part.type === "reference") {
      assertQuestionReferenceId(
        part.referenceId,
        "inline reference referenceId",
        failWith,
      );
      if (referenceIds && !referenceIds.has(part.referenceId)) {
        failWith("inline reference uses unknown reference id");
      }
      if (part.fallbackText !== undefined) {
        assertString(
          part.fallbackText,
          "inline reference fallbackText",
          failWith,
        );
      }
      const rangeCell =
        part.rangeCell === undefined
          ? undefined
          : inlineReferenceRangeCell(part.rangeCell, failWith);
      return {
        referenceId: part.referenceId,
        type: "reference",
        ...(rangeCell === undefined ? {} : { rangeCell }),
        ...(part.fallbackText === undefined
          ? {}
          : { fallbackText: part.fallbackText }),
      };
    }
    return failWith("inline content type is invalid");
  });
}

function inlineReferenceRangeCell(
  value: unknown,
  failWith: (message: string) => never,
): RangeCellOffset {
  assertPlainRecord(
    value,
    "inline reference rangeCell must be an object",
    failWith,
  );
  assertInteger(
    value.rowOffset,
    "inline reference rangeCell.rowOffset",
    failWith,
  );
  assertInteger(
    value.columnOffset,
    "inline reference rangeCell.columnOffset",
    failWith,
  );
  if (value.rowOffset < 0 || value.columnOffset < 0) {
    failWith("inline reference rangeCell offsets must be non-negative");
  }
  return {
    columnOffset: value.columnOffset,
    rowOffset: value.rowOffset,
  };
}

export function renderedInlineContent(
  value: unknown,
  failWith: (message: string) => never,
): RenderedInlineContent[] {
  assertArray(value, "inline content", failWith);
  return value.map((part) => {
    assertPlainRecord(part, "inline content item must be an object", failWith);
    if (part.type === "text") {
      assertString(part.text, "inline text", failWith);
      return { text: part.text, type: "text" };
    }
    if (part.type === "value") {
      assertQuestionReferenceId(
        part.referenceId,
        "inline value referenceId",
        failWith,
      );
      assertString(part.displayValue, "inline value displayValue", failWith);
      return {
        displayValue: part.displayValue,
        referenceId: part.referenceId,
        type: "value",
      };
    }
    return failWith("inline content type is invalid");
  });
}

export function richContent(
  value: unknown,
  failWith: (message: string) => never,
): RichContent {
  assertPlainRecord(value, "rich content must be an object", failWith);
  if (value.type !== "doc") {
    failWith("rich content type must be doc");
  }
  assertArray(value.content, "rich content", failWith);
  return {
    content: value.content.map((node) => richBlockNode(node, failWith)),
    type: "doc",
  };
}

function richBlockNode(
  node: unknown,
  failWith: (message: string) => never,
): RichContentNode {
  assertPlainRecord(node, "rich node must be an object", failWith);
  if (node.type === "paragraph") {
    return { type: "paragraph", ...richTextContent(node, failWith) };
  }
  if (node.type === "heading") {
    assertPlainRecord(node.attrs, "heading attrs must be an object", failWith);
    if (![1, 2, 3, 4, 5, 6].includes(node.attrs.level as number)) {
      failWith("heading level must be 1 through 6");
    }
    return {
      attrs: { level: node.attrs.level as 1 | 2 | 3 | 4 | 5 | 6 },
      type: "heading",
      ...richTextContent(node, failWith),
    };
  }
  if (node.type === "bullet_list" || node.type === "ordered_list") {
    assertArray(node.content, "list content", failWith);
    return {
      content: node.content.map((item) => richListItem(item, failWith)),
      type: node.type,
    };
  }
  failWith("rich node type is invalid");
}

function richListItem(
  node: unknown,
  failWith: (message: string) => never,
): RichListItemNode {
  assertPlainRecord(node, "list item must be an object", failWith);
  if (node.type !== "list_item") {
    failWith("list content must contain list items");
  }
  assertArray(node.content, "list item content", failWith);
  return {
    content: node.content.map((child) => {
      assertPlainRecord(child, "list item child must be an object", failWith);
      if (child.type === "paragraph") {
        return { type: "paragraph", ...richTextContent(child, failWith) };
      }
      if (child.type === "bullet_list" || child.type === "ordered_list") {
        assertArray(child.content, "nested list content", failWith);
        return {
          content: child.content.map((item) => richListItem(item, failWith)),
          type: child.type,
        };
      }
      return failWith("list item child type is invalid");
    }),
    type: "list_item",
  };
}

function richTextContent(
  node: PlainObject,
  failWith: (message: string) => never,
): { content?: RichTextNode[] } {
  if (node.content === undefined) {
    return {};
  }
  assertArray(node.content, "rich text content", failWith);
  return {
    content: node.content.map((child) => {
      assertPlainRecord(child, "rich text must be an object", failWith);
      if (child.type !== "text") {
        failWith("rich inline node type is invalid");
      }
      assertString(child.text, "rich text", failWith);
      if ("marks" in child || "attrs" in child) {
        failWith("rich text marks and attrs are not supported");
      }
      return { text: child.text, type: "text" as const };
    }),
  };
}

export function grading(
  value: unknown,
  failWith: (message: string) => never,
): QuestionGrading {
  assertPlainRecord(value, "grading must be an object", failWith);
  if (value.mode === "number") {
    assertPlainRecord(
      value.tolerance,
      "number grading tolerance must be an object",
      failWith,
    );
    const toleranceType = oneOf(
      value.tolerance.type,
      ["absolute", "relative"] as const,
      "number grading tolerance type",
      failWith,
    );
    return {
      mode: "number",
      tolerance: {
        type: toleranceType,
        value: finiteNonNegativeNumber(
          value.tolerance.value,
          "number grading tolerance",
          failWith,
        ),
      },
    };
  }
  const mode = oneOf(
    value.mode,
    ["exact", "case_insensitive_text", "manual"] as const,
    "grading mode",
    failWith,
  );
  return { mode };
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

function optionalStringProps<T extends string>(
  value: PlainObject,
  keys: readonly T[],
  failWith: (message: string) => never,
): Partial<Record<T, string>> {
  const out: Partial<Record<T, string>> = {};
  for (const key of keys) {
    if (value[key] !== undefined) {
      assertString(value[key], key, failWith);
      out[key] = value[key];
    }
  }
  return out;
}

function finiteNonNegativeNumber(
  value: unknown,
  field: string,
  failWith: (message: string) => never,
): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    failWith(`${field} must be non-negative`);
  }
  return value;
}

function fail(message: string): never {
  throw new InvalidQuestionBodyError(message);
}
