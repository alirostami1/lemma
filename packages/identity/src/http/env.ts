import type { MiddlewareHandler } from "hono";
import type { CurrentUser } from "../application/index.js";

export type IdentityAppEnv = {
  Variables: {
    identity: CurrentUser;
    requestId: string;
  };
};

export type RequireIdentity = MiddlewareHandler<IdentityAppEnv>;
