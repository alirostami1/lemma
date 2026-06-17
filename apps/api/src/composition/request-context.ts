import { isUuidString } from "@lemma/domain";
import { withSpan } from "@lemma/observability/node";
import { createMiddleware } from "hono/factory";
import { v7 as uuidv7 } from "uuid";

export type RequestContextEnv = {
  Variables: {
    requestId: string;
  };
};

export const requestIdMiddleware = createMiddleware<RequestContextEnv>(
  async (c, next) => {
    const headerRequestId = c.req.header("X-Request-Id");
    const requestId =
      headerRequestId && isUuidString(headerRequestId)
        ? headerRequestId
        : uuidv7();
    c.set("requestId", requestId);
    c.header("X-Request-Id", requestId);
    await next();
  },
);

export const requestSpanMiddleware = createMiddleware<RequestContextEnv>(
  async (c, next) =>
    withSpan(
      "api.request",
      {
        "http.request.method": c.req.method,
        "url.path": c.req.path,
        "http.request_id": c.get("requestId"),
        "operation.request_id": c.get("requestId"),
      },
      async (span) => {
        await next();
        span.setAttribute("http.response.status_code", c.res.status);
      },
    ),
);
