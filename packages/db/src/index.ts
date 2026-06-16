import {
  CamelCasePlugin,
  type Expression,
  Kysely,
  PostgresDialect,
  sql,
  type Transaction,
} from "kysely";
import { Pool } from "pg";
import type { DB } from "./types.js";

export { sql };

export type DatabaseHandle = {
  db: Kysely<DB>;
  pool: Pool;
};

export function createDatabase(databaseUrl: string): DatabaseHandle {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 10,
  });
  const db = new Kysely<DB>({
    dialect: new PostgresDialect({ pool }),
    plugins: [new CamelCasePlugin()],
  });
  return { db, pool };
}

export function closeDatabase(db: Kysely<DB>) {
  return db.destroy();
}

export type DatabaseExecutor = Kysely<DB> | Transaction<DB>;

export type DatabasePort = {
  executor: DatabaseExecutor;
  transaction<T>(fn: (tx: DatabaseExecutor) => Promise<T>): Promise<T>;
};

export function upper(expr: Expression<string>) {
  return sql<string>`upper(${expr})`;
}

export function lower(expr: Expression<string>) {
  return sql<string>`lower(${expr})`;
}

export function concat(...exprs: Expression<string>[]) {
  return sql.join<string>(exprs, sql`||`);
}
