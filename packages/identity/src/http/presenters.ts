import { presentDate } from "@lemma/http";
import type { Role, User, UserGrantedRole } from "../domain/index.js";
import type {
  IdentityUser as IdentityUserDto,
  IdentityUserResponse as IdentityUserResponseDto,
  ListIdentityUsersResponse,
  Role as RoleDto,
  RolesResponse as RolesResponseDto,
  UserRole as UserRoleDto,
  UserRolesResponse as UserRolesResponseDto,
} from "../gen/types/index.js";

export function presentIdentityUser(user: User): IdentityUserResponseDto {
  return {
    user: toIdentityUserDto(user),
  };
}

export function presentIdentityUsers(
  users: readonly User[],
): ListIdentityUsersResponse {
  return {
    users: users.map(toIdentityUserDto),
  };
}

export function presentRoles(roles: readonly Role[]): RolesResponseDto {
  return {
    roles: roles.map(toRoleDto),
  };
}

export function presentUserRoles(
  userRoles: readonly UserGrantedRole[],
): UserRolesResponseDto {
  return {
    roles: userRoles.map(toUserRoleDto),
  };
}

function toIdentityUserDto(user: User): IdentityUserDto {
  return {
    id: user.id,
    identityId: user.identityId,
    email: user.email,
    displayName: user.displayName,
    status: user.status,
    createdAt: presentDate(user.createdAt),
    updatedAt: presentDate(user.updatedAt),
  };
}

function toRoleDto(role: Role): RoleDto {
  return {
    id: role.id,
    key: role.key,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    createdAt: presentDate(role.createdAt),
    updatedAt: presentDate(role.updatedAt),
  };
}

function toUserRoleDto(userRole: UserGrantedRole): UserRoleDto {
  return {
    userId: userRole.userId,
    roleId: userRole.roleId,
    roleKey: userRole.roleKey,
    grantedByUserId: userRole.grantedByUserId,
    expiresAt: presentDate(userRole.expiresAt),
    createdAt: presentDate(userRole.createdAt),
  };
}
