import type { JsonObject } from "@lemma/domain";

export function assertNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${fieldName} must be a non-empty string.`);
  }
  return value.trim();
}

export function assertPositiveInteger(value: unknown, fieldName: string): number {
  if (!Number.isInteger(value) || typeof value !== "number" || value <= 0) {
    throw new TypeError(`${fieldName} must be a positive integer.`);
  }
  return value;
}

export function assertDate(value: unknown, fieldName: string): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError(`${fieldName} must be a valid Date.`);
  }
  return value;
}

export function assertJsonObject(value: unknown, fieldName: string): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${fieldName} must be a JSON object.`);
  }
  return value as JsonObject;
}
