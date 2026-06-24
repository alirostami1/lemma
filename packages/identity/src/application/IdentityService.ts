import { instrumentService } from "@lemma/observability";
import {
  activateUser,
  assertUserIsActive,
  createUser,
  type DisplayName,
  deleteUser,
  disableUser,
  ForbiddenIdentityActionError,
  type GlobalRoleKey,
  grantUserRole,
  type RoleId,
  RoleNotFoundError,
  roleId,
  type User,
  type UserId,
  UserNotFoundError,
  type UserStatus,
  updateUserProfile,
  userId,
} from "../domain/index.js";
import {
  type CurrentUser,
  canActivateUser,
  canDeleteUser,
  canDisableUser,
  canGrantUserRole,
  canListRoles,
  canListUsers,
  canRevokeUserRole,
  canUpdateUserProfile,
  canViewUser,
} from "./policies.js";
import type {
  Clock,
  IdentityRepository,
  IdGenerator,
  VerifiedIdentity,
} from "./ports.js";

const instrumentation = instrumentService("identity", "service");

export class IdentityService {
  constructor(
    private readonly deps: {
      identityRepository: IdentityRepository;
      idGenerator: IdGenerator;
      clock: Clock;
    },
  ) {}

  private async getOrCreateUserFromIdentity(
    identity: VerifiedIdentity,
  ): Promise<User> {
    return this.operation("get_or_create_user_from_identity", async () => {
      const existing = await this.deps.identityRepository.findUserByIdentityId(
        identity.identityId,
      );

      if (existing) {
        return existing;
      }

      const user = createUser(
        {
          displayName: identity.displayName ?? identity.preferredUsername,
          email: identity.email,
          id: this.deps.idGenerator.userId(),
          identityId: identity.identityId,
        },
        this.deps.clock.now(),
      );

      return this.deps.identityRepository.createUser(user);
    });
  }

  /**
   * Authentication/bootstrap use case.
   *
   * Used by CurrentUserService after token verification.
   */
  async getActiveUserFromIdentity(identity: VerifiedIdentity): Promise<User> {
    return this.operation("get_active_user_from_identity", async () => {
      const user = await this.getOrCreateUserFromIdentity(identity);

      assertUserIsActive(user);

      return user;
    });
  }

  /**
   * Authentication/bootstrap use case.
   *
   * Used by CurrentUserService to construct CurrentUser.
   * Do not expose this directly from HTTP.
   */
  async listUserRolesForAuthentication(userId: UserId) {
    return this.operation("list_user_roles_for_authentication", () =>
      this.deps.identityRepository.listUserRoles(userId),
    );
  }

  async getCurrentUser(input: { currentUser: CurrentUser }): Promise<User> {
    const user = await this.findUserByIdOrThrow(input.currentUser.user.id);

    assertUserIsActive(user);

    return user;
  }

  async getUser(input: {
    currentUser: CurrentUser;
    userId: UserId;
  }): Promise<User> {
    this.assertAuthorized(
      canViewUser(input.currentUser, input.userId),
      "You cannot view this user.",
    );

    return this.findUserByIdOrThrow(input.userId);
  }

  async listUsers(input: {
    currentUser: CurrentUser;
    search?: string | null;
    status?: UserStatus | null;
    limit?: number;
  }): Promise<User[]> {
    return this.operation("list_users", async () => {
      this.assertAuthorized(
        canListUsers(input.currentUser),
        "You cannot list users.",
      );

      return this.deps.identityRepository.listUsers({
        limit: input.limit,
        search: input.search,
        status: input.status,
      });
    });
  }

  async updateCurrentUserProfile(input: {
    currentUser: CurrentUser;
    patch: {
      displayName?: DisplayName;
    };
  }): Promise<User> {
    return this.updateUserProfile({
      currentUser: input.currentUser,
      patch: input.patch,
      userId: input.currentUser.user.id,
    });
  }

  async updateUserProfile(input: {
    currentUser: CurrentUser;
    userId: UserId;
    patch: {
      displayName?: DisplayName;
    };
  }): Promise<User> {
    this.assertAuthorized(
      canUpdateUserProfile(input.currentUser, input.userId),
      "You cannot update this user.",
    );

    const user = await this.findUserByIdOrThrow(input.userId);

    const updated = updateUserProfile(user, input.patch, this.deps.clock.now());

    return this.persistExistingUser(updated);
  }

  async activateUser(input: {
    currentUser: CurrentUser;
    userId: UserId;
  }): Promise<User> {
    this.assertAuthorized(
      canActivateUser(input.currentUser),
      "You cannot activate users.",
    );

    const user = await this.findUserByIdOrThrow(input.userId);

    const updated = activateUser(user, this.deps.clock.now());

    return this.persistExistingUser(updated);
  }

