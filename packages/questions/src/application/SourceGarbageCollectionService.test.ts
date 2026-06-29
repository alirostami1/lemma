import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  type ProtectedSourceReferenceCounts,
  reconstituteSourceArtifact,
  reconstituteSourceDocument,
  reconstituteSourceRevision,
  type SourceArtifact,
  type SourceDocument,
  type SourceRevision,
  sourceArtifactId,
  sourceDocumentId,
  sourceRevisionId,
  userId,
  workbookId,
} from "../domain/index.js";
import type { QuestionsRepository } from "./ports.js";
import { SourceGarbageCollectionService } from "./SourceGarbageCollectionService.js";

const now = new Date("2026-06-28T00:00:00.000Z");
const retainedUntil = new Date("2026-07-28T00:00:00.000Z");
const expiredAt = new Date("2026-06-27T00:00:00.000Z");
const ownerUserId = userId("019e9315-6a87-715f-9861-8654df150001");
const otherUserId = userId("019e9315-6a87-715f-9861-8654df150002");
const documentId = sourceDocumentId("019e9315-6a87-715f-9861-8654df150003");
const revisionId = sourceRevisionId("019e9315-6a87-715f-9861-8654df150004");
const artifactId = sourceArtifactId("019e9315-6a87-715f-9861-8654df150005");
const sourceWorkbookId = workbookId("019e9315-6a87-715f-9861-8654df150006");

