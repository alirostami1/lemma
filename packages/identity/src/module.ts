import type { DatabaseExecutor } from "@lemma/db";
import {
  type Clock,
  IdentityService,
  type IdGenerator,
} from "./application/index.js";
import type { RequireIdentity } from "./http/env.js";
import { identityRoutes } from "./http/index.js";
import { KyselyIdentityRepository } from "./infrastructure/index.js";

export function createIdentityModule(deps: {
  db: DatabaseExecutor;
  requireIdentity: RequireIdentity;
  idGenerator: IdGenerator;
  clock: Clock;
}) {
  const identityRepository = new KyselyIdentityRepository(deps.db);

  const identityService = new IdentityService({
    clock: deps.clock,
    identityRepository,
    idGenerator: deps.idGenerator,
  });

  const routes = identityRoutes({
    identityService,
    requireIdentity: deps.requireIdentity,
  });

  return {
    identityService,
    routes,
  };
}
