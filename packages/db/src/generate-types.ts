import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createDatabaseConfig } from "@lemma/config";
import { CamelCasePlugin, Kysely, PostgresDialect } from "kysely";
import pg from "pg";

const config = createDatabaseConfig();

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.dirname(currentDir);
const migrationDir = path.join(currentDir, "migrations");
const databaseName = `lemma_codegen_${Date.now()}`;
const baseUrl = new URL(config.databaseUrl);
const admin = new pg.Client({ connectionString: baseUrl.toString() });
let databaseCreated = false;

await admin.connect();
try {
  await admin.query(`CREATE DATABASE ${databaseName}`);
  databaseCreated = true;
  const targetUrl = new URL(baseUrl);
  targetUrl.pathname = `/${databaseName}`;
  await applyMigrations(targetUrl.toString());
  execFileSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    [
      "exec",
      "kysely-codegen",
      "--camel-case",
      "--dialect",
      "postgres",
      "--log-level",
      "info",
      "--out-file",
      "./src/types.d.ts",
    ],
    {
      cwd: packageDir,
      env: { ...process.env, DATABASE_URL: targetUrl.toString() },
      stdio: "inherit",
    },
  );
} finally {
  if (databaseCreated) {
    await admin.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1",
      [databaseName],
    );
    await admin.query(`DROP DATABASE IF EXISTS ${databaseName}`);
  }
  await admin.end();
}

async function applyMigrations(targetUrl: string): Promise<void> {
  const pool = new pg.Pool({ connectionString: targetUrl });
  const db = new Kysely<Record<string, never>>({
    dialect: new PostgresDialect({ pool }),
    plugins: [new CamelCasePlugin()],
  });
  try {
    const migrationFiles = (await fs.readdir(migrationDir))
      .filter((file) => /^\d+.*\.ts$/u.test(file))
      .sort();
    if (migrationFiles.length === 0) {
      throw new Error(`No migration source files found in ${migrationDir}.`);
    }
    for (const file of migrationFiles) {
      const migration = await import(
        pathToFileURL(path.join(migrationDir, file)).href
      );
      if (typeof migration.up !== "function") {
        throw new Error(`Migration ${file} does not export up().`);
      }
      await migration.up(db);
    }
  } finally {
    await db.destroy();
  }
}
