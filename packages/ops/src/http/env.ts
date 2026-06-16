import type { CurrentUser } from "@lemma/identity/application";
import type { MiddlewareHandler } from "hono";

export type OpsAppEnv = {
  Variables: {
    identity: CurrentUser;
    requestId: string;
  };
};

export type RequireIdentity = MiddlewareHandler<OpsAppEnv>;
