import type { Brand } from "@lemma/domain";
import { assertNonEmptyString, assertUuid } from "./primitives.js";

export type UserId = Brand<string, "UserId">;
export type RoleId = Brand<string, "RoleId">;
export type IdentityId = Brand<string, "IdentityId">;
export type SessionId = Brand<string, "SessionId">;

export function userId(value: string): UserId {
  return assertUuid(value, "userId") as UserId;
}

export function roleId(value: string): RoleId {
  return assertUuid(value, "roleId") as RoleId;
}

export function identityId(value: string): IdentityId {
  return assertNonEmptyString(value, "identityId") as IdentityId;
}

export function sessionId(value: string): SessionId {
  return assertNonEmptyString(value, "sessionId") as SessionId;
}
