import { serve } from "@hono/node-server";
import type { DatabasePort } from "@lemma/db";
import type { NodeObservability } from "@lemma/observability/node";
import { newApp } from "./app.js";
import { config } from "./config.js";
import { closeDatabase, db } from "./database.js";

export function startApiServer(input: { observability: NodeObservability }) {
  const database: DatabasePort = {
    executor: db,
    transaction: (fn) => db.transaction().execute((tx) => fn(tx)),
  };
  const app = newApp({ database });

  const server = serve({
    fetch: app.fetch,
    port: config.port,
  });

  console.log(`Server listening on http://localhost:${config.port}`);

  function shutdown(signal: NodeJS.Signals) {
    server.close(async (err) => {
      if (err) {
        console.error(err);
        process.exit(1);
      }

      await closeDatabase();
      await input.observability.shutdown();
      console.log(`Server stopped after ${signal}`);
      process.exit(0);
    });
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
