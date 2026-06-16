import type { Context } from "hono";
import {
  ForbiddenOpsActionError,
  InvalidOpsRequestError,
  OpsOutboxEventNotFoundError,
} from "../application/index.js";
import type { OpsAppEnv } from "./env.js";

export function handleOpsError(
  c: Context<OpsAppEnv>,
  error: unknown,
): Response {
  if (error instanceof ForbiddenOpsActionError) {
    return c.json(errorResponse(c, error.code, error.message), 403);
  }
  if (error instanceof InvalidOpsRequestError) {
    return c.json(errorResponse(c, error.code, error.message), 400);
  }
  if (error instanceof OpsOutboxEventNotFoundError) {
    return c.json(errorResponse(c, error.code, error.message), 404);
  }
  throw error;
}

function errorResponse(c: Context<OpsAppEnv>, code: string, message: string) {
  return {
    error: {
      code,
      message,
      requestId: c.get("requestId"),
    },
  };
}