describe("SourceGarbageCollectionService", () => {
  it("returns not_found for missing or wrong-owner source documents", async () => {
    assert.equal(
      await createService(
        new FakeQuestionsRepository(),
      ).tombstoneSourceDocument({
        ownerUserId,
        sourceDocumentId: documentId,
      }),
      "not_found",
    );

    const repository = new FakeQuestionsRepository({
      document: activeDocument({ ownerUserId: otherUserId }),
    });
    assert.equal(
      await createService(repository).tombstoneSourceDocument({
        ownerUserId,
        sourceDocumentId: documentId,
      }),
      "not_found",
    );
  });

  it("tombstones document, revisions, and artifacts with one retention deadline", async () => {
    const repository = new FakeQuestionsRepository({
      artifact: activeArtifact(),
      document: activeDocument(),
      revision: activeRevision(),
    });

    assert.equal(
      await createService(repository).tombstoneSourceDocument({
        ownerUserId,
        sourceDocumentId: documentId,
      }),
      "tombstoned",
    );

    assert.equal(repository.document?.status, "deleted");
    assert.equal(repository.document?.deletedAt?.getTime(), now.getTime());
    assert.equal(
      repository.document?.retentionExpiresAt?.getTime(),
      new Date("2026-09-26T00:00:00.000Z").getTime(),
    );
    assert.equal(
      repository.revision?.deletedAt,
      repository.document?.deletedAt,
    );
    assert.equal(
      repository.artifact?.deletedAt,
      repository.document?.deletedAt,
    );
    assert.equal(repository.artifact?.status, "valid");
  });

  it("does not extend retention on repeated source document tombstone", async () => {
    const repository = new FakeQuestionsRepository({
      document: deletedDocument(),
    });

    assert.equal(
      await createService(repository).tombstoneSourceDocument({
        ownerUserId,
        sourceDocumentId: documentId,
      }),
      "tombstoned",
    );
    assert.equal(repository.tombstoneCalls, 0);
    assert.equal(repository.document?.retentionExpiresAt, expiredAt);
  });

  it("skips artifact collection when artifact is missing, active, retained, protected, or already collected", async () => {
    assert.deepEqual(
      await createService(new FakeQuestionsRepository()).collectSourceArtifact({
        sourceArtifactId: artifactId,
      }),
      { status: "not_found" },
    );

    assert.deepEqual(
      await createService(
        new FakeQuestionsRepository({ artifact: activeArtifact() }),
      ).collectSourceArtifact({ sourceArtifactId: artifactId }),
      {
        eligibility: { eligible: false, reason: "not_tombstoned" },
        status: "skipped",
      },
    );

    assert.deepEqual(
      await createService(
        new FakeQuestionsRepository({
          artifact: deletedArtifact({ retentionExpiresAt: retainedUntil }),
        }),
      ).collectSourceArtifact({ sourceArtifactId: artifactId }),
      {
        eligibility: { eligible: false, reason: "retained" },
        status: "skipped",
      },
    );

    assert.deepEqual(
      await createService(
        new FakeQuestionsRepository({
          artifact: deletedArtifact(),
          protectedReferences: {
            ...emptyProtectedReferences(),
            activeDraftSourceBindings: 1,
          },
        }),
      ).collectSourceArtifact({ sourceArtifactId: artifactId }),
      {
        eligibility: { eligible: false, reason: "protected_reference" },
        status: "skipped",
      },
    );

    assert.deepEqual(
      await createService(
        new FakeQuestionsRepository({
          artifact: deletedArtifact({ collectedAt: now, status: "deleted" }),
        }),
      ).collectSourceArtifact({ sourceArtifactId: artifactId }),
      {
        eligibility: { eligible: false, reason: "already_collected" },
        status: "skipped",
      },
    );
  });

  it("skips artifact collection for every protected root count", async () => {
    for (const root of Object.keys(emptyProtectedReferences()) as Array<
      keyof ProtectedSourceReferenceCounts
    >) {
      const repository = new FakeQuestionsRepository({
        artifact: deletedArtifact(),
        protectedReferences: { ...emptyProtectedReferences(), [root]: 1 },
      });

      const result = await createService(repository).collectSourceArtifact({
        sourceArtifactId: artifactId,
      });

      assert.deepEqual(result, {
        eligibility: { eligible: false, reason: "protected_reference" },
        status: "skipped",
      });
      assert.equal(repository.collectionCalls.length, 0);
    }
  });

  it("collects expired unprotected artifacts and retires an artifact-owned backing workbook", async () => {
    const repository = new FakeQuestionsRepository({
      artifact: deletedArtifact(),
      backingWorkbookOrigin: "source_artifact",
    });

    assert.deepEqual(
      await createService(repository).collectSourceArtifact({
        sourceArtifactId: artifactId,
      }),
      { status: "collected" },
    );

    assert.equal(repository.artifact?.status, "deleted");
    assert.equal(repository.artifact?.collectedAt?.getTime(), now.getTime());
    assert.deepEqual(repository.collectionCalls, [
      {
        retireBackingWorkbook: true,
        sourceArtifactId: artifactId,
      },
    ]);
  });

  it("returns already collected when a concurrent collector wins the update race", async () => {
    const repository = new FakeQuestionsRepository({
      artifact: deletedArtifact(),
    });
    repository.loseNextCollectionRaceWithCollectedArtifact = true;

    assert.deepEqual(
      await createService(repository).collectSourceArtifact({
        sourceArtifactId: artifactId,
      }),
      {
        eligibility: { eligible: false, reason: "already_collected" },
        status: "skipped",
      },
    );
    assert.equal(repository.countProtectedSourceArtifactReferenceCalls, 2);
  });

  it("returns retry when collection update loses a race but artifact remains eligible", async () => {
    const repository = new FakeQuestionsRepository({
      artifact: deletedArtifact(),
    });
    repository.loseNextCollectionRaceWithEligibleArtifact = true;

    assert.deepEqual(
      await createService(repository).collectSourceArtifact({
        sourceArtifactId: artifactId,
      }),
      { reason: "collection_conflict", status: "retry" },
    );
    assert.equal(repository.countProtectedSourceArtifactReferenceCalls, 2);
  });

  it("returns not_found when collection update loses a race and artifact disappears", async () => {
    const repository = new FakeQuestionsRepository({
      artifact: deletedArtifact(),
    });
    repository.loseNextCollectionRaceWithMissingArtifact = true;

    assert.deepEqual(
      await createService(repository).collectSourceArtifact({
        sourceArtifactId: artifactId,
      }),
      { status: "not_found" },
    );
  });

  it("rechecks protected roots when collection update loses a race", async () => {
    const repository = new FakeQuestionsRepository({
      artifact: deletedArtifact(),
      protectedReferencesAfterFailedCollectionUpdate: {
        ...emptyProtectedReferences(),
        publishedBlueprintVersionSources: 1,
      },
    });
    repository.loseNextCollectionRaceWithEligibleArtifact = true;

    assert.deepEqual(
      await createService(repository).collectSourceArtifact({
        sourceArtifactId: artifactId,
      }),
      {
        eligibility: { eligible: false, reason: "protected_reference" },
        status: "skipped",
      },
    );
    assert.equal(repository.countProtectedSourceArtifactReferenceCalls, 2);
  });

  it("does not retire a standalone backing workbook", async () => {
    const repository = new FakeQuestionsRepository({
      artifact: deletedArtifact(),
      backingWorkbookOrigin: "standalone",
    });

    assert.deepEqual(
      await createService(repository).collectSourceArtifact({
        sourceArtifactId: artifactId,
      }),
      { status: "collected" },
    );
    assert.equal(repository.collectionCalls[0]?.retireBackingWorkbook, false);
  });

  it("does not retire a source-owned workbook still owned by another uncollected source artifact", async () => {
    const repository = new FakeQuestionsRepository({
      artifact: deletedArtifact(),
      backingWorkbookOrigin: "source_artifact",
      otherUncollectedArtifactsForWorkbook: 1,
    });

    assert.deepEqual(
      await createService(repository).collectSourceArtifact({
        sourceArtifactId: artifactId,
      }),
      { status: "collected" },
    );
    assert.equal(repository.collectionCalls[0]?.retireBackingWorkbook, false);
  });
});

