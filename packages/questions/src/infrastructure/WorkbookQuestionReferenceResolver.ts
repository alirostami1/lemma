import type { JsonValue } from "@lemma/domain";
import { WorkbookQuestionReferenceError } from "../application/errors.js";
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
    throw new WorkbookQuestionReferenceError(
      "Workbook snapshot resolver port is not configured.",
    );
  }
}

export class UnsupportedWorkbookInternalSnapshotResolverPort
  implements WorkbookInternalSnapshotResolverPort
{
  async resolveValueSource(): Promise<JsonValue> {
    throw new WorkbookQuestionReferenceError(
      "Workbook internal snapshot resolver port is not configured.",
    );
  }
}
