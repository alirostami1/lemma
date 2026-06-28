import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CamelCasePlugin,
  type Expression,
  FileMigrationProvider,
  Kysely,
  type MigrationResultSet,
  Migrator,
  PostgresDialect,
  sql,
  type Transaction,
} from "kysely";
import { Pool, type PoolConfig } from "pg";
import type { DB } from "./types.js";

export { sql };

export type DatabaseHandle = {
  db: Kysely<DB>;
  pool: Pool;
};

export function createDatabase(
  databaseUrl: string,
  poolConfig: Omit<PoolConfig, "connectionString"> = {},
): DatabaseHandle {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 10,
    ...poolConfig,
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

export function createDatabaseMigrator(db: Kysely<DB>): Migrator {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const migrationFolder = path.join(currentDir, "migrations");

  return new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      migrationFolder,
      path,
    }),
  });
}

export function migrateDatabaseToLatest(
  db: Kysely<DB>,
): Promise<MigrationResultSet> {
  return createDatabaseMigrator(db).migrateToLatest();
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
