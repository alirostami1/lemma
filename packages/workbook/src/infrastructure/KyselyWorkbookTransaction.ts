import type { DatabasePort } from "@lemma/db";
import { createKyselyOutboxRepository } from "@lemma/events/infrastructure";
import type { WorkbookTransactionPort } from "../application/index.js";
import { KyselyWorkbookRepository } from "./KyselyWorkbookRepository.js";

export function createKyselyWorkbookTransaction(
  db: DatabasePort,
): WorkbookTransactionPort {
  return {
    transaction: (fn) =>
      db.transaction((tx) =>
        fn({
          workbookRepository: new KyselyWorkbookRepository(tx),
          outboxRepository: createKyselyOutboxRepository(tx),
        }),
      ),
  };
}
