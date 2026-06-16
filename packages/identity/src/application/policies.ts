import {
  canCreateOwnedResources,
  canManageRoles,
  canManageUsers,
  isAdmin,
  type User,
  type UserGrantedRole,
  type UserId,
} from "../domain/index.js";

export type CurrentUser = {
  user: User;
  roles: readonly UserGrantedRole[];
  isAdmin: boolean;
};

export function createCurrentUser(input: {
  user: User;
  roles: readonly UserGrantedRole[];
  at?: Date;
}): CurrentUser {
  const at = input.at ?? new Date();

  return {
    user: input.user,
    roles: input.roles,
    isAdmin: isAdmin(input.roles, at),
  };
}

export function canViewUser(
  currentUser: Pick<CurrentUser, "user" | "roles" | "isAdmin">,
  targetUserId: UserId,
): boolean {
  return currentUser.isAdmin || currentUser.user.id === targetUserId;
}

export function canUpdateUserProfile(
  currentUser: Pick<CurrentUser, "user" | "isAdmin">,
  targetUserId: UserId,
): boolean {
  return currentUser.isAdmin || currentUser.user.id === targetUserId;
}

export function canDisableUser(
  currentUser: Pick<CurrentUser, "user" | "isAdmin">,
  targetUserId: UserId,
): boolean {
  return currentUser.isAdmin && currentUser.user.id !== targetUserId;
}

export function canActivateUser(
  currentUser: Pick<CurrentUser, "isAdmin">,
): boolean {
  return currentUser.isAdmin;
}

export function canDeleteUser(
  currentUser: Pick<CurrentUser, "user" | "isAdmin">,
  targetUserId: UserId,
): boolean {
  return currentUser.isAdmin && currentUser.user.id !== targetUserId;
}

export function canGrantUserRole(
  currentUser: Pick<CurrentUser, "isAdmin">,
): boolean {
  return currentUser.isAdmin;
}

export function canRevokeUserRole(
  currentUser: Pick<CurrentUser, "user" | "isAdmin">,
  targetUserId: UserId,
): boolean {
  return currentUser.isAdmin && currentUser.user.id !== targetUserId;
}

export function canListUsers(
  currentUser: Pick<CurrentUser, "roles" | "isAdmin">,
): boolean {
  return currentUser.isAdmin || canManageUsers(currentUser.roles);
}

export function canListRoles(
  currentUser: Pick<CurrentUser, "roles" | "isAdmin">,
): boolean {
  return currentUser.isAdmin || canManageRoles(currentUser.roles);
}

export function canCreateApplicationResources(
  currentUser: Pick<CurrentUser, "roles" | "isAdmin">,
): boolean {
  return currentUser.isAdmin || canCreateOwnedResources(currentUser.roles);
}
