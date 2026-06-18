import { closeDatabase as close, createDatabase } from "@lemma/db";
import { config } from "./config.js";

export const { db, pool } = createDatabase(config.databaseUrl);

export function closeDatabase() {
  return close(db);
}
