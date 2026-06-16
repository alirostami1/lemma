import type { Kysely } from "kysely";

const roles = [
  {
    key: "admin",
    name: "Admin",
    description: "Full application administration.",
  },
  {
    key: "member",
    name: "Member",
    description: "Default authenticated user.",
  },
  {
    key: "support",
    name: "Support",
    description: "Support access.",
  },
  {
    key: "teacher",
    name: "Teacher",
    description: "Teacher Access.",
  },
] as const;

export async function up(db: Kysely<any>): Promise<void> {
  await db
    .insertInto("roles")
    .values(roles.map((role) => ({ ...role, is_system: true })))
    .onConflict((oc) => oc.column("key").doNothing())
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db
    .deleteFrom("roles")
    .where(
      "key",
      "in",
      roles.map((role) => role.key),
    )
    .execute();
}
