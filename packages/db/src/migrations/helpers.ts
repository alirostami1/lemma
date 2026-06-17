import type { Kysely } from "kysely";

export type MigrationDb = Kysely<Record<string, never>>;

export function documentDestructiveChange(input: {
  migration: string;
  operation: string;
  reason: string;
  rollbackPlan: string;
}): void {
  for (const [key, value] of Object.entries(input)) {
    if (value.trim().length === 0) {
      throw new Error(`destructive migration note is missing ${key}`);
    }
  }
}
