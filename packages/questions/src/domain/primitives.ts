import { assertUuidV7 } from "@lemma/domain";
import { InvalidQuestionFieldError } from "./errors.js";

export function assertUuid(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new InvalidQuestionFieldError(`${fieldName} must be a string.`);
  }
  return assertUuidV7(value, fieldName, failField);
}

export function assertNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new InvalidQuestionFieldError(`${fieldName} must be a string.`);
  }
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new InvalidQuestionFieldError(`${fieldName} must be non-empty.`);
  }
  return normalized;
}

export function assertMaxLength(
  value: unknown,
  maxLength: number,
  fieldName: string,
): string {
  if (typeof value !== "string") {
    throw new InvalidQuestionFieldError(`${fieldName} must be a string.`);
  }
  if (value.length > maxLength) {
    throw new InvalidQuestionFieldError(
      `${fieldName} must be at most ${maxLength} characters.`,
    );
  }
  return value;
}

export function assertNullableDescription(
  value: unknown,
  maxLength: number,
  fieldName: string,
): string | null {
  if (value === null) {
    return null;
  }
  return assertMaxLength(assertNonEmptyString(value, fieldName), maxLength, fieldName);
}

function failField(message: string): never {
  throw new InvalidQuestionFieldError(message);
}
