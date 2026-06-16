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
    id: roleId(input.id),
    key: globalRoleKey(input.key),
    name: roleName(input.name),
    description: roleDescription(input.description),
    isSystem: input.isSystem ?? false,
    createdAt: at,
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
    id: roleId(input.id),
    key: globalRoleKey(input.key),
    name: roleName(input.name),
    description: roleDescription(input.description),
    isSystem: input.isSystem,
    createdAt: input.createdAt,
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
    userId: input.userId,
    roleId: input.roleId,
    roleKey: input.roleKey,
    grantedByUserId: input.grantedByUserId,
    expiresAt: input.expiresAt,
    createdAt: at,
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
    userId: userId(input.userId),
    roleId: roleId(input.roleId),
    roleKey: globalRoleKey(input.roleKey),
    grantedByUserId: userId(input.grantedByUserId),
    expiresAt: input.expiresAt,
    createdAt: input.createdAt,
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
