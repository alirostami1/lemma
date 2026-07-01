import { isWorkbookRangeRef, parseWorkbookRef } from "../workbook-reference";
import type {
  ReferenceSourceDraft,
  TableAnswerValue,
  TableResponseField,
  ValueExpression,
} from "./table-model";

export function coerceAnswerValue(
  raw: string,
  field?: TableResponseField,
): TableAnswerValue {
  return field ? coerceByResponseFieldType(raw, field) : raw;
}

export function coerceLiteralExpressionValue(
  raw: string,
  field?: TableResponseField,
): TableAnswerValue {
  return field
    ? coerceByResponseFieldType(raw, field)
    : coerceLiteralValue(raw);
}

export function formatAnswerInputValue(value: TableAnswerValue | null) {
  if (value === null) {
    return "";
  }
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

export function isValueExpressionType(
  value: string,
): value is ValueExpression["type"] {
  return value === "literal" || value === "reference";
}

export function isReferenceSourceDraftType(
  value: string,
): value is ReferenceSourceDraft["type"] {
  return (
    value === "literal" ||
    value === "workbook_cell" ||
    value === "workbook_range"
  );
}

export function extractReferenceIdsFromValueExpression(
  value: ValueExpression | undefined,
): string[] {
  return value?.type === "reference" ? [value.referenceId] : [];
}

export function isValidWorkbookReferenceSource(
  source: ReferenceSourceDraft,
): boolean {
  if (source.type === "literal") {
    return source.type === "literal";
  }

  if (!source.sourceId) {
    return false;
  }

  const parsed = parseWorkbookRef(source.ref);
  if (!parsed) {
    return false;
  }

  return source.type === "workbook_range"
    ? isWorkbookRangeRef(parsed)
    : !isWorkbookRangeRef(parsed);
}

function coerceLiteralValue(value: string): TableAnswerValue {
  if (!value.length) {
    return null;
  }
  if (value.toLowerCase() === "true") {
    return true;
  }
  if (value.toLowerCase() === "false") {
    return false;
  }
  const parsed = Number(value);
  return value.trim() !== "" && Number.isFinite(parsed) ? parsed : value;
}

function coerceByResponseFieldType(
  raw: string,
  field?: TableResponseField,
): TableAnswerValue {
  switch (field?.type) {
    case "number": {
      if (raw === "") {
        return null;
      }
      if (
        raw === "-" ||
        raw.endsWith(".") ||
        raw.endsWith("+") ||
        raw.endsWith("-") ||
        raw.endsWith("e") ||
        raw.endsWith("E")
      ) {
        return raw;
      }
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : raw;
    }
    case "text":
      try {
        const trimmed = raw.trim();
        if (
          trimmed.length > 1 &&
          ((trimmed[0] === "{" && trimmed.endsWith("}")) ||
            (trimmed[0] === "[" && trimmed.endsWith("]")))
        ) {
          return JSON.parse(trimmed) as TableAnswerValue;
        }
      } catch {
        // Ignore parse failures and fall back to text mode.
      }
      return raw;
    case "select":
      return raw;
    default:
      return coerceLiteralValue(raw);
  }
}
