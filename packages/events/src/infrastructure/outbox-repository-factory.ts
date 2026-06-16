import type { Kysely, Transaction } from "kysely";
import { KyselyOutboxRepository } from "./KyselyOutboxRepository.js";
import type { OutboxDatabaseExecutor } from "./outbox-database.js";

export function createKyselyOutboxRepository<Database>(
  db: Kysely<Database> | Transaction<Database>,
): KyselyOutboxRepository {
  return new KyselyOutboxRepository(db as unknown as OutboxDatabaseExecutor);
}
