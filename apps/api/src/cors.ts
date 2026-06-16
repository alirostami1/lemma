import type { MiddlewareHandler } from "hono";

export function cors(allowedOrigins: string[]): MiddlewareHandler {
  return async (c, next) => {
    const origin = c.req.header("origin");
    if (origin && allowedOrigins.includes(origin)) {
      c.header("Access-Control-Allow-Origin", origin);
      c.header("Access-Control-Allow-Credentials", "true");
      c.header("Vary", "Origin");
    }
    if (c.req.method === "OPTIONS") {
      c.header(
        "Access-Control-Allow-Methods",
        "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      );
      c.header(
        "Access-Control-Allow-Headers",
        c.req.header("access-control-request-headers") ??
          "Content-Type, Authorization",
      );
      c.header("Access-Control-Max-Age", "86400");
      return c.body(null, 204);
    }
    return next();
  };
}
