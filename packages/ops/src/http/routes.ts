import type { OpsService } from "../application/index.js";
import { createOpsRoutes } from "../gen/hono/index.js";
import type { RequireIdentity } from "./env.js";
import { createOpsHandlers } from "./handlers.js";

export type OpsRoutesDeps = {
  requireIdentity: RequireIdentity;
  opsService: OpsService;
};

export function opsRoutes(deps: OpsRoutesDeps) {
  return createOpsRoutes({
    requireIdentity: deps.requireIdentity,
    handlers: createOpsHandlers({
      opsService: deps.opsService,
    }),
  });
}
