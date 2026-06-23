import type { Kysely } from "kysely";

type RolesSeedDb = {
  roles: {
    id: string;
    key: string;
    name: string;
    description: string;
    is_system: boolean;
  };
};

const roles = [
  {
    description: "Full application administration.",
    id: "019e9315-6a87-7000-8000-000000000001",
    key: "admin",
    name: "Admin",
  },
  {
    description: "Default authenticated user.",
    id: "019e9315-6a87-7000-8000-000000000002",
    key: "member",
    name: "Member",
  },
  {
    description: "Support access.",
    id: "019e9315-6a87-7000-8000-000000000003",
    key: "support",
    name: "Support",
  },
  {
    description: "Teacher access.",
    id: "019e9315-6a87-7000-8000-000000000004",
    key: "teacher",
    name: "Teacher",
  },
] as const;

export async function up(db: Kysely<RolesSeedDb>): Promise<void> {
  await db
    .insertInto("roles")
    .values(roles.map((role) => ({ ...role, is_system: true })))
    .onConflict((oc) => oc.column("key").doNothing())
    .execute();
}

export async function down(db: Kysely<RolesSeedDb>): Promise<void> {
  await db
    .deleteFrom("roles")
    .where(
      "key",
      "in",
      roles.map((role) => role.key),
    )
    .execute();
}
