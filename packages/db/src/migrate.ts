import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDatabaseConfig } from "@lemma/config";
import {
  FileMigrationProvider,
  type MigrationResultSet,
  Migrator,
} from "kysely";
import { closeDatabase, createDatabase } from "./index.js";

const command = process.argv[2] ?? "latest";
const config = createDatabaseConfig();

if (command !== "down" && command !== "up" && command !== "latest") {
  console.error("command not recognized: ", command);
  process.exit(1);
}

const { db } = createDatabase(config.databaseUrl);

async function runMigrations() {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const migrationFolder = path.join(currentDir, "migrations");
  console.log("applying migrations from folder: ", migrationFolder);
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder,
    }),
  });

  let result: MigrationResultSet;
  switch (command) {
    case "down":
      console.log("rolling back");
      result = await migrator.migrateDown();
      break;
    case "up":
      console.log("migrating up");
      result = await migrator.migrateUp();
      break;
    case "latest":
      console.log("migrating to latest");
      result = await migrator.migrateToLatest();
      break;
    default:
      console.error("unknown command");
      process.exit(3);
  }

  result.results?.forEach((migration) => {
    switch (migration.status) {
      case "Success":
        console.log(
          `migration "${migration.migrationName}" was executed successfully`,
        );
        break;
      case "Error":
        console.error(
          `failed to execute migration "${migration.migrationName}"`,
        );
        break;
      case "NotExecuted":
        console.error(`skipped migration "${migration.migrationName}"`);
        break;
    }
  });

  if (result.error) {
    console.error("failed to migrate");
    console.error(result.error);
    process.exitCode = 1;
  }
}

runMigrations()
  .catch((error) => {
    console.error("failed to migrate");
    console.error(error);
    process.exitCode = 10;
  })
  .finally(async () => {
    await closeDatabase(db);
  });
