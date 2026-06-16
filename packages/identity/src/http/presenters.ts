import type {
  IdentityUserResponseDto,
  RoleDto,
  UserRoleDto,
} from "../application/index.js";
import {
  toIdentityUserDto,
  toRoleDto,
  toUserRoleDto,
} from "../application/index.js";
import type { Role, User, UserGrantedRole } from "../domain/index.js";

export function presentIdentityUser(user: User): IdentityUserResponseDto {
  return {
    user: toIdentityUserDto(user),
  };
}

export function presentIdentityUsers(users: readonly User[]) {
  return {
    users: users.map(toIdentityUserDto),
  };
}

export function presentRoles(roles: readonly Role[]): {
  roles: RoleDto[];
} {
  return {
    roles: roles.map(toRoleDto),
  };
}

export function presentUserRoles(userRoles: readonly UserGrantedRole[]): {
  roles: UserRoleDto[];
} {
  return {
    roles: userRoles.map(toUserRoleDto),
  };
}
