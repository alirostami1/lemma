import type { Brand } from "@lemma/domain";
import { InvalidDomainValueError } from "./errors.js";
import { assertMaxLength, assertNonEmptyString } from "./primitives.js";

export type EmailAddress = Brand<string, "EmailAddress">;
export type DisplayName = Brand<string, "DisplayName">;

export const MAX_DISPLAY_NAME_LENGTH = 150;
export const USER_STATUS_ACCEPTED_VALUES = [
  "active",
  "disabled",
  "deleted",
] as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export function emailAddress(value: string): EmailAddress {
  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) {
    throw new InvalidDomainValueError("email must not be empty.");
  }
  if (!EMAIL_PATTERN.test(normalized)) {
    throw new InvalidDomainValueError("email must be a valid email address.");
  }
  return normalized as EmailAddress;
}

export function displayName(value: string): DisplayName {
  const normalized = assertNonEmptyString(value, "displayName");
  return assertMaxLength(
    normalized,
    MAX_DISPLAY_NAME_LENGTH,
    "displayName",
  ) as DisplayName;
}

export type UserStatus = (typeof USER_STATUS_ACCEPTED_VALUES)[number];

export function userStatus(value: string): UserStatus {
  if (!isUserStatus(value)) {
    throw new InvalidDomainValueError(
      `user status should be one of ${USER_STATUS_ACCEPTED_VALUES}`,
    );
  }
  return value;
}

function isUserStatus(value: string): value is UserStatus {
  return USER_STATUS_ACCEPTED_VALUES.includes(value as UserStatus);
}