function createService(repository: FakeQuestionsRepository) {
  return new SourceGarbageCollectionService({
    clock: { now: () => now },
    questionsTransaction: {
      transaction: (fn) =>
        fn({
          // This focused fake intentionally implements only repository methods
          // exercised by SourceGarbageCollectionService.
          questionsRepository: repository as unknown as QuestionsRepository,
        }),
    },
  });
}

function activeDocument(patch: Partial<SourceDocument> = {}): SourceDocument {
  return reconstituteSourceDocument({
    createdAt: now,
    currentRevisionId: revisionId,
    deletedAt: null,
    id: documentId,
    kind: "workbook",
    name: "Source document",
    ownerUserId,
    retentionExpiresAt: null,
    status: "active",
    updatedAt: now,
    ...patch,
  });
}

function deletedDocument(): SourceDocument {
  return activeDocument({
    deletedAt: now,
    retentionExpiresAt: expiredAt,
    status: "deleted",
  });
}

function activeRevision(): SourceRevision {
  return reconstituteSourceRevision({
    byteSize: 1234,
    checksumSha256: "a".repeat(64),
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    createdAt: now,
    createdByUserId: ownerUserId,
    deletedAt: null,
    editorMetadata: {},
    fileId: "019e9315-6a87-715f-9861-8654df150007",
    id: revisionId,
    kind: "workbook",
    ownerUserId,
    parentRevisionId: null,
    retentionExpiresAt: null,
    sourceDocumentId: documentId,
  });
}

function activeArtifact(patch: Partial<SourceArtifact> = {}): SourceArtifact {
  return reconstituteSourceArtifact({
    artifactMetadata: {},
    collectedAt: null,
    createdAt: now,
    deletedAt: null,
    id: artifactId,
    kind: "workbook",
    ownerUserId,
    processor: "lemma-workbook",
    processorVersion: "1",
    retentionExpiresAt: null,
    sourceRevisionId: revisionId,
    status: "valid",
    updatedAt: now,
    validationError: null,
    workbookId: sourceWorkbookId,
    ...patch,
  });
}

function deletedArtifact(patch: Partial<SourceArtifact> = {}): SourceArtifact {
  return activeArtifact({
    deletedAt: now,
    retentionExpiresAt: expiredAt,
    ...patch,
  });
}

