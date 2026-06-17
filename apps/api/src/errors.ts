import { DomainError, type HttpErrorResponse } from "@lemma/error";
import type { ErrorHandler, NotFoundHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { logApiError } from "./logging.js";

export const notFoundHandler: NotFoundHandler = (c) => {
  const body = {
    error: {
      code: "NOT_FOUND",
      message: "Route not found.",
      requestId: c.get("requestId"),
    },
  } satisfies HttpErrorResponse;
  return c.json(body, 404);
};

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof HTTPException) {
    return err.getResponse();
  }

  if (err instanceof DomainError) {
    logApiError("domain error leaked to api", c, err, {
      "error.domain_code": err.domainCode,
    });
  }

  logApiError("unexpected api error", c, err);

  const body = {
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal server error.",
      requestId: c.get("requestId"),
    },
  } satisfies HttpErrorResponse;

  return c.json(body, 500);
};
