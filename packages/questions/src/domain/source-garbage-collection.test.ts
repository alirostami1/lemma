import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateSourceGarbageCollection,
  type ProtectedSourceReferenceCounts,
} from "./index.js";

const deletedAt = new Date("2026-01-01T00:00:00.000Z");
const retentionExpiresAt = new Date("2026-04-01T00:00:00.000Z");
const afterRetention = new Date("2026-04-02T00:00:00.000Z");

test("shared artifact remains protected while either published version references it", () => {
  const protectedReferences = noProtectedReferences();
  protectedReferences.publishedBlueprintVersionSources = 2;

  assert.deepEqual(eligibility(protectedReferences, afterRetention), {
    eligible: false,
    reason: "protected_reference",
  });

  protectedReferences.publishedBlueprintVersionSources = 1;
  assert.deepEqual(eligibility(protectedReferences, afterRetention), {
    eligible: false,
    reason: "protected_reference",
  });
});

test("artifact becomes eligible only after all references and retention expire", () => {
  const protectedReferences = noProtectedReferences();

  assert.deepEqual(
    eligibility(protectedReferences, new Date("2026-03-31T00:00:00.000Z")),
    { eligible: false, reason: "retained" },
  );
  assert.deepEqual(eligibility(protectedReferences, afterRetention), {
    eligible: true,
  });
});

test("published versions and generated question sets outlive deleted file aliases", () => {
  const protectedReferences = noProtectedReferences();
  protectedReferences.publishedBlueprintVersionSources = 1;
  protectedReferences.generatedQuestionSetMembershipsConservativelyRetained = 1;

  assert.deepEqual(eligibility(protectedReferences, afterRetention), {
    eligible: false,
    reason: "protected_reference",
  });
});

function eligibility(
  protectedReferences: ProtectedSourceReferenceCounts,
  now: Date,
) {
  return evaluateSourceGarbageCollection({
    collectedAt: null,
    deletedAt,
    now,
    protectedReferences,
    retentionExpiresAt,
  });
}

function noProtectedReferences(): ProtectedSourceReferenceCounts {
  return {
    activeDraftSourceBindings: 0,
    activeFileAliases: 0,
    activeSourceDocuments: 0,
    generatedQuestions: 0,
    generatedQuestionSetMembershipsConservativelyRetained: 0,
    generationRunsConservativelyRetained: 0,
    publishedBlueprintVersionSources: 0,
    workbookCalculationsConservativelyRetained: 0,
    workbookSnapshotsConservativelyRetained: 0,
  };
}
