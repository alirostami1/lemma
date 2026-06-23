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
} from "../generated/types/index.js";

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
    createdAt: presentDate(user.createdAt),
    displayName: user.displayName,
    email: user.email,
    id: user.id,
    identityId: user.identityId,
    status: user.status,
    updatedAt: presentDate(user.updatedAt),
  };
}

function toRoleDto(role: Role): RoleDto {
  return {
    createdAt: presentDate(role.createdAt),
    description: role.description,
    id: role.id,
    isSystem: role.isSystem,
    key: role.key,
    name: role.name,
    updatedAt: presentDate(role.updatedAt),
  };
}

function toUserRoleDto(userRole: UserGrantedRole): UserRoleDto {
  return {
    createdAt: presentDate(userRole.createdAt),
    expiresAt: presentDate(userRole.expiresAt),
    grantedByUserId: userRole.grantedByUserId,
    roleId: userRole.roleId,
    roleKey: userRole.roleKey,
    userId: userRole.userId,
  };
}
