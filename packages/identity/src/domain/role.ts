import { isActiveGrant, type Timestamped } from "@lemma/domain";
import { InvalidRoleGrantError } from "./errors.js";
import { type RoleId, roleId, type UserId, userId } from "./ids.js";
import {
  type GlobalRoleKey,
  globalRoleKey,
  type RoleDescription,
  type RoleName,
  roleDescription,
  roleName,
} from "./role-values.js";

export type Role = Timestamped & {
  id: RoleId;
  key: GlobalRoleKey;
  name: RoleName;
  description: RoleDescription;
  isSystem: boolean;
};

export type UserRoleGrant = {
  userId: UserId;
  roleId: RoleId;
  grantedByUserId: UserId;
  expiresAt: Date;
  createdAt: Date;
};

export type UserGrantedRole = UserRoleGrant & {
  roleKey: GlobalRoleKey;
};

export function createRole(
  input: {
    id: string;
    key: string;
    name: string;
    description: string;
    isSystem?: boolean;
  },
  at = new Date(),
): Role {
  return {
    createdAt: at,
    description: roleDescription(input.description),
    id: roleId(input.id),
    isSystem: input.isSystem ?? false,
    key: globalRoleKey(input.key),
    name: roleName(input.name),
    updatedAt: at,
  };
}

export function reconstituteRole(input: {
  id: string;
  key: string;
  name: string;
  description: string;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}): Role {
  return {
    createdAt: input.createdAt,
    description: roleDescription(input.description),
    id: roleId(input.id),
    isSystem: input.isSystem,
    key: globalRoleKey(input.key),
    name: roleName(input.name),
    updatedAt: input.updatedAt,
  };
}

export function grantUserRole(
  input: {
    userId: UserId;
    roleId: RoleId;
    roleKey: GlobalRoleKey;
    grantedByUserId: UserId;
    expiresAt: Date;
  },
  at = new Date(),
): UserGrantedRole {
  if (input.expiresAt && input.expiresAt <= at) {
    throw new InvalidRoleGrantError("role grant expiry must be in the future");
  }
  return {
    createdAt: at,
    expiresAt: input.expiresAt,
    grantedByUserId: input.grantedByUserId,
    roleId: input.roleId,
    roleKey: input.roleKey,
    userId: input.userId,
  };
}

export function reconstituteUserGrantedRole(input: {
  userId: string;
  roleId: string;
  roleKey: string;
  grantedByUserId: string;
  expiresAt: Date;
  createdAt: Date;
}): UserGrantedRole {
  return {
    createdAt: input.createdAt,
    expiresAt: input.expiresAt,
    grantedByUserId: userId(input.grantedByUserId),
    roleId: roleId(input.roleId),
    roleKey: globalRoleKey(input.roleKey),
    userId: userId(input.userId),
  };
}

export function hasGlobalRole(
  roles: readonly Pick<UserGrantedRole, "roleKey" | "expiresAt">[],
  roleKey: GlobalRoleKey,
  at = new Date(),
): boolean {
  return roles.some(
    (role) =>
      role.roleKey === roleKey &&
      isActiveGrant({ expiresAt: role.expiresAt }, at),
  );
}

export function isAdmin(
  roles: readonly Pick<UserGrantedRole, "roleKey" | "expiresAt">[],
  at = new Date(),
): boolean {
  return hasGlobalRole(roles, "admin", at);
}

export function isMember(
  roles: readonly Pick<UserGrantedRole, "roleKey" | "expiresAt">[],
  at = new Date(),
): boolean {
  return hasGlobalRole(roles, "member", at);
}

export function isSupport(
  roles: readonly Pick<UserGrantedRole, "roleKey" | "expiresAt">[],
  at = new Date(),
): boolean {
  return hasGlobalRole(roles, "support", at);
}

export function canCreateOwnedResources(
  roles: readonly Pick<UserGrantedRole, "roleKey" | "expiresAt">[],
  at = new Date(),
): boolean {
  return isAdmin(roles, at) || isMember(roles, at);
}

export function canManageUsers(
  roles: readonly Pick<UserGrantedRole, "roleKey" | "expiresAt">[],
  at = new Date(),
): boolean {
  return isAdmin(roles, at);
}

export function canManageRoles(
  roles: readonly Pick<UserGrantedRole, "roleKey" | "expiresAt">[],
  at = new Date(),
): boolean {
  return isAdmin(roles, at);
}
