import { instrumentService } from "@lemma/observability";
import type { User, UserGrantedRole, UserId } from "../domain/index.js";
import { type CurrentUser, createCurrentUser } from "./policies.js";
import type { Clock, IdentityProvider, VerifiedIdentity } from "./ports.js";

const instrumentation = instrumentService("identity", "current_user");

type CurrentUserIdentityService = {
  getActiveUserFromIdentity(identity: VerifiedIdentity): Promise<User>;
  listUserRolesForAuthentication(
    userId: UserId,
  ): Promise<readonly UserGrantedRole[]>;
};

export class CurrentUserService {
  constructor(
    private readonly deps: {
      identityProvider: IdentityProvider;
      identityService: CurrentUserIdentityService;
      clock: Clock;
    },
  ) {}

  async fromAccessToken(accessToken: string): Promise<CurrentUser> {
    return instrumentation.run("from_access_token", async () => {
      const verifiedIdentity =
        await this.deps.identityProvider.verifyAccessToken(accessToken);

      const user =
        await this.deps.identityService.getActiveUserFromIdentity(
          verifiedIdentity,
        );

      const roles =
        await this.deps.identityService.listUserRolesForAuthentication(user.id);

      return createCurrentUser({
        at: this.deps.clock.now(),
        roles,
        user,
      });
    });
  }
}
