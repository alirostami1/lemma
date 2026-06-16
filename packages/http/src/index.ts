import { zValidator as zv } from "@hono/zod-validator";
import { type HttpErrorResponse } from "@lemma/error";
import type { Handler, ValidationTargets } from "hono";
import type { RequestIdVariables } from "hono/request-id";
import type { z } from "zod";

export type AppEnv = {
  Variables: RequestIdVariables;
};

type ValidationHook = Parameters<typeof zv>[2];

export const zValidator = <
  T extends z.ZodSchema,
  Target extends keyof ValidationTargets,
>(
  target: Target,
  schema: T,
  hook: ValidationHook = validationHook,
) => zv(target, schema, hook);

export const validationHook: ValidationHook = (result, c) => {
  if (!result.success) {
    c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed.",
          details: result.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      } satisfies HttpErrorResponse,
      400,
    );
  }
};

export function withHttpErrorHandler<THandler extends Handler>(
  handler: THandler,
  handleError: (
    c: Parameters<THandler>[0],
    error: unknown,
  ) => Response | Promise<Response>,
): THandler {
  return (async (...args: Parameters<THandler>) => {
    const [c, next] = args;
    try {
      return await handler(c, next);
    } catch (error) {
      return handleError(c, error);
    }
  }) as THandler;
}
