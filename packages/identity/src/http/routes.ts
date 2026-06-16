import type { IdentityService } from "../application/index.js";
import { createIdentityRoutes } from "../gen/hono/index.js";
import type { RequireIdentity } from "../http/index.ts";
import { createIdentityHandlers } from "./handlers.js";

export type IdentityRoutesDeps = {
  requireIdentity: RequireIdentity;
  identityService: IdentityService;
};

export function identityRoutes(deps: IdentityRoutesDeps) {
  return createIdentityRoutes({
    requireIdentity: deps.requireIdentity,
    handlers: createIdentityHandlers({
      identityService: deps.identityService,
    }),
  });
}
