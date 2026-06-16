import type { DatabaseExecutor } from "@lemma/db";
import { Hono } from "hono";
import { sql } from "kysely";

async function getHealth(database: DatabaseExecutor) {
  await sql`select 1`.execute(database);
}

export function healthRoutes(deps: { database: DatabaseExecutor }) {
  const app = new Hono();

  app.get("/health", async (c) => {
    await getHealth(deps.database);
    return c.json(
      {
        status: "ok",
        checks: {
          database: "ok",
        },
      },
      200,
    );
  });

  return app;
}
