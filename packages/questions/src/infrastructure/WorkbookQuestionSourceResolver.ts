import type { JsonValue } from "@lemma/domain";
import { WorkbookQuestionSourceError } from "../application/errors.js";
import type {
  WorkbookAccessPort,
  WorkbookInternalSnapshotResolverPort,
  WorkbookSnapshotResolverPort,
} from "../application/index.js";

export class DenyWorkbookAccessPort implements WorkbookAccessPort {
  async canUserAccessWorkbook(): Promise<boolean> {
    return false;
  }
}

export class UnsupportedWorkbookSnapshotResolverPort
  implements WorkbookSnapshotResolverPort
{
  async resolveValueSource(): Promise<JsonValue> {
    throw new WorkbookQuestionSourceError(
      "Workbook snapshot resolver port is not configured.",
    );
  }
}

export class UnsupportedWorkbookInternalSnapshotResolverPort
  implements WorkbookInternalSnapshotResolverPort
{
  async resolveValueSource(): Promise<JsonValue> {
    throw new WorkbookQuestionSourceError(
      "Workbook internal snapshot resolver port is not configured.",
    );
  }
}
