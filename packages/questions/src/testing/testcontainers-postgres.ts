import {
  closeDatabase,
  createDatabase,
  type DatabasePort,
  migrateDatabaseToLatest,
  sql,
} from "@lemma/db";
import type { DB } from "@lemma/db/tables";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import type { Kysely } from "kysely";

// Lemma migrations use uuidv7() defaults. Keep this aligned with the repo's
// dev/runtime image so tests exercise the same database contract.
const lemmaPostgresImage = "docker.io/library/postgres:18-alpine";

export type TestDatabase = {
  db: Kysely<DB>;
  database: DatabasePort;
  connectionString: string;
  reset(): Promise<void>;
  stop(): Promise<void>;
};

export async function startTestDatabase(): Promise<TestDatabase> {
  let container: StartedPostgreSqlContainer | null = null;
  let db: Kysely<DB> | null = null;

  try {
    container = await new PostgreSqlContainer(lemmaPostgresImage)
      .withDatabase("lemma_test")
      .withUsername("postgres")
      .withPassword("postgres")
      .start();
  } catch (error) {
    throw new Error(
      "Question persistence integration tests require Docker/Testcontainers. Start Docker and rerun pnpm --filter @lemma/questions test.",
      { cause: error },
    );
  }

  try {
    const connectionString = container.getConnectionUri();
    ({ db } = createDatabase(connectionString, { max: 4 }));

    const migrationResult = await migrateDatabaseToLatest(db);
    if (migrationResult.error) {
      throw migrationResult.error;
    }

    const startedContainer = container;
    const startedDb = db;

    const database: DatabasePort = {
      executor: startedDb,
      transaction: (fn) => startedDb.transaction().execute(fn),
    };

    return {
      connectionString,
      database,
      db: startedDb,
      reset: () => truncatePublicTables(startedDb),
      stop: () =>
        cleanupStartedTestDatabase({
          container: startedContainer,
          db: startedDb,
        }),
    };
  } catch (error) {
    try {
      await cleanupStartedTestDatabase({ container, db });
    } catch (cleanupError) {
      console.error(
        "Question persistence integration database cleanup also failed after setup failed.",
        cleanupError,
      );
    }
    throw new Error(
      "Question persistence integration database setup failed after the Testcontainers Postgres container started. Check Lemma migrations, the Postgres image, and uuidv7() support.",
      { cause: error },
    );
  }
}

async function cleanupStartedTestDatabase(input: {
  db: Kysely<DB> | null;
  container: StartedPostgreSqlContainer | null;
}): Promise<void> {
  try {
    if (input.db) {
      await closeDatabase(input.db);
    }
  } finally {
    if (input.container) {
      await input.container.stop();
    }
  }
}

async function truncatePublicTables(db: Kysely<DB>): Promise<void> {
  const rows = await sql<{ tableName: string }>`
    select tablename as "tableName"
    from pg_tables
    where schemaname = 'public'
      and tablename not in ('kysely_migration', 'kysely_migration_lock')
    order by tablename
  `.execute(db);

  if (rows.rows.length === 0) {
    return;
  }

  // This reset intentionally leaves only Kysely migration metadata. Tests must
  // seed every domain row they require.
  //
  // Test-only raw SQL: Kysely does not provide simple schema-wide truncate. The
  // table names come from pg_tables, then identifiers are quoted defensively.
  const identifiers = rows.rows.map(
    (row) => `${quoteIdentifier("public")}.${quoteIdentifier(row.tableName)}`,
  );
  await sql
    .raw(`truncate table ${identifiers.join(", ")} restart identity cascade`)
    .execute(db);
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}
