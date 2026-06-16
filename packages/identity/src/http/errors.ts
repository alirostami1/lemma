import {
  DomainError,
  type HttpErrorCode,
  type HttpErrorResponse,
} from "@lemma/error";
import type { Context } from "hono";
import {
  ForbiddenIdentityActionError,
  InvalidDomainValueError,
  InvalidRoleGrantError,
  InvalidUserStateError,
  RoleNotFoundError,
  UserNotActiveError,
  UserNotFoundError,
} from "../domain/errors.js";
import type { IdentityAppEnv } from "./env.js";

export class InvalidIdentityRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidIdentityRequestError";
  }
}

export function handleIdentityError(
  c: Context<IdentityAppEnv>,
  error: unknown,
): Response {
  if (error instanceof ForbiddenIdentityActionError) {
    return c.json(forbidden(c, error.domainCode, error.message), 403);
  }

  if (error instanceof UserNotFoundError) {
    return c.json(notFound(c, "USER_NOT_FOUND", "User was not found."), 404);
  }

  if (error instanceof RoleNotFoundError) {
    return c.json(notFound(c, "ROLE_NOT_FOUND", "Role was not found."), 404);
  }

  if (error instanceof UserNotActiveError) {
    return c.json(forbidden(c, error.domainCode, "User is not active."), 403);
  }

  if (error instanceof InvalidDomainValueError) {
    return c.json(badRequest(c, "BAD_REQUEST", error.message), 400);
  }

  if (error instanceof InvalidRoleGrantError) {
    return c.json(badRequest(c, "BAD_REQUEST", error.message), 400);
  }

  if (error instanceof InvalidUserStateError) {
    return c.json(badRequest(c, "BAD_REQUEST", error.message), 400);
  }

  if (error instanceof DomainError) {
    return c.json(badRequest(c, "BAD_REQUEST", error.message), 400);
  }

  throw error;
}

export function badRequest(
  c: Context<IdentityAppEnv>,
  code: HttpErrorCode,
  message: string,
): HttpErrorResponse {
  return {
    error: {
      code,
      message,
      requestId: c.get("requestId"),
    },
  };
}

export function forbidden(
  c: Context<IdentityAppEnv>,
  code: HttpErrorCode,
  message: string,
): HttpErrorResponse {
  return {
    error: {
      code,
      message,
      requestId: c.get("requestId"),
    },
  };
}

export function notFound(
  c: Context<IdentityAppEnv>,
  code: HttpErrorCode,
  message: string,
): HttpErrorResponse {
  return {
    error: {
      code,
      message,
      requestId: c.get("requestId"),
    },
  };
}
