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
      displayName: "Admin User",
      email: "admin@example.com",
      identityId: identityId("keycloak-subject-admin"),
      preferredUsername: "admin",
      sessionId: "keycloak-session",
    };
    const user = createUser(
      {
        displayName: verifiedIdentity.displayName,
        email: verifiedIdentity.email,
        id: "019e9315-6a87-715f-9861-8654df072001",
        identityId: verifiedIdentity.identityId,
      },
      at,
    );
    const roleGrant = grantUserRole(
      {
        expiresAt: new Date("2027-06-15T00:00:00.000Z"),
        grantedByUserId: user.id,
        roleId: roleId("019e9315-6a87-715f-9861-8654df073001"),
        roleKey: "admin",
        userId: user.id,
      },
      at,
    );
    const verifiedTokens: string[] = [];
    const bootstrapIdentities: VerifiedIdentity[] = [];
    const roleUserIds: string[] = [];

    const currentUserService = new CurrentUserService({
      clock: {
        now: () => at,
      },
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
