import type { DatabasePort } from "@lemma/db";
import { createKyselyOutboxRepository } from "@lemma/events/infrastructure";
import type {
  FileReferenceGuardPort,
  WorkbookTransactionPort,
} from "../application/index.js";
import { KyselyWorkbookRepository } from "./KyselyWorkbookRepository.js";

export function createKyselyWorkbookTransaction(
  db: DatabasePort,
  createFileReferenceGuardForTransaction: (
    tx: DatabasePort["executor"],
  ) => FileReferenceGuardPort,
): WorkbookTransactionPort {
  return {
    transaction: (fn) =>
      db.transaction((tx) =>
        fn({
          fileReferenceGuard: createFileReferenceGuardForTransaction(tx),
          outboxRepository: createKyselyOutboxRepository(tx),
          workbookRepository: new KyselyWorkbookRepository(tx),
        }),
      ),
  };
}
