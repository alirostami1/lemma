import type { DatabaseExecutor } from "@lemma/db";
import {
  CurrentUserService,
  type Clock,
  IdentityService,
  type IdGenerator,
} from "@lemma/identity/application";
import { identityRoutes } from "@lemma/identity/http";
import {
  KeycloakIdentityProvider,
  KyselyIdentityRepository,
} from "@lemma/identity/infrastructure";
import { createRequireIdentity } from "../auth.js";
import type { Config } from "../config.js";

export function createIdentityAuth(input: {
  db: DatabaseExecutor;
  config: Config;
  idGenerator: IdGenerator;
  clock: Clock;
}) {
  const identityRepository = new KyselyIdentityRepository(input.db);
  const identityService = new IdentityService({
    identityRepository,
    idGenerator: input.idGenerator,
    clock: input.clock,
  });
  const identityProvider = new KeycloakIdentityProvider(input.config.oidc);
  const currentUserService = new CurrentUserService({
    identityProvider,
    identityService,
    clock: input.clock,
  });
  const requireIdentity = createRequireIdentity({
    fromAccessToken: (accessToken) =>
      currentUserService.fromAccessToken(accessToken),
  });
  const routes = identityRoutes({
    requireIdentity,
    identityService,
  });

  return {
    identityModule: {
      routes,
      identityService,
    },
    requireIdentity,
  };
}
