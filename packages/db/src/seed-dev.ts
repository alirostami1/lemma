import { createDatabaseConfig } from "@lemma/config";
import { closeDatabase, createDatabase, sql } from "./index.js";

const config = createDatabaseConfig();

const devUsers = [
  {
    localUserId: "019e9315-6a87-715f-9861-8654df072001",
    identityId: "019e9315-6a87-715f-9861-8654df071001",
    email: "test@example.com",
    displayName: "Test User",
    roleKeys: ["member"],
  },
  {
    localUserId: "019e9315-6a87-715f-9861-8654df072002",
    identityId: "019e9315-6a87-715f-9861-8654df071002",
    email: "admin@example.com",
    displayName: "Admin User",
    roleKeys: ["admin"],
  },
] as const;

const { db } = createDatabase(config.databaseUrl);

async function seedDevUsers() {
  await db.transaction().execute(async (tx) => {
    for (const user of devUsers) {
      await sql`
        insert into users (id, identity_id, email, display_name, status)
        values (
          ${user.localUserId}::uuid,
          ${user.identityId},
          ${user.email},
          ${user.displayName},
          'active'
        )
        on conflict (identity_id)
        do update set
          email = excluded.email,
          display_name = excluded.display_name,
          status = 'active',
          updated_at = now()
      `.execute(tx);

      for (const roleKey of user.roleKeys) {
        await sql`
          insert into user_roles (
            user_id,
            role_id,
            granted_by_user_id,
            expires_at
          )
          select
            users.id,
            roles.id,
            users.id,
            now() + interval '10 years'
          from users
          join roles on roles.key = ${roleKey}
          where users.identity_id = ${user.identityId}
          on conflict (user_id, role_id)
          do update set
            granted_by_user_id = excluded.granted_by_user_id,
            expires_at = excluded.expires_at
        `.execute(tx);
      }
    }
  });
}

seedDevUsers()
  .then(() => {
    console.log("seeded dev identity users");
  })
  .catch((error) => {
    console.error("failed to seed dev identity users");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase(db);
  });
