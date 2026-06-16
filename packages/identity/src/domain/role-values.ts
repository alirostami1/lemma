import type { Brand } from "@lemma/domain";
import { InvalidDomainValueError } from "./errors.js";
import { assertMaxLength, assertNonEmptyString } from "./primitives.js";

export type RoleName = Brand<string, "RoleName">;
export type RoleDescription = Brand<string, "RoleDescription">;
export type GlobalRoleKey = (typeof GLOBAL_ROLE_KEY_ACCEPTED_VALUES)[number];

export const MAX_ROLE_NAME_LENGTH = 150;
export const MAX_ROLE_DESCRIPTION_LENGTH = 500;
export const GLOBAL_ROLE_KEY_ACCEPTED_VALUES = [
  "admin",
  "member",
  "support",
  "teacher",
] as const;

export function globalRoleKey(value: string): GlobalRoleKey {
  if (!isGlobalRoleKey(value)) {
    throw new InvalidDomainValueError(
      `role must be one of ${GLOBAL_ROLE_KEY_ACCEPTED_VALUES}`,
    );
  }
  return value;
}

export function roleName(value: string): RoleName {
  const normalized = assertNonEmptyString(value, "roleName");
  return assertMaxLength(
    normalized,
    MAX_ROLE_NAME_LENGTH,
    "roleName",
  ) as RoleName;
}

export function roleDescription(value: string): RoleDescription {
  const normalized = assertNonEmptyString(value, "roleDescription");
  return assertMaxLength(
    normalized,
    MAX_ROLE_DESCRIPTION_LENGTH,
    "roleDescription",
  ) as RoleDescription;
}

function isGlobalRoleKey(value: string): value is GlobalRoleKey {
  return GLOBAL_ROLE_KEY_ACCEPTED_VALUES.includes(value as GlobalRoleKey);
}
