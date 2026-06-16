import { assertUuidV7 } from "@lemma/domain";
import { InvalidDomainValueError } from "./errors.js";

export function assertNonEmptyString(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new InvalidDomainValueError(`${fieldName} must not be empty.`);
  }
  return normalized;
}

export function assertMaxLength(
  value: string,
  maxLength: number,
  fieldName: string,
): string {
  if (value.length > maxLength) {
    throw new InvalidDomainValueError(
      `${fieldName} must be at most ${maxLength} characters.`,
    );
  }
  return value;
}

export function assertUuid(value: string, fieldName: string): string {
  return assertUuidV7(value, fieldName, failDomainValue);
}

function failDomainValue(message: string): never {
  throw new InvalidDomainValueError(message);
}

export function assertJsonObjectCompatible(
  value: Record<string, unknown>,
  fieldName: string,
): Record<string, unknown> {
  if (!isJsonObject(value)) {
    throw new InvalidDomainValueError(
      `${fieldName} must be a JSON object-compatible value.`,
    );
  }
  return value;
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every(isJsonValue);
}

function isJsonValue(value: unknown): boolean {
  if (value === null) {
    return true;
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (typeof value === "string" || typeof value === "boolean") {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }
  return isJsonObject(value);
}
