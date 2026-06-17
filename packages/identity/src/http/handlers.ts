import { withHttpErrorHandler } from "@lemma/http";
import type { IdentityService } from "../application/index.js";
import {
  displayName as toDisplayName,
  roleId as toRoleId,
  globalRoleKey as toRoleKey,
  userId as toUserId,
  userStatus as toUserStatus,
} from "../domain/index.js";
import type { IdentityHandlerMap } from "../gen/hono/index.js";
import { badRequest, handleIdentityError } from "./errors.js";
import {
  presentIdentityUser,
  presentIdentityUsers,
  presentRoles,
  presentUserRoles,
} from "./presenters.js";

export type IdentityHandlersDeps = {
  identityService: IdentityService;
};

function identityHandler<TKey extends keyof IdentityHandlerMap>(
  _operation: TKey,
  handler: IdentityHandlerMap[TKey],
): IdentityHandlerMap[TKey] {
  return withHttpErrorHandler(handler, handleIdentityError);
}

export function createIdentityHandlers(
  deps: IdentityHandlersDeps,
): IdentityHandlerMap {
  return {
    getCurrentIdentity: identityHandler("getCurrentIdentity", async (c) => {
      const user = await deps.identityService.getCurrentUser({
        currentUser: c.var.identity,
      });

      return c.json(presentIdentityUser(user), 200);
    }),

    updateCurrentIdentity: identityHandler(
      "updateCurrentIdentity",
      async (c) => {
        const body = c.req.valid("json");

        const user = await deps.identityService.updateCurrentUserProfile({
          currentUser: c.var.identity,
          patch: {
            displayName: body.displayName
              ? toDisplayName(body.displayName)
              : undefined,
          },
        });

        return c.json(presentIdentityUser(user), 200);
      },
    ),

    getCurrentIdentityRoles: identityHandler(
      "getCurrentIdentityRoles",
      async (c) => {
        const roles = await deps.identityService.listUserRoles({
          currentUser: c.var.identity,
          userId: c.var.identity.user.id,
        });

        return c.json(presentUserRoles(roles), 200);
      },
    ),

    getIdentityUser: identityHandler("getIdentityUser", async (c) => {
      const { userId } = c.req.valid("param");
      const user = await deps.identityService.getUser({
        currentUser: c.var.identity,
        userId: toUserId(userId),
      });

      return c.json(presentIdentityUser(user), 200);
    }),

    listIdentityUsers: identityHandler("listIdentityUsers", async (c) => {
      const query = c.req.valid("query");
      const users = await deps.identityService.listUsers({
        currentUser: c.var.identity,
        search: query.search ?? null,
        status: query.status ? toUserStatus(query.status) : null,
        limit: query.limit,
      });

      return c.json(presentIdentityUsers(users), 200);
    }),

    updateIdentityUser: identityHandler("updateIdentityUser", async (c) => {
      const body = c.req.valid("json");

      const { userId } = c.req.valid("param");
      const user = await deps.identityService.updateUserProfile({
        currentUser: c.var.identity,
        userId: toUserId(userId),
        patch: {
          displayName: body.displayName
            ? toDisplayName(body.displayName)
            : undefined,
        },
      });

      return c.json(presentIdentityUser(user), 200);
    }),

    activateIdentityUser: identityHandler("activateIdentityUser", async (c) => {
      const { userId } = c.req.valid("param");
      const user = await deps.identityService.activateUser({
        currentUser: c.var.identity,
        userId: toUserId(userId),
      });

      return c.json(presentIdentityUser(user), 200);
    }),

    disableIdentityUser: identityHandler("disableIdentityUser", async (c) => {
      const { userId } = c.req.valid("param");
      const user = await deps.identityService.disableUser({
        currentUser: c.var.identity,
        userId: toUserId(userId),
      });

      return c.json(presentIdentityUser(user), 200);
    }),

    deleteIdentityUser: identityHandler("deleteIdentityUser", async (c) => {
      const { userId } = c.req.valid("param");
      const user = await deps.identityService.deleteUser({
        currentUser: c.var.identity,
        userId: toUserId(userId),
      });

      return c.json(presentIdentityUser(user), 200);
    }),

    getIdentityUserRoles: identityHandler("getIdentityUserRoles", async (c) => {
      const { userId } = c.req.valid("param");
      const roles = await deps.identityService.listUserRoles({
        currentUser: c.var.identity,
        userId: toUserId(userId),
      });

      return c.json(presentUserRoles(roles), 200);
    }),

    listIdentityRoles: identityHandler("listIdentityRoles", async (c) => {
      const roles = await deps.identityService.listRoles({
        currentUser: c.var.identity,
      });

      return c.json(presentRoles(roles), 200);
    }),

    grantIdentityUserRole: identityHandler(
      "grantIdentityUserRole",
      async (c) => {
        const body = c.req.valid("json");
        const { userId } = c.req.valid("param");

        if ("roleId" in body) {
          await deps.identityService.grantRoleToUser({
            currentUser: c.var.identity,
            userId: toUserId(userId),
            roleId: toRoleId(body.roleId),
            expiresAt: new Date(body.expiresAt),
          });

          return c.body(null, 204);
        }

        if (body.roleKey) {
          await deps.identityService.grantRoleKeyToUser({
            currentUser: c.var.identity,
            userId: toUserId(userId),
            roleKey: toRoleKey(body.roleKey),
            expiresAt: new Date(body.expiresAt),
          });

          return c.body(null, 204);
        }

        return c.json(
          badRequest(
            c,
            "ROLE_REQUIRED",
            "Either roleId or roleKey is required.",
          ),
          400,
        );
      },
    ),

    revokeIdentityUserRole: identityHandler(
      "revokeIdentityUserRole",
      async (c) => {
        const { userId, roleId } = c.req.valid("param");
        await deps.identityService.revokeRoleFromUser({
          currentUser: c.var.identity,
          userId: toUserId(userId),
          roleId: toRoleId(roleId),
        });

        return c.body(null, 204);
      },
    ),
  };
}
