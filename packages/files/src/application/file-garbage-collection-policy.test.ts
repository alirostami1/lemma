import assert from "node:assert/strict";
import test from "node:test";
import { createFileFromUpload, markFileDeleting } from "../domain/index.js";
import { evaluateFileGarbageCollection } from "./file-garbage-collection-policy.js";
import type { ProtectedFileReferenceCounts } from "./ports.js";

const file = markFileDeleting(
  createFileFromUpload(
    {
      bucket: "files",
      byteSize: 42,
      checksumSha256: "a".repeat(64),
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      createdByUserId: "019f0db0-a3a1-7a61-9101-8947e43c4001",
      id: "019f0db0-a3a1-7a61-9101-8947e43c4002",
      objectKey: "content",
      originalName: "content.bin",
      ownerUserId: "019f0db0-a3a1-7a61-9101-8947e43c4001",
      purpose: "workbook",
      uploadId: "019f0db0-a3a1-7a61-9101-8947e43c4003",
    },
    new Date("2026-01-01T00:00:00.000Z"),
  ),
  new Date("2026-01-01T00:00:00.000Z"),
);
const now = new Date("2026-03-01T00:00:00.000Z");

test("every protected root independently blocks file collection", () => {
  for (const root of Object.keys(noReferences()) as Array<
    keyof ProtectedFileReferenceCounts
  >) {
    const protectedReferences = noReferences();
    protectedReferences[root] = 1;
    assert.deepEqual(
      evaluateFileGarbageCollection({ file, now, protectedReferences }),
      { eligible: false, reason: "protected_reference" },
      root,
    );
  }
});

function noReferences(): ProtectedFileReferenceCounts {
  return {
    activeDraftSourceBindings: 0,
    activeFileAliases: 0,
    activeSourceDocuments: 0,
    activeWorkbooks: 0,
    generatedQuestions: 0,
    generatedQuestionSetMembershipsConservativelyRetained: 0,
    generationRunsConservativelyRetained: 0,
    publishedBlueprintVersionSources: 0,
    sourceRevisionsWithoutArtifactsConservativelyRetained: 0,
    uncollectedSourceArtifacts: 0,
    workbookCalculationsConservativelyRetained: 0,
    workbookSnapshotsConservativelyRetained: 0,
  };
}