function emptyProtectedReferences(): ProtectedSourceReferenceCounts {
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

class FakeQuestionsRepository {
  artifact: SourceArtifact | null;
  document: SourceDocument | null;
  revision: SourceRevision | null;
  protectedReferences: ProtectedSourceReferenceCounts;
  protectedReferencesAfterFailedCollectionUpdate: ProtectedSourceReferenceCounts | null;
  countProtectedSourceArtifactReferenceCalls = 0;
  collectionUpdateReturnedNull = false;
  tombstoneCalls = 0;
  otherUncollectedArtifactsForWorkbook: number;
  backingWorkbookOrigin: "standalone" | "source_artifact" | null;
  loseNextCollectionRaceWithCollectedArtifact = false;
  loseNextCollectionRaceWithEligibleArtifact = false;
  loseNextCollectionRaceWithMissingArtifact = false;
  readonly collectionCalls: Array<{
    retireBackingWorkbook: boolean;
    sourceArtifactId: typeof artifactId;
  }> = [];

  constructor(
    input: {
      artifact?: SourceArtifact;
      backingWorkbookOrigin?: "standalone" | "source_artifact" | null;
      document?: SourceDocument;
      otherUncollectedArtifactsForWorkbook?: number;
      protectedReferencesAfterFailedCollectionUpdate?: ProtectedSourceReferenceCounts;
      protectedReferences?: ProtectedSourceReferenceCounts;
      revision?: SourceRevision;
    } = {},
  ) {
    this.artifact = input.artifact ?? null;
    this.backingWorkbookOrigin = input.backingWorkbookOrigin ?? null;
    this.document = input.document ?? null;
    this.otherUncollectedArtifactsForWorkbook =
      input.otherUncollectedArtifactsForWorkbook ?? 0;
    this.protectedReferences =
      input.protectedReferences ?? emptyProtectedReferences();
    this.protectedReferencesAfterFailedCollectionUpdate =
      input.protectedReferencesAfterFailedCollectionUpdate ?? null;
    this.revision = input.revision ?? null;
  }

  async findSourceDocumentByIdForUpdate() {
    return this.document;
  }

  async tombstoneSourceDocumentGraph(input: { document: SourceDocument }) {
    this.tombstoneCalls += 1;
    this.document = input.document;
    if (this.revision) {
      this.revision = {
        ...this.revision,
        deletedAt: input.document.deletedAt,
        retentionExpiresAt: input.document.retentionExpiresAt,
      };
    }
    if (this.artifact) {
      this.artifact = {
        ...this.artifact,
        deletedAt: input.document.deletedAt,
        retentionExpiresAt: input.document.retentionExpiresAt,
      };
    }
    return true;
  }

  async findSourceArtifactByIdForUpdate() {
    return this.artifact;
  }

  async findSourceArtifactById() {
    return this.artifact;
  }

  async countProtectedSourceArtifactReferences() {
    this.countProtectedSourceArtifactReferenceCalls += 1;
    if (
      this.collectionUpdateReturnedNull &&
      this.protectedReferencesAfterFailedCollectionUpdate
    ) {
      return this.protectedReferencesAfterFailedCollectionUpdate;
    }
    return this.protectedReferences;
  }

  async findSourceArtifactBackingWorkbookForUpdate() {
    if (!this.backingWorkbookOrigin) return null;
    return {
      id: sourceWorkbookId,
      origin: this.backingWorkbookOrigin,
      otherUncollectedSourceArtifacts:
        this.otherUncollectedArtifactsForWorkbook,
    };
  }

  async updateSourceArtifactForCollection(input: {
    artifact: SourceArtifact;
    retireBackingWorkbook: boolean;
  }) {
    if (this.loseNextCollectionRaceWithCollectedArtifact) {
      this.loseNextCollectionRaceWithCollectedArtifact = false;
      this.collectionUpdateReturnedNull = true;
      this.artifact = input.artifact;
      return null;
    }
    if (this.loseNextCollectionRaceWithEligibleArtifact) {
      this.loseNextCollectionRaceWithEligibleArtifact = false;
      this.collectionUpdateReturnedNull = true;
      return null;
    }
    if (this.loseNextCollectionRaceWithMissingArtifact) {
      this.loseNextCollectionRaceWithMissingArtifact = false;
      this.collectionUpdateReturnedNull = true;
      this.artifact = null;
      return null;
    }
    this.artifact = input.artifact;
    this.collectionCalls.push({
      retireBackingWorkbook: input.retireBackingWorkbook,
      sourceArtifactId: input.artifact.id,
    });
    return input.artifact;
  }
}
