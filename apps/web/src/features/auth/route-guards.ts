import {
  type AccessRequirement,
  canAccess,
  getRolesFromDecodedToken,
} from "./access";
import {
  ForbiddenRouteError,
  SignInRequiredRouteError,
} from "./auth-errors";
import { enforceLogin, getOidc } from "#/lib/oidc";

type LoginLoaderContext = Parameters<typeof enforceLogin>[0];

export async function requireLogin(
  loaderContext: LoginLoaderContext,
): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }
  await enforceLogin(loaderContext);
}

export function createRoleGuard(input: {
  all?: string[];
  any?: string[];
}): (loaderContext: LoginLoaderContext) => Promise<void> {
  return async (loaderContext) => {
    if (typeof window === "undefined") {
      return;
    }

    await requireLogin(loaderContext);

    const oidc = await getOidc();
    if (!oidc.isUserLoggedIn) {
      throw new SignInRequiredRouteError();
    }

    const user = { roles: getRolesFromDecodedToken(oidc.getDecodedIdToken()) };
    const requirements: AccessRequirement[] = [];
    if (input.all) {
      requirements.push({ type: "all_roles", roles: input.all });
    }
    if (input.any) {
      requirements.push({ type: "any_role", roles: input.any });
    }

    if (!requirements.every((requirement) => canAccess(user, requirement))) {
      throw new ForbiddenRouteError([
        ...(input.all ?? []),
        ...(input.any ?? []),
      ]);
    }
  };
}

export function requireRoles(
  roles: string[],
): (loaderContext: LoginLoaderContext) => Promise<void> {
  return createRoleGuard({ all: roles });
}

export function requireAnyRole(
  roles: string[],
): (loaderContext: LoginLoaderContext) => Promise<void> {
  return createRoleGuard({ any: roles });
}
