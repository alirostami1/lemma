import type {
  QuestionReference,
  QuestionReferenceSource,
  QuestionResponseField,
  QuestionValueExpression,
  RenderedInlineContent,
  RichContent,
  RichHeadingNode,
  RichListItemNode,
  RichParagraphNode,
  RichTextNode,
} from "#/api/generated/model";
import type {
  ComposedReferenceDraft,
  ComposedResponseField,
  ComposedRichContent,
  ComposedRichContentNode,
  ComposedRichListItem,
} from "../composed-model";
import type { ComposedInlineContent } from "../inline-content";
import { formatInlineBlueprint, parseInlineBlueprint } from "../inline-content";
import type {
  ReferenceSourceDraft,
  TableAnswerValue,
  TableResponseField,
  ValueExpression,
} from "../table-model";

export function pushUniqueResponseField(
  responseFields: QuestionResponseField[],
  ids: Set<string>,
  field: QuestionResponseField | ComposedResponseField,
) {
  if (!field.id) {
    throw new Error("Response field id must not be empty.");
  }
  if (ids.has(field.id)) {
    throw new Error(`Response field id ${field.id} is duplicated.`);
  }
  ids.add(field.id);
  responseFields.push({
    id: field.id,
    label: field.label,
    required: field.required,
    type: field.type,
  });
}

export function pushUniqueReference(
  references: QuestionReference[],
  ids: Set<string>,
  reference: QuestionReference,
) {
  if (!reference.id) {
    throw new Error("Reference id must not be empty.");
  }
  if (ids.has(reference.id)) {
    throw new Error(`Duplicate reference id: ${reference.id}`);
  }
  ids.add(reference.id);
  references.push(reference);
}

export function questionReferenceToComposedReferenceDraft(
  reference: QuestionReference,
): ComposedReferenceDraft {
  return {
    id: reference.id,
    ...(reference.label === undefined ? {} : { label: reference.label }),
    source: toReferenceSource(reference.source),
  };
}

export function questionResponseFieldToComposed(
  field: QuestionResponseField,
): ComposedResponseField {
  return {
    id: field.id,
    label: field.label,
    required: field.required,
    type: toSupportedResponseFieldType(field.type),
  };
}

export function questionResponseFieldToTable(
  field: QuestionResponseField,
): TableResponseField {
  return {
    id: field.id,
    label: field.label,
    required: field.required,
    type: toSupportedResponseFieldType(field.type),
  };
}

function toSupportedResponseFieldType(
  type: QuestionResponseField["type"],
): ComposedResponseField["type"] {
  if (type === "text" || type === "number" || type === "boolean") {
    return type;
  }
  throw new Error(`Unsupported response field type: ${type}`);
}

export function toQuestionReferenceSource(
  source: ReferenceSourceDraft,
): QuestionReferenceSource {
  switch (source.type) {
    case "literal":
      return {
        schemaVersion: 1,
        type: "literal",
        value: toTableAnswerValue(source.value),
      };
    case "workbook_cell":
      return {
        ref: source.ref,
        schemaVersion: 1,
        sourceId: source.sourceId,
        type: "workbook_cell",
      };
    case "workbook_range":
      return {
        ref: source.ref,
        schemaVersion: 1,
        sourceId: source.sourceId,
        type: "workbook_range",
      };
    default:
      return assertNever(source);
  }
}

export function toReferenceSource(
  source: QuestionReferenceSource,
): ReferenceSourceDraft {
  switch (source.type) {
    case "literal":
      return { type: "literal", value: toTableAnswerValue(source.value) };
    case "workbook_cell":
      return {
        ref: source.ref,
        sourceId: source.sourceId,
        type: "workbook_cell",
      };
    case "workbook_range":
      return {
        ref: source.ref,
        sourceId: source.sourceId,
        type: "workbook_range",
      };
    default:
      return assertNever(source);
  }
}

export function toQuestionValueExpression(
  source: ValueExpression,
): QuestionValueExpression {
  switch (source.type) {
    case "literal":
      return { schemaVersion: 1, type: "literal", value: source.value };
    case "reference":
      return {
        referenceId: source.referenceId,
        schemaVersion: 1,
        type: "reference",
      };
    default:
      return assertNever(source);
  }
}

export function toValueExpression(
  source: QuestionValueExpression,
): ValueExpression {
  switch (source.type) {
    case "literal":
      return { type: "literal", value: toTableAnswerValue(source.value) };
    case "reference":
      return { referenceId: source.referenceId, type: "reference" };
    default:
      return assertNever(source);
  }
}

