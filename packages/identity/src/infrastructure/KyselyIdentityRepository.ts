import type { DatabaseExecutor } from "@lemma/db";
import type { UserRoles, Users } from "@lemma/db/tables";
import type { Insertable, Updateable } from "kysely";
import type { IdentityRepository } from "../application/index.js";
import {
  type GlobalRoleKey,
  type IdentityId,
  type Role,
  type RoleId,
  reconstituteRole,
  reconstituteUser,
  reconstituteUserGrantedRole,
  type User,
  type UserGrantedRole,
  type UserId,
  type UserRoleGrant,
  type UserStatus,
} from "../domain/index.js";

export class KyselyIdentityRepository implements IdentityRepository {
  constructor(private readonly db: DatabaseExecutor) {}

  async listUsers(input?: {
    search?: string | null;
    status?: UserStatus | null;
    limit?: number;
  }): Promise<User[]> {
    let query = this.db.selectFrom("users").selectAll();

    if (input?.status) {
      query = query.where("status", "=", input.status);
    }

    const search = input?.search?.trim();
    if (search) {
      const pattern = `%${search}%`;
      query = query.where((eb) =>
        eb.or([
          eb("email", "ilike", pattern),
          eb("displayName", "ilike", pattern),
          eb("identityId", "ilike", pattern),
        ]),
      );
    }

    const rows = await query
      .orderBy("createdAt", "desc")
      .limit(Math.min(Math.max(input?.limit ?? 50, 1), 200))
      .execute();

    return rows.map(reconstituteUser);
  }

  async findUserById(userId: UserId): Promise<User | null> {
    const row = await this.db
      .selectFrom("users")
      .selectAll()
      .where("id", "=", userId)
      .executeTakeFirst();

    return row ? reconstituteUser(row) : null;
  }

  async findUserByIdentityId(identityId: IdentityId): Promise<User | null> {
    const row = await this.db
      .selectFrom("users")
      .selectAll()
      .where("identityId", "=", identityId)
      .executeTakeFirst();

    return row ? reconstituteUser(row) : null;
  }

  async createUser(user: User): Promise<User> {
    const row = await this.db
      .insertInto("users")
      .values(mapUserToInsert(user))
      .onConflict((oc) =>
        oc.column("identityId").doUpdateSet({
          displayName: user.displayName,
          email: user.email,
          updatedAt: user.updatedAt,
        }),
      )
      .returningAll()
      .executeTakeFirstOrThrow();

    return reconstituteUser(row);
  }

  async updateUser(user: User): Promise<User | null> {
    const row = await this.db
      .updateTable("users")
      .set(mapUserToUpdate(user))
      .where("id", "=", user.id)
      .returningAll()
      .executeTakeFirst();

    return row ? reconstituteUser(row) : null;
  }

  async findRoleById(roleId: RoleId): Promise<Role | null> {
    const row = await this.db
      .selectFrom("roles")
      .selectAll()
      .where("id", "=", roleId)
      .executeTakeFirst();

    return row ? reconstituteRole(row) : null;
  }

  async findRoleByKey(key: GlobalRoleKey): Promise<Role | null> {
    const row = await this.db
      .selectFrom("roles")
      .selectAll()
      .where("key", "=", key)
      .executeTakeFirst();

    return row ? reconstituteRole(row) : null;
  }

  async listRoles(): Promise<Role[]> {
    const rows = await this.db
      .selectFrom("roles")
      .selectAll()
      .orderBy("key", "asc")
      .execute();

    return rows.map(reconstituteRole);
  }

  async listUserRoles(userId: UserId): Promise<UserGrantedRole[]> {
    const rows = await this.db
      .selectFrom("userRoles")
      .innerJoin("roles", "roles.id", "userRoles.roleId")
      .select([
        "userRoles.userId",
        "userRoles.roleId",
        "roles.key as roleKey",
        "userRoles.grantedByUserId",
        "userRoles.expiresAt",
        "userRoles.createdAt",
      ])
      .where("userRoles.userId", "=", userId)
      .execute();

    return rows.map(reconstituteUserGrantedRole);
  }

  async grantUserRole(userRole: UserRoleGrant): Promise<void> {
    await this.db
      .insertInto("userRoles")
      .values(mapUserRoleGrantToInsert(userRole))
      .onConflict((oc) =>
        oc.columns(["userId", "roleId"]).doUpdateSet({
          createdAt: userRole.createdAt,
          expiresAt: userRole.expiresAt,
          grantedByUserId: userRole.grantedByUserId,
        }),
      )
      .execute();
  }

  async revokeUserRole(input: {
    userId: UserId;
    roleId: RoleId;
  }): Promise<void> {
    await this.db
      .deleteFrom("userRoles")
      .where("userId", "=", input.userId)
      .where("roleId", "=", input.roleId)
      .execute();
  }
}

function mapUserToInsert(user: User): Insertable<Users> {
  return {
    createdAt: user.createdAt,
    displayName: user.displayName,
    email: user.email,
    id: user.id,
    identityId: user.identityId,
    status: user.status,
    updatedAt: user.updatedAt,
  };
}

function mapUserToUpdate(user: User): Updateable<Users> {
  return {
    displayName: user.displayName,
    email: user.email,
    status: user.status,
    updatedAt: user.updatedAt,
  };
}

function mapUserRoleGrantToInsert(
  userRole: UserRoleGrant,
): Insertable<UserRoles> {
  return {
    createdAt: userRole.createdAt,
    expiresAt: userRole.expiresAt,
    grantedByUserId: userRole.grantedByUserId,
    roleId: userRole.roleId,
    userId: userRole.userId,
  };
}