  async disableUser(input: {
    currentUser: CurrentUser;
    userId: UserId;
  }): Promise<User> {
    this.assertAuthorized(
      canDisableUser(input.currentUser, input.userId),
      "You cannot disable this user.",
    );

    const user = await this.findUserByIdOrThrow(input.userId);

    const updated = disableUser(user, this.deps.clock.now());

    return this.persistExistingUser(updated);
  }

  async deleteUser(input: {
    currentUser: CurrentUser;
    userId: UserId;
  }): Promise<User> {
    this.assertAuthorized(
      canDeleteUser(input.currentUser, input.userId),
      "You cannot delete this user.",
    );

    const user = await this.findUserByIdOrThrow(input.userId);

    const updated = deleteUser(user, this.deps.clock.now());

    return this.persistExistingUser(updated);
  }

  async listRoles(input: { currentUser: CurrentUser }) {
    return this.operation("list_roles", async () => {
      this.assertAuthorized(
        canListRoles(input.currentUser),
        "You cannot list roles.",
      );

      return this.deps.identityRepository.listRoles();
    });
  }

  async listUserRoles(input: { currentUser: CurrentUser; userId: UserId }) {
    this.assertAuthorized(
      canViewUser(input.currentUser, input.userId),
      "You cannot view this user's roles.",
    );

    await this.findUserByIdOrThrow(input.userId);

    return this.deps.identityRepository.listUserRoles(input.userId);
  }

  async grantRoleToUser(input: {
    currentUser: CurrentUser;
    userId: UserId;
    roleId: RoleId;
    expiresAt: Date;
  }): Promise<void> {
    await this.operation("grant_role_to_user", async () => {
      this.assertAuthorized(
        canGrantUserRole(input.currentUser),
        "You cannot grant roles.",
      );

      const targetUser = await this.findUserByIdOrThrow(input.userId);

      const role = await this.deps.identityRepository.findRoleById(
        input.roleId,
      );

      if (!role) {
        throw new RoleNotFoundError();
      }

      await this.deps.identityRepository.grantUserRole(
        grantUserRole(
          {
            expiresAt: input.expiresAt,
            grantedByUserId: input.currentUser.user.id,
            roleId: role.id,
            roleKey: role.key,
            userId: targetUser.id,
          },
          this.deps.clock.now(),
        ),
      );
    });
  }

  async grantRoleKeyToUser(input: {
    currentUser: CurrentUser;
    userId: UserId;
    roleKey: GlobalRoleKey;
    expiresAt: Date;
  }): Promise<void> {
    await this.operation("grant_role_key_to_user", async () => {
      this.assertAuthorized(
        canGrantUserRole(input.currentUser),
        "You cannot grant roles.",
      );

      const targetUser = await this.findUserByIdOrThrow(input.userId);

      const role = await this.deps.identityRepository.findRoleByKey(
        input.roleKey,
      );

      if (!role) {
        throw new RoleNotFoundError();
      }

      await this.deps.identityRepository.grantUserRole(
        grantUserRole(
          {
            expiresAt: input.expiresAt,
            grantedByUserId: input.currentUser.user.id,
            roleId: role.id,
            roleKey: role.key,
            userId: targetUser.id,
          },
          this.deps.clock.now(),
        ),
      );
    });
  }

  async revokeRoleFromUser(input: {
    currentUser: CurrentUser;
    userId: UserId;
    roleId: RoleId;
  }): Promise<void> {
    await this.operation("revoke_role_from_user", async () => {
      const domainUserId = userId(input.userId);
      const domainRoleId = roleId(input.roleId);

      this.assertAuthorized(
        canRevokeUserRole(input.currentUser, domainUserId),
        "You cannot revoke this role.",
      );

      await this.findUserByIdOrThrow(domainUserId);

      await this.deps.identityRepository.revokeUserRole({
        roleId: domainRoleId,
        userId: domainUserId,
      });
    });
  }

  private async findUserByIdOrThrow(userId: UserId): Promise<User> {
    const user = await this.deps.identityRepository.findUserById(userId);

    if (!user) {
      throw new UserNotFoundError();
    }

    return user;
  }

  private async persistExistingUser(user: User): Promise<User> {
    const persisted = await this.deps.identityRepository.updateUser(user);

    if (!persisted) {
      throw new UserNotFoundError();
    }

    return persisted;
  }

  private assertAuthorized(condition: boolean, message: string): void {
    if (!condition) {
      throw new ForbiddenIdentityActionError(message);
    }
  }

  private async operation<T>(
    operation: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    return instrumentation.run(operation, fn);
  }
}
