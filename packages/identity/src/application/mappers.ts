import type { Role, User, UserGrantedRole } from "../domain/index.js";
import type { IdentityUserDto, RoleDto, UserRoleDto } from "./dto.js";

export function toIdentityUserDto(user: User): IdentityUserDto {
  return {
    id: user.id,
    identityId: user.identityId,
    email: user.email,
    displayName: user.displayName,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export function toRoleDto(role: Role): RoleDto {
  return {
    id: role.id,
    key: role.key,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    createdAt: role.createdAt.toISOString(),
    updatedAt: role.updatedAt.toISOString(),
  };
}

export function toUserRoleDto(userRole: UserGrantedRole): UserRoleDto {
  return {
    userId: userRole.userId,
    roleId: userRole.roleId,
    roleKey: userRole.roleKey,
    grantedByUserId: userRole.grantedByUserId,
    expiresAt: userRole.expiresAt.toISOString(),
    createdAt: userRole.createdAt.toISOString(),
  };
}
