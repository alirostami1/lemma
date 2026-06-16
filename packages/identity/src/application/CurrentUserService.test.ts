import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createUser,
  grantUserRole,
  identityId,
  roleId,
} from "../domain/index.js";
import { CurrentUserService } from "./CurrentUserService.js";
import type { VerifiedIdentity } from "./ports.js";

describe("CurrentUserService", () => {
  it("builds the current user from a verified identity and database roles", async () => {
    const at = new Date("2026-06-15T00:00:00.000Z");
    const verifiedIdentity: VerifiedIdentity = {
      identityId: identityId("keycloak-subject-admin"),
      sessionId: "keycloak-session",
      email: "admin@example.com",
      displayName: "Admin User",
      preferredUsername: "admin",
    };
    const user = createUser(
      {
        id: "019e9315-6a87-715f-9861-8654df072001",
        identityId: verifiedIdentity.identityId,
        email: verifiedIdentity.email,
        displayName: verifiedIdentity.displayName,
      },
      at,
    );
    const roleGrant = grantUserRole(
      {
        userId: user.id,
        roleId: roleId("019e9315-6a87-715f-9861-8654df073001"),
        roleKey: "admin",
        grantedByUserId: user.id,
        expiresAt: new Date("2027-06-15T00:00:00.000Z"),
      },
      at,
    );
    const verifiedTokens: string[] = [];
    const bootstrapIdentities: VerifiedIdentity[] = [];
    const roleUserIds: string[] = [];

    const currentUserService = new CurrentUserService({
      identityProvider: {
        async verifyAccessToken(accessToken) {
          verifiedTokens.push(accessToken);
          return verifiedIdentity;
        },
      },
      identityService: {
        async getActiveUserFromIdentity(identity) {
          bootstrapIdentities.push(identity);
          return user;
        },
        async listUserRolesForAuthentication(userId) {
          roleUserIds.push(userId);
          return [roleGrant];
        },
      },
      clock: {
        now: () => at,
      },
    });

    const currentUser =
      await currentUserService.fromAccessToken("access-token");

    assert.deepEqual(verifiedTokens, ["access-token"]);
    assert.deepEqual(bootstrapIdentities, [verifiedIdentity]);
    assert.deepEqual(roleUserIds, [user.id]);
    assert.equal(currentUser.user.id, user.id);
    assert.equal(currentUser.user.identityId, verifiedIdentity.identityId);
    assert.deepEqual(currentUser.roles, [roleGrant]);
    assert.equal(currentUser.isAdmin, true);
  });
});
