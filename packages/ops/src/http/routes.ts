import type { OpsService } from "../application/index.js";
import { createOpsRoutes } from "../generated/hono/index.js";
import type { RequireIdentity } from "./env.js";
import { createOpsHandlers } from "./handlers.js";

export type OpsRoutesDeps = {
  requireIdentity: RequireIdentity;
  opsService: OpsService;
};

export function opsRoutes(deps: OpsRoutesDeps) {
  return createOpsRoutes({
    handlers: createOpsHandlers({
      opsService: deps.opsService,
    }),
    requireIdentity: deps.requireIdentity,
  });
}
