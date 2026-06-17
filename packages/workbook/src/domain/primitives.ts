import { assertUuidV7, type JsonValue } from "@lemma/domain";
import { InvalidWorkbookFieldError } from "./errors.js";

export function assertUuid(value: string, fieldName: string): string {
  return assertUuidV7(value, fieldName, failWorkbookField);
}

function failWorkbookField(message: string): never {
  throw new InvalidWorkbookFieldError(message);
}

export function assertNonEmptyString(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new InvalidWorkbookFieldError(`${fieldName} must be non-empty.`);
  }
  return normalized;
}

export function assertMaxLength(
  value: string,
  maxLength: number,
  fieldName: string,
): string {
  if (value.length > maxLength) {
    throw new InvalidWorkbookFieldError(
      `${fieldName} must be at most ${maxLength} characters.`,
    );
  }
  return value;
}

export function oneOf<const Values extends readonly string[]>(
  value: string,
  values: Values,
  fieldName: string,
): Values[number] {
  if (!(values as readonly string[]).includes(value)) {
    throw new InvalidWorkbookFieldError(
      `${fieldName} should be one of ${values.join(", ")}.`,
    );
  }
  return value as Values[number];
}

export function assertJsonValue(value: unknown, fieldName: string): JsonValue {
  if (!isJsonValue(value)) {
    throw new InvalidWorkbookFieldError(
      `${fieldName} must be JSON-compatible.`,
    );
  }
  return value;
}

export function assertNonNegativeInteger(
  value: number,
  fieldName: string,
): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new InvalidWorkbookFieldError(
      `${fieldName} must be a non-negative integer.`,
    );
  }
  return value;
}

function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return typeof value !== "number" || Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }
  if (typeof value === "object") {
    return Object.values(value).every(isJsonValue);
  }
  return false;
}
