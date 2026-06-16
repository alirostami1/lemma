import type { CurrentUser } from "@lemma/identity/application";
import type { Context, MiddlewareHandler } from "hono";

export type WorkbookAppEnv = {
  Variables: {
    identity: CurrentUser;
    requestId: string;
  };
};

export type RequireIdentity = MiddlewareHandler<WorkbookAppEnv>;
export type WorkbookContext = Context<WorkbookAppEnv>;
