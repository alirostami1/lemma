import type {
  GlobalRoleKey,
  IdentityId,
  Role,
  RoleId,
  User,
  UserGrantedRole,
  UserId,
  UserRoleGrant,
  UserStatus,
} from "../domain/index.js";

export type VerifiedIdentity = {
  /**
   * Keycloak `sub`.
   */
  identityId: IdentityId;

  /**
   * Keycloak `sid`, if present.
   * Kept for future session/audit use, but this application layer does not
   * record last_login_at or last_seen_at.
   */
  sessionId: string;

  email: string;
  displayName: string;
  preferredUsername: string;
};

export interface IdentityProvider {
  verifyAccessToken(accessToken: string): Promise<VerifiedIdentity>;
}

export interface IdentityRepository {
  createUser(user: User): Promise<User>;

  findRoleById(roleId: RoleId): Promise<Role | null>;
  findRoleByKey(key: GlobalRoleKey): Promise<Role | null>;
  findUserById(userId: UserId): Promise<User | null>;
  findUserByIdentityId(identityId: IdentityId): Promise<User | null>;
  grantUserRole(userRole: UserRoleGrant): Promise<void>;
  listRoles(): Promise<Role[]>;

  listUserRoles(userId: UserId): Promise<UserGrantedRole[]>;
  listUsers(input?: {
    search?: string | null;
    status?: UserStatus | null;
    limit?: number;
  }): Promise<User[]>;
  revokeUserRole(input: { userId: UserId; roleId: RoleId }): Promise<void>;
  updateUser(user: User): Promise<User | null>;
}

export interface IdGenerator {
  userId(): UserId;
}

export interface Clock {
  now(): Date;
}
