import {
  createPinoStructuredLogger,
  errorLogFields,
  type LogFields,
} from "@lemma/observability";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import type { RequestContextEnv } from "./composition/request-context.js";

const apiLogger = createPinoStructuredLogger("api");

export const apiRequestLoggerMiddleware = createMiddleware<RequestContextEnv>(
  async (c, next) => {
    const startedAt = performance.now();
    await next();
    apiLogger.info("http request completed", {
      "http.request_id": c.get("requestId"),
      "http.method": c.req.method,
      "http.path": c.req.path,
      "http.status_code": c.res.status,
      "http.duration_ms": Math.round(performance.now() - startedAt),
    });
  },
);

export function logApiInfo(message: string, fields?: LogFields): void {
  apiLogger.info(message, fields);
}

export function logApiError(
  message: string,
  c: Context,
  error: unknown,
  fields?: LogFields,
): void {
  const requestId = c.get("requestId");
  apiLogger.error(message, {
    "http.request_id": typeof requestId === "string" ? requestId : null,
    "http.method": c.req.method,
    "http.path": c.req.path,
    ...fields,
    ...errorLogFields(error),
  });
}

export function logApiWarn(message: string, fields?: LogFields): void {
  apiLogger.warn(message, fields);
}

export function logApiRuntimeError(message: string, error: unknown): void {
  apiLogger.error(message, errorLogFields(error));
}
