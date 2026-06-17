import {
  createConsoleStructuredLogger,
  errorLogFields,
  type LogFields,
} from "@lemma/observability";
import type { Context } from "hono";

const apiLogger = createConsoleStructuredLogger("api");

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
