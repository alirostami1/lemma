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
