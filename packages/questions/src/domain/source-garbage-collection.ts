export const SOURCE_LIFECYCLE_RETENTION_DEFAULTS = {
  deletedBlueprintDays: 90,
  deletedFileAliasDays: 30,
  deletedSourceContentDays: 90,
  deletedSourceDocumentDays: 90,
  discardedDraftDays: 30,
  generatedQuestionSets: "until_explicitly_deleted",
  generationRuns: "conservatively_retained",
  workbookCalculationsAndSnapshots: "conservatively_retained",
} as const;

export type ProtectedSourceReferenceCounts = {
  activeDraftSourceBindings: number;
  activeFileAliases: number;
  activeSourceDocuments: number;
  generatedQuestions: number;
  generatedQuestionSetMembershipsConservativelyRetained: number;
  generationRunsConservativelyRetained: number;
  publishedBlueprintVersionSources: number;
  workbookCalculationsConservativelyRetained: number;
  workbookSnapshotsConservativelyRetained: number;
};

export type SourceGarbageCollectionEligibility =
  | { eligible: true }
  | {
      eligible: false;
      reason:
        | "already_collected"
        | "not_tombstoned"
        | "retained"
        | "protected_reference";
    };

export function evaluateSourceGarbageCollection(input: {
  collectedAt: Date | null;
  deletedAt: Date | null;
  now: Date;
  protectedReferences: ProtectedSourceReferenceCounts;
  retentionExpiresAt: Date | null;
}): SourceGarbageCollectionEligibility {
  if (input.collectedAt) {
    return { eligible: false, reason: "already_collected" };
  }
  if (!input.deletedAt) {
    return { eligible: false, reason: "not_tombstoned" };
  }
  if (!input.retentionExpiresAt || input.retentionExpiresAt > input.now) {
    return { eligible: false, reason: "retained" };
  }
  if (Object.values(input.protectedReferences).some((count) => count > 0)) {
    return { eligible: false, reason: "protected_reference" };
  }
  return { eligible: true };
}
