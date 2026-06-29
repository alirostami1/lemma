import type { File } from "../domain/index.js";
import type { ProtectedFileReferenceCounts } from "./ports.js";

export type FileGarbageCollectionEligibility =
  | { eligible: true }
  | {
      eligible: false;
      reason: "not_deleting" | "retained" | "protected_reference";
    };

export function evaluateFileGarbageCollection(input: {
  file: File;
  now: Date;
  protectedReferences: ProtectedFileReferenceCounts;
}): FileGarbageCollectionEligibility {
  if (input.file.status !== "deleting") {
    return { eligible: false, reason: "not_deleting" };
  }
  if (
    !input.file.retentionExpiresAt ||
    input.file.retentionExpiresAt > input.now
  ) {
    return { eligible: false, reason: "retained" };
  }
  if (Object.values(input.protectedReferences).some((count) => count > 0)) {
    return { eligible: false, reason: "protected_reference" };
  }
  return { eligible: true };
}
