import assert from "node:assert/strict";
import test from "node:test";
import {
  createSourceArtifact,
  createSourceDocument,
  createSourceRevision,
  reconstituteSourceArtifact,
  sourceArtifactId,
  sourceDocumentId,
  sourceRevisionId,
  userId,
  workbookId,
} from "./index.js";

const at = new Date("2026-06-26T00:00:00.000Z");
const ownerUserId = userId("019e9315-6a87-715f-9861-8654df120001");
const documentId = sourceDocumentId("019e9315-6a87-715f-9861-8654df120002");
const revisionId = sourceRevisionId("019e9315-6a87-715f-9861-8654df120003");
const artifactId = sourceArtifactId("019e9315-6a87-715f-9861-8654df120004");
const sourceWorkbookId = workbookId("019e9315-6a87-715f-9861-8654df120005");

test("creates workbook source document revision and valid artifact", () => {
  const document = createSourceDocument(
    {
      id: documentId,
      kind: "workbook",
      name: "Rates workbook",
      ownerUserId,
    },
    at,
  );
  const revision = createSourceRevision({
    byteSize: 1234,
    checksumSha256: "a".repeat(64),
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    createdAt: at,
    createdByUserId: ownerUserId,
    editorMetadata: {},
    fileId: "019e9315-6a87-715f-9861-8654df120006",
    id: revisionId,
    kind: "workbook",
    ownerUserId,
    parentRevisionId: null,
    sourceDocumentId: document.id,
  });
  const artifact = createSourceArtifact(
    {
      artifactMetadata: {},
      id: artifactId,
      kind: "workbook",
      ownerUserId,
      processor: "lemma-workbook",
      processorVersion: "1",
      sourceRevisionId: revision.id,
      status: "valid",
      validationError: null,
      workbookId: sourceWorkbookId,
    },
    at,
  );

  assert.equal(document.status, "active");
  assert.equal(revision.sourceDocumentId, document.id);
  assert.equal(artifact.status, "valid");
  assert.equal(artifact.workbookId, sourceWorkbookId);
});

test("rejects valid workbook artifact without workbook", () => {
  assert.throws(
    () =>
      createSourceArtifact(
        {
          artifactMetadata: {},
          id: artifactId,
          kind: "workbook",
          ownerUserId,
          processor: "lemma-workbook",
          processorVersion: "1",
          sourceRevisionId: revisionId,
          status: "valid",
          validationError: null,
          workbookId: null,
        },
        at,
      ),
    /valid workbook source artifact must reference a workbook/,
  );
});

test("rejects reconstituted valid workbook artifact without workbook", () => {
  assert.throws(
    () =>
      reconstituteSourceArtifact({
        artifactMetadata: {},
        collectedAt: null,
        createdAt: at,
        deletedAt: null,
        id: artifactId,
        kind: "workbook",
        ownerUserId,
        processor: "lemma-workbook",
        processorVersion: "1",
        retentionExpiresAt: null,
        sourceRevisionId: revisionId,
        status: "valid",
        updatedAt: at,
        validationError: null,
        workbookId: null,
      }),
    /valid workbook source artifact must reference a workbook/,
  );
});

test("rejects source artifact with workbook for non-workbook kind", () => {
  assert.throws(
    () =>
      createSourceArtifact(
        {
          artifactMetadata: {},
          id: artifactId,
          kind: "python",
          ownerUserId,
          processor: "lemma-python",
          processorVersion: "1",
          sourceRevisionId: revisionId,
          status: "invalid",
          validationError: {},
          workbookId: sourceWorkbookId,
        },
        at,
      ),
    /source artifact with workbook must be workbook kind/,
  );
});