export function renderedContentToText(content: RenderedInlineContent[]) {
  return content
    .map((item) =>
      item.type === "text" ? (item.text ?? "") : (item.displayValue ?? ""),
    )
    .join("");
}

export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}

export function composedRichContentToCanonicalRichContent(
  content: ComposedRichContent,
): RichContent {
  return {
    content: content.content.map(composedRichNodeToCanonical),
    type: "doc",
  };
}

function composedRichNodeToCanonical(
  node: ComposedRichContentNode,
): RichContent["content"][number] {
  if (node.type === "paragraph") {
    return paragraphNodeToCanonical(node.content);
  }
  if (node.type === "heading") {
    return headingNodeToCanonical(node.level, node.content);
  }
  return {
    content: node.items.map(composedRichListItemToCanonical),
    type: node.type,
  };
}

function composedRichListItemToCanonical(
  item: ComposedRichListItem,
): RichListItemNode {
  return {
    content: item.content.map(composedRichNodeToCanonicalListChild),
    type: "list_item",
  };
}

function composedRichNodeToCanonicalListChild(
  node: ComposedRichListItem["content"][number],
): RichListItemNode["content"][number] {
  if (node.type === "paragraph") {
    return paragraphNodeToCanonical(node.content);
  }
  return {
    content: node.items.map(composedRichListItemToCanonical),
    type: node.type,
  };
}

function paragraphNodeToCanonical(
  content: ComposedInlineContent[],
): RichParagraphNode {
  const text = formatInlineBlueprint(content);
  return text.length > 0
    ? {
        content: [{ text, type: "text" as const }],
        type: "paragraph",
      }
    : { type: "paragraph" };
}

function headingNodeToCanonical(
  level: 1 | 2 | 3,
  content: ComposedInlineContent[],
): RichHeadingNode {
  const text = formatInlineBlueprint(content);
  return text.length > 0
    ? {
        attrs: { level },
        content: [{ text, type: "text" as const }],
        type: "heading",
      }
    : { attrs: { level }, type: "heading" };
}

export function canonicalRichContentToComposed(
  content: RichContent,
): ComposedRichContent {
  return {
    content: content.content.map(canonicalRichNodeToComposed),
    type: "doc",
  };
}

function canonicalRichNodeToComposed(
  node: RichContent["content"][number],
): ComposedRichContentNode {
  if (node.type === "paragraph") {
    return {
      content: parseInlineBlueprint(readCanonicalRichText(node.content)),
      type: "paragraph" as const,
    };
  }
  if (node.type === "heading") {
    return {
      content: parseInlineBlueprint(readCanonicalRichText(node.content)),
      level: Math.min(3, Math.max(1, node.attrs.level)) as 1 | 2 | 3,
      type: "heading" as const,
    };
  }
  return {
    items: node.content.map(canonicalRichListItemToComposed),
    type: node.type,
  };
}

function canonicalRichListItemToComposed(
  item: RichListItemNode,
): ComposedRichListItem {
  return {
    content: item.content.map(canonicalRichListItemChildToComposed),
    type: "list_item",
  };
}

function canonicalRichListItemChildToComposed(
  child: RichListItemNode["content"][number],
): ComposedRichListItem["content"][number] {
  if (child.type === "paragraph") {
    return {
      content: parseInlineBlueprint(readCanonicalRichText(child.content)),
      type: "paragraph" as const,
    };
  }
  return {
    items: child.content.map(canonicalRichListItemToComposed),
    type: child.type,
  };
}

function readCanonicalRichText(content: RichTextNode[] | undefined) {
  return (content ?? []).map((node) => node.text).join("");
}

export function toCanonicalTableAnswerFieldId(
  tableBlockId: string,
  fieldId: string,
): string {
  return `${tableBlockId}_${fieldId}`;
}

export function fromCanonicalTableAnswerFieldId(
  tableBlockId: string,
  fieldId: string,
): string {
  const prefix = `${tableBlockId}_`;
  return fieldId.startsWith(prefix) ? fieldId.slice(prefix.length) : fieldId;
}

export function toCanonicalTableCellId(cellId: string): string {
  return cellId;
}

export function toTableAnswerValue(value: unknown): TableAnswerValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(toTableAnswerValue);
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        toTableAnswerValue(nested),
      ]),
    );
  }
  return null;
}

export function readAxisArray(value: unknown) {
  return readArray(value).map((item) => {
    const record = asRecord(item);
    return { id: readString(record.id), label: readString(record.label) };
  });
}

export function readArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map((item) => asRecord(item)) : [];
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    throw new Error("Expected object.");
  }
  return value as Record<string, unknown>;
}

export function readString(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Expected string.");
  }
  return value;
}
