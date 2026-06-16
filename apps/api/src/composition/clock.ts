import type { Clock as FilesClock } from "@lemma/files/application";
import type { Clock as IdentityClock } from "@lemma/identity/application";
import type { Clock as NotificationsClock } from "@lemma/notifications/application";
import type { Clock as QuestionsClock } from "@lemma/questions/application";
import type { Clock as WorkbookClock } from "@lemma/workbook/application";

export type ApiClock = FilesClock &
  IdentityClock &
  NotificationsClock &
  QuestionsClock &
  WorkbookClock;

export function createClock(): ApiClock {
  return {
    now: () => new Date(),
  };
}
