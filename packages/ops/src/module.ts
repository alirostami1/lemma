import type { DatabasePort } from "@lemma/db";
import { OpsService } from "./application/index.js";
import type { RequireIdentity } from "./http/index.js";
import { opsRoutes } from "./http/index.js";
import { KyselyOpsRepository } from "./infrastructure/index.js";

export function createOpsModule(deps: {
  db: DatabasePort;
  requireIdentity: RequireIdentity;
}) {
  const opsService = new OpsService({
    opsRepository: new KyselyOpsRepository(deps.db),
  });
  const routes = opsRoutes({
    requireIdentity: deps.requireIdentity,
    opsService,
  });

  return { routes, opsService };
}
