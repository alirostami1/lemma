export type AuthRole = string;

export type AccessUser = {
  roles: AuthRole[];
};

export type AccessRequirement =
  | { type: "login" }
  | { type: "all_roles"; roles: AuthRole[] }
  | { type: "any_role"; roles: AuthRole[] };

export type DecodedTokenWithRoles = {
  realm_access?: {
    roles?: string[];
  };
};

export function getRolesFromDecodedToken(
  input: DecodedTokenWithRoles | null | undefined,
): string[] {
  return input?.realm_access?.roles ?? [];
}

export function hasRole(user: AccessUser, role: string): boolean {
  return user.roles.includes(role);
}

export function hasAllRoles(user: AccessUser, roles: string[]): boolean {
  return roles.every((role) => hasRole(user, role));
}

export function hasAnyRole(user: AccessUser, roles: string[]): boolean {
  return roles.some((role) => hasRole(user, role));
}

export function canAccess(
  user: AccessUser | null,
  requirement: AccessRequirement,
): boolean {
  if (!user) {
    return false;
  }

  switch (requirement.type) {
    case "login":
      return true;
    case "all_roles":
      return hasAllRoles(user, requirement.roles);
    case "any_role":
      return hasAnyRole(user, requirement.roles);
  }
}
