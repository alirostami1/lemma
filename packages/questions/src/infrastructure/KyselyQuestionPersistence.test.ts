import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DatabaseExecutor } from "@lemma/db";
import {
  QuestionBlueprintBaseVersionConflictError,
  QuestionBlueprintDraftRevisionConflictError,
  SourceDocumentHeadUpdateFailedError,
} from "../application/index.js";
import {
  createQuestionBlueprint,
  createQuestionBlueprintDraft,
  createQuestionBlueprintVersion,
  InvalidQuestionStateTransitionError,
  markQuestionBlueprintDraftPublished,
  type QuestionBlueprint,
  type QuestionBlueprintDraft,
  type QuestionBlueprintSource,
  type QuestionBlueprintVersion,
  questionBlueprintDescription,
  questionBlueprintDocument,
  questionBlueprintDraftId,
  questionBlueprintDraftSourcesFromRows,
  questionBlueprintId,
  questionBlueprintName,
  questionBlueprintVersionId,
  questionBlueprintVersionNumber,
  questionBlueprintVisibility,
  sourceArtifactId,
  sourceDocumentId,
  sourceRevisionId,
  userId,
  type WorkbookId,
  workbookId,
} from "../domain/index.js";
import { KyselyQuestionBlueprintDraftRepository } from "./KyselyQuestionBlueprintDraftRepository.js";
import { KyselyQuestionBlueprintRepository } from "./KyselyQuestionBlueprintRepository.js";
import { KyselySourceRepository } from "./KyselySourceRepository.js";

const at = new Date("2026-06-18T00:00:00.000Z");
const ownerUserId = userId("019e9315-6a87-715f-9861-8654df074010");
const creatorUserId = userId("019e9315-6a87-715f-9861-8654df074011");
const testSourceDocumentId = sourceDocumentId(
  "019e9315-6a87-715f-9861-8654df074301",
);
const testSourceRevisionId = sourceRevisionId(
  "019e9315-6a87-715f-9861-8654df074302",
);
const testSourceArtifactId = sourceArtifactId(
  "019e9315-6a87-715f-9861-8654df074303",
);
const testWorkbookId = workbookId("019e9315-6a87-715f-9861-8654df074201");

type DraftInputPatch = Partial<{
  baseVersionId: QuestionBlueprintDraft["baseVersionId"];
  blueprintId: QuestionBlueprintDraft["blueprintId"];
  createdByUserId: QuestionBlueprintDraft["createdByUserId"];
  description: QuestionBlueprintDraft["description"];
  document: QuestionBlueprintDraft["document"];
  id: QuestionBlueprintDraft["id"];
  name: QuestionBlueprintDraft["name"];
  ownerUserId: QuestionBlueprintDraft["ownerUserId"];
  sources: readonly QuestionBlueprintDraft["sources"][number][];
}>;

type BlueprintInputPatch = Partial<{
  createdByUserId: QuestionBlueprint["createdByUserId"];
  currentVersionId: QuestionBlueprint["currentVersionId"];
  description: QuestionBlueprint["description"];
  document: QuestionBlueprint["document"];
  id: QuestionBlueprint["id"];
  name: QuestionBlueprint["name"];
  ownerUserId: QuestionBlueprint["ownerUserId"];
  sources: readonly QuestionBlueprintSource[];
  visibility: QuestionBlueprint["visibility"];
}>;

describe("KyselyQuestion persistence", () => {
  it("updates blueprint lifecycle state without appending a version", async () => {
    const blueprint = createQuestionBlueprint(
      {
        createdByUserId: creatorUserId,
        currentVersionId: questionBlueprintVersionId(
          "019e9315-6a87-715f-9861-8654df074099",
        ),
        description: questionBlueprintDescription(null),
        document: emptyDocument(),
        id: questionBlueprintId("019e9315-6a87-715f-9861-8654df074012"),
        name: questionBlueprintName("Revenue"),
        ownerUserId,
        sources: [],
        visibility: questionBlueprintVisibility("private"),
      },
      at,
    );

    const db = createDbSpy(rowFromBlueprint(blueprint));
    const repository = new KyselyQuestionBlueprintRepository(db);

    const updated =
      await repository.saveQuestionBlueprintLifecycleState(blueprint);

    assert.equal(updated?.currentVersionId, blueprint.currentVersionId);
    assert.equal(
      db.state.insertValuesByTable.questionBlueprintVersions,
      undefined,
    );
    assert.equal(
      db.state.updateValuesByTable.questionBlueprints?.currentVersionId,
      blueprint.currentVersionId,
    );
  });

  it("does not persist draft sources in the draft json row", async () => {
    const draft = createQuestionBlueprintDraft(
      {
        baseVersionId: null,
        blueprintId: null,
        createdByUserId: creatorUserId,
        description: questionBlueprintDescription(null),
        document: emptyDocument(),
        id: questionBlueprintDraftId("019e9315-6a87-715f-9861-8654df074013"),
        name: questionBlueprintName("Draft"),
        ownerUserId,
        sources: [],
      },
      at,
    );

    const db = createDbSpy(rowFromDraft(draft));
    const repository = new KyselyQuestionBlueprintDraftRepository(db);

    const created = await repository.createQuestionBlueprintDraft(draft);
    const updated =
      await repository.updateQuestionBlueprintDraftWithExpectedRevision({
        draft,
        expectedRevision: draft.revision,
      });

    assert.equal(created.sources.length, 0);
    assert.equal(updated?.sources.length, 0);
    assert.equal(created.revision, 1);
    assert.equal(updated?.baseVersionId, null);
    assert.equal(
      "sources" in (db.state.insertValuesByTable.questionBlueprintDrafts ?? {}),
      false,
    );
    assert.equal(
      "sources" in (db.state.updateValuesByTable.questionBlueprintDrafts ?? {}),
      false,
    );
  });

  it("compares stored draft revision when expected revision is supplied", async () => {
    const draft = createQuestionBlueprintDraft(
      {
        baseVersionId: null,
        blueprintId: null,
        createdByUserId: creatorUserId,
        description: questionBlueprintDescription(null),
        document: emptyDocument(),
        id: questionBlueprintDraftId("019e9315-6a87-715f-9861-8654df074014"),
        name: questionBlueprintName("Draft"),
        ownerUserId,
        sources: [],
      },
      at,
    );

    const db = createDbSpy(rowFromDraft(draft));
    const repository = new KyselyQuestionBlueprintDraftRepository(db);

    await repository.updateQuestionBlueprintDraftWithExpectedRevision({
      draft,
      expectedRevision: 1,
    });

    assert.deepEqual(
      db.state.whereCallsByTable.questionBlueprintDrafts?.map((call) => [
        call.column,
        call.operator,
        call.value,
      ]),
      [
        ["id", "=", draft.id],
        ["revision", "=", 1],
      ],
    );
  });

  it("locks draft row for attach workflow reload", async () => {
    const draft = createTargetedDraftWithSources({
      document: documentUsing("sourceA"),
      sources: localSource("sourceA"),
    });
    const db = createDbSpy(rowFromDraft(draft), {
      rowsByTable: { questionBlueprintDrafts: rowFromDraft(draft) },
    });
    const repository = new KyselyQuestionBlueprintDraftRepository(db);

    const locked = await repository.findQuestionBlueprintDraftByIdForUpdate(
      draft.id,
    );

    assert.equal(locked?.id, draft.id);
    assert.equal(db.state.lockedForUpdate.questionBlueprintDrafts, true);
  });

  it("persists draft source pins in draft source rows", async () => {
    const draft = createTargetedDraftWithSources({
      document: documentUsing("sourceA"),
      sources: validatedSource("sourceA", testWorkbookId),
    });
    const db = createDbSpy(rowFromDraft(draft));
    const repository = new KyselyQuestionBlueprintDraftRepository(db);

    await repository.updateQuestionBlueprintDraftWithExpectedRevision({
      draft,
      expectedRevision: 1,
    });

    const values = db.state.insertValuesByTable.questionBlueprintDraftSources;
    assert.ok(Array.isArray(values));
    const first = values[0];
    if (!first || typeof first !== "object") {
      throw new Error("missing persisted source row");
    }
    const persisted = first as Record<string, unknown>;
    assert.equal(persisted.sourceDocumentId, testSourceDocumentId);
    assert.equal(persisted.sourceRevisionId, testSourceRevisionId);
    assert.equal(persisted.sourceArtifactId, testSourceArtifactId);
  });

  it("advances source document head without touching published version snapshots", async () => {
    const db = createDbSpy({
      createdAt: at,
      currentRevisionId: testSourceRevisionId,
      deletedAt: null,
      id: testSourceDocumentId,
      kind: "workbook",
      name: "Source A",
      ownerUserId,
      status: "active",
      updatedAt: at,
    });
    const repository = new KyselySourceRepository(db);

    await repository.setSourceDocumentCurrentRevision({
      currentRevisionId: sourceRevisionId(
        "019e9315-6a87-715f-9861-8654df074304",
      ),
      kind: "workbook",
      ownerUserId,
      sourceDocumentId: testSourceDocumentId,
      updatedAt: at,
    });

    assert.equal(
      db.state.updateValuesByTable.sourceDocuments?.currentRevisionId,
      "019e9315-6a87-715f-9861-8654df074304",
    );
    assert.equal(
      db.state.updateValuesByTable.questionBlueprintVersionSources,
      undefined,
    );
  });

  it("fails source document head update with typed error when no row is updated", async () => {
    const repository = new KyselySourceRepository(createDbSpy(null));

    await assert.rejects(
      () =>
        repository.setSourceDocumentCurrentRevision({
          currentRevisionId: sourceRevisionId(
            "019e9315-6a87-715f-9861-8654df074305",
          ),
          kind: "workbook",
          ownerUserId,
          sourceDocumentId: testSourceDocumentId,
          updatedAt: at,
        }),
      SourceDocumentHeadUpdateFailedError,
    );
  });

  it("finalizes draft source validation without touching published version snapshots", async () => {
    const db = createDbSpy(
      rowFromDraft(
        createTargetedDraftWithSources({
          document: emptyDocument(),
          sources: uploadedSource("sourceA"),
        }),
      ),
    );
    const repository = new KyselyQuestionBlueprintDraftRepository(db);

    await repository.applyWorkbookValidationResultToDraftSources({
      artifactIds: [testSourceArtifactId],
      draftSourceStatus: "validated",
      ownerUserId,
      updatedAt: at,
      workbookId: testWorkbookId,
    });

    assert.equal(
      db.state.updateValuesByTable.questionBlueprintDraftSources?.status,
      "validated",
    );
    assert.equal(
      db.state.updateValuesByTable.questionBlueprintVersionSources,
      undefined,
    );
  });

  it("rejects publish when draft base version is stale", async () => {
    const draft = createTargetedDraft();
    const blueprint = createTestBlueprint({
      currentVersionId: questionBlueprintVersionId(
        "019e9315-6a87-715f-9861-8654df074100",
      ),
    });
    const db = createDbSpy(rowFromDraft(draft), {
      rowsByTable: {
        questionBlueprintDrafts: rowFromDraft(draft),
        questionBlueprints: rowFromBlueprint(blueprint),
      },
    });
    const repository = new KyselyQuestionBlueprintDraftRepository(db);

    await assert.rejects(
      () =>
        repository.publishQuestionBlueprintDraft({
          blueprintId: blueprint.id,
          draftId: draft.id,
          expectedRevision: 1,
          idempotencyKey: "publish-key",
          ownerUserId,
          sourceMaterialization: [],
          publishedAt: at,
          versionId: questionBlueprintVersionId(
            "019e9315-6a87-715f-9861-8654df074101",
          ),
        }),
      QuestionBlueprintBaseVersionConflictError,
    );
    assert.equal(
      db.state.updateValuesByTable.questionBlueprintDrafts,
      undefined,
    );
    assert.equal(db.state.updateValuesByTable.questionBlueprints, undefined);
  });

  it("rejects publish when draft revision is stale", async () => {
    const draft = createQuestionBlueprintDraft(
      {
        ...draftInput(),
        id: questionBlueprintDraftId("019e9315-6a87-715f-9861-8654df074016"),
      },
      at,
    );
    const current = createQuestionBlueprintDraft(
      {
        ...draftInput(),
        id: draft.id,
      },
      at,
    );
    const currentRow = { ...rowFromDraft(current), revision: 2 };
    const blueprint = createTestBlueprint();
    const db = createDbSpy(currentRow, {
      rowsByTable: {
        questionBlueprintDrafts: currentRow,
        questionBlueprints: rowFromBlueprint(blueprint),
      },
    });
    const repository = new KyselyQuestionBlueprintDraftRepository(db);

    await assert.rejects(
      () =>
        repository.publishQuestionBlueprintDraft({
          blueprintId: blueprint.id,
          draftId: draft.id,
          expectedRevision: 1,
          idempotencyKey: "publish-key",
          ownerUserId,
          sourceMaterialization: [],
          publishedAt: at,
          versionId: questionBlueprintVersionId(
            "019e9315-6a87-715f-9861-8654df074101",
          ),
        }),
      QuestionBlueprintDraftRevisionConflictError,
    );
    assert.equal(
      db.state.updateValuesByTable.questionBlueprintDrafts,
      undefined,
    );
    assert.equal(db.state.updateValuesByTable.questionBlueprints, undefined);
  });

  it("returns the same published version for matching idempotency key", async () => {
    const draft = createTargetedDraft();
    const blueprint = createTestBlueprint();
    const versionId = questionBlueprintVersionId(
      "019e9315-6a87-715f-9861-8654df074101",
    );
    const firstDb = createDbSpy(rowFromDraft(draft), {
      rowsByTable: {
        questionBlueprintDrafts: rowFromDraft(draft),
        questionBlueprints: rowFromBlueprint(blueprint),
        questionBlueprintVersions: rowFromVersion(
          createTestVersion(blueprint, versionId),
        ),
      },
    });
    const firstRepository = new KyselyQuestionBlueprintDraftRepository(firstDb);

    const first = await firstRepository.publishQuestionBlueprintDraft({
      blueprintId: blueprint.id,
      draftId: draft.id,
      expectedRevision: 1,
      idempotencyKey: "publish-key",
      ownerUserId,
      sourceMaterialization: [],
      publishedAt: at,
      versionId,
    });
    assert.equal(first?.questionBlueprintVersion.id, versionId);
    if (!first) throw new Error("publish failed");

    const retryDb = createDbSpy(rowFromDraft(first.draft), {
      rowsByTable: {
        questionBlueprintDrafts: rowFromDraft(first.draft),
        questionBlueprints: rowFromBlueprint(blueprint),
        questionBlueprintVersions: rowFromVersion(
          first.questionBlueprintVersion,
        ),
      },
    });
    const retryRepository = new KyselyQuestionBlueprintDraftRepository(retryDb);

    const retry = await retryRepository.publishQuestionBlueprintDraft({
      blueprintId: blueprint.id,
      draftId: draft.id,
      expectedRevision: 2,
      idempotencyKey: "publish-key",
      ownerUserId,
      sourceMaterialization: [],
      publishedAt: at,
      versionId,
    });
    assert.equal(retry?.questionBlueprintVersion.id, versionId);

    await assert.rejects(
      () =>
        retryRepository.publishQuestionBlueprintDraft({
          blueprintId: blueprint.id,
          draftId: draft.id,
          expectedRevision: 2,
          idempotencyKey: "different-key",
          ownerUserId,
          sourceMaterialization: [],
          publishedAt: at,
          versionId,
        }),
      /cannot be published from current state/,
    );
  });

  it("derives published draft from the locked draft row", async () => {
    const lockedDraft = createTargetedDraft({
      name: questionBlueprintName("Locked Draft"),
    });
    const staleBlueprint = createTestBlueprint({
      name: questionBlueprintName("Stale Blueprint"),
    });
    const db = createDbSpy(rowFromDraft(lockedDraft), {
      rowsByTable: {
        questionBlueprintDrafts: rowFromDraft(lockedDraft),
        questionBlueprints: rowFromBlueprint(staleBlueprint),
        questionBlueprintVersions: rowFromVersion(
          createTestVersion(
            staleBlueprint,
            questionBlueprintVersionId("019e9315-6a87-715f-9861-8654df074101"),
          ),
        ),
      },
    });
    const repository = new KyselyQuestionBlueprintDraftRepository(db);

    const result = await repository.publishQuestionBlueprintDraft({
      blueprintId: staleBlueprint.id,
      draftId: lockedDraft.id,
      expectedRevision: 1,
      idempotencyKey: "publish-key",
      ownerUserId,
      sourceMaterialization: [],
      publishedAt: at,
      versionId: questionBlueprintVersionId(
        "019e9315-6a87-715f-9861-8654df074101",
      ),
    });

    assert.equal(result?.draft.name, "Locked Draft");
    assert.equal(
      db.state.updateValuesByTable.questionBlueprintDrafts?.name,
      "Locked Draft",
    );
  });

  it("rejects prepared materialization for a locked uploaded source", async () => {
    const sourceWorkbookId = workbookId("019e9315-6a87-715f-9861-8654df074201");
    const lockedDraft = createTargetedDraftWithSources({
      document: documentUsing("sourceA"),
      sources: uploadedSource("sourceA"),
    });
    const repository = new KyselyQuestionBlueprintDraftRepository(
      createPublishDbSpy(lockedDraft),
    );

    await assert.rejects(
      () =>
        repository.publishQuestionBlueprintDraft({
          blueprintId: lockedDraft.blueprintId ?? createTestBlueprint().id,
          draftId: lockedDraft.id,
          expectedRevision: 1,
          idempotencyKey: "publish-key",
          ownerUserId,
          sourceMaterialization: [
            publishSourceMaterialization("sourceA", sourceWorkbookId),
          ],
          publishedAt: at,
          versionId: questionBlueprintVersionId(
            "019e9315-6a87-715f-9861-8654df074101",
          ),
        }),
      InvalidQuestionStateTransitionError,
    );
  });

  it("rejects unknown prepared source materialization", async () => {
    const draft = createTargetedDraftWithSources({
      document: documentUsing("sourceA"),
      sources: uploadedSource("sourceA"),
    });
    const repository = new KyselyQuestionBlueprintDraftRepository(
      createPublishDbSpy(draft),
    );

    await assert.rejects(
      () =>
        repository.publishQuestionBlueprintDraft({
          blueprintId: draft.blueprintId ?? createTestBlueprint().id,
          draftId: draft.id,
          expectedRevision: 1,
          idempotencyKey: "publish-key",
          ownerUserId,
          sourceMaterialization: [
            publishSourceMaterialization("missingSource"),
          ],
          publishedAt: at,
          versionId: questionBlueprintVersionId(
            "019e9315-6a87-715f-9861-8654df074101",
          ),
        }),
      InvalidQuestionStateTransitionError,
    );
  });

  it("rejects duplicate prepared source materialization ids", async () => {
    const draft = createTargetedDraftWithSources({
      document: documentUsing("sourceA"),
      sources: uploadedSource("sourceA"),
    });
    const sourceWorkbookId = workbookId("019e9315-6a87-715f-9861-8654df074201");
    const repository = new KyselyQuestionBlueprintDraftRepository(
      createPublishDbSpy(draft),
    );

    await assert.rejects(
      () =>
        repository.publishQuestionBlueprintDraft({
          blueprintId: draft.blueprintId ?? createTestBlueprint().id,
          draftId: draft.id,
          expectedRevision: 1,
          idempotencyKey: "publish-key",
          ownerUserId,
          sourceMaterialization: [
            publishSourceMaterialization("sourceA", sourceWorkbookId),
            publishSourceMaterialization("sourceA", sourceWorkbookId),
          ],
          publishedAt: at,
          versionId: questionBlueprintVersionId(
            "019e9315-6a87-715f-9861-8654df074101",
          ),
        }),
      InvalidQuestionStateTransitionError,
    );
  });

  it("rejects prepared materialization for uploaded source without file", async () => {
    const [source] = uploadedSource("sourceA");
    if (!source) throw new Error("missing source fixture");
    const draft = createTargetedDraftWithSources({
      document: documentUsing("sourceA"),
      sources: [{ ...source, fileId: null }],
    });
    const repository = new KyselyQuestionBlueprintDraftRepository(
      createPublishDbSpy(draft),
    );

    await assert.rejects(
      () =>
        repository.publishQuestionBlueprintDraft({
          blueprintId: draft.blueprintId ?? createTestBlueprint().id,
          draftId: draft.id,
          expectedRevision: 1,
          idempotencyKey: "publish-key",
          ownerUserId,
          sourceMaterialization: [publishSourceMaterialization("sourceA")],
          publishedAt: at,
          versionId: questionBlueprintVersionId(
            "019e9315-6a87-715f-9861-8654df074101",
          ),
        }),
      InvalidQuestionStateTransitionError,
    );
  });

  it("rejects conflicting prepared source materialization", async () => {
    const draft = createTargetedDraftWithSources({
      document: documentUsing("sourceA"),
      sources: validatedSource(
        "sourceA",
        workbookId("019e9315-6a87-715f-9861-8654df074201"),
      ),
    });
    const repository = new KyselyQuestionBlueprintDraftRepository(
      createPublishDbSpy(draft),
    );

    await assert.rejects(
      () =>
        repository.publishQuestionBlueprintDraft({
          blueprintId: draft.blueprintId ?? createTestBlueprint().id,
          draftId: draft.id,
          expectedRevision: 1,
          idempotencyKey: "publish-key",
          ownerUserId,
          sourceMaterialization: [
            publishSourceMaterialization(
              "sourceA",
              workbookId("019e9315-6a87-715f-9861-8654df074202"),
            ),
          ],
          publishedAt: at,
          versionId: questionBlueprintVersionId(
            "019e9315-6a87-715f-9861-8654df074101",
          ),
        }),
      InvalidQuestionStateTransitionError,
    );
  });

  it("rejects prepared materialization for invalid source even when workbook matches", async () => {
    const sourceWorkbookId = workbookId("019e9315-6a87-715f-9861-8654df074201");
    const [source] = validatedSource("sourceA", sourceWorkbookId);
    if (!source) throw new Error("missing source fixture");
    const draft = createTargetedDraftWithSources({
      document: documentUsing("sourceA"),
      sources: [{ ...source, status: "invalid" as const }],
    });
    const repository = new KyselyQuestionBlueprintDraftRepository(
      createPublishDbSpy(draft),
    );

    await assert.rejects(
      () =>
        repository.publishQuestionBlueprintDraft({
          blueprintId: draft.blueprintId ?? createTestBlueprint().id,
          draftId: draft.id,
          expectedRevision: 1,
          idempotencyKey: "publish-key",
          ownerUserId,
          sourceMaterialization: [
            publishSourceMaterialization("sourceA", sourceWorkbookId),
          ],
          publishedAt: at,
          versionId: questionBlueprintVersionId(
            "019e9315-6a87-715f-9861-8654df074101",
          ),
        }),
      InvalidQuestionStateTransitionError,
    );
  });

  it("accepts matching materialization for already validated source", async () => {
    const sourceWorkbookId = workbookId("019e9315-6a87-715f-9861-8654df074201");
    const versionId = questionBlueprintVersionId(
      "019e9315-6a87-715f-9861-8654df074101",
    );
    const draft = createTargetedDraftWithSources({
      document: documentUsing("sourceA"),
      sources: validatedSource("sourceA", sourceWorkbookId),
    });
    const blueprint = createTestBlueprint();
    const publishedSources = [
      {
        byteSize: 1234,
        checksumSha256:
          "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        fileId: "019e9315-6a87-715f-9861-8654df074203",
        name: "Source A",
        originalName: "sourceA.xlsx",
        sourceArtifactId: testSourceArtifactId,
        sourceDocumentId: testSourceDocumentId,
        sourceId: "sourceA",
        sourceRevisionId: testSourceRevisionId,
        type: "workbook" as const,
        workbookId: sourceWorkbookId,
      },
    ];
    const publishedDraft = markQuestionBlueprintDraftPublished(
      draft,
      {
        blueprintId: blueprint.id,
        idempotencyKey: "publish-key",
        sources: draft.sources,
        versionId,
      },
      at,
    );
    const publishedBlueprint = createTestBlueprint({
      currentVersionId: versionId,
      document: draft.document,
      sources: publishedSources,
    });
    const publishedVersion = createQuestionBlueprintVersion(
      {
        blueprintId: blueprint.id,
        createdByUserId: blueprint.createdByUserId,
        description: draft.description,
        document: draft.document,
        id: versionId,
        name: draft.name,
        ownerUserId: draft.ownerUserId,
        parentVersionId: blueprint.currentVersionId,
        sources: publishedSources,
        versionNumber: questionBlueprintVersionNumber(2),
      },
      at,
    );
    const repository = new KyselyQuestionBlueprintDraftRepository(
      createDbSpy(rowFromDraft(draft), {
        rowsAfterUpdateByTable: {
          questionBlueprintDrafts: rowFromDraft(publishedDraft),
          questionBlueprints: rowFromBlueprint(publishedBlueprint),
        },
        rowsByTable: {
          questionBlueprintDrafts: rowFromDraft(draft),
          questionBlueprints: rowFromBlueprint(blueprint),
          sourceArtifacts: [sourceArtifactRow(sourceWorkbookId)],
          questionBlueprintVersionSources: versionSourceRows(
            versionId,
            publishedSources,
          ),
          questionBlueprintVersions: rowFromVersion(publishedVersion),
        },
      }),
    );

    const result = await repository.publishQuestionBlueprintDraft({
      blueprintId: blueprint.id,
      draftId: draft.id,
      expectedRevision: 1,
      idempotencyKey: "publish-key",
      ownerUserId,
      sourceMaterialization: [
        publishSourceMaterialization("sourceA", sourceWorkbookId),
      ],
      publishedAt: at,
      versionId,
    });

    assert.equal(result?.draft.sources[0]?.status, "validated");
    assert.equal(result?.draft.sources[0]?.workbookId, sourceWorkbookId);
    assert.equal(
      result?.questionBlueprintVersion.sources[0]?.workbookId,
      sourceWorkbookId,
    );
  });

  it("rejects publish when pinned artifact owner does not match", async () => {
    const sourceWorkbookId = workbookId("019e9315-6a87-715f-9861-8654df074201");
    const draft = createTargetedDraftWithSources({
      document: documentUsing("sourceA"),
      sources: validatedSource("sourceA", sourceWorkbookId),
    });
    const repository = new KyselyQuestionBlueprintDraftRepository(
      createDbSpy(rowFromDraft(draft), {
        rowsByTable: {
          questionBlueprintDrafts: rowFromDraft(draft),
          questionBlueprints: rowFromBlueprint(createTestBlueprint()),
          sourceArtifacts: [
            sourceArtifactRow(sourceWorkbookId, {
              artifactOwnerUserId: userId(
                "019e9315-6a87-715f-9861-8654df074099",
              ),
            }),
          ],
        },
      }),
    );

    await assert.rejects(
      () =>
        repository.publishQuestionBlueprintDraft({
          blueprintId: draft.blueprintId ?? createTestBlueprint().id,
          draftId: draft.id,
          expectedRevision: 1,
          idempotencyKey: "publish-key",
          ownerUserId,
          publishedAt: at,
          sourceMaterialization: [
            publishSourceMaterialization("sourceA", sourceWorkbookId),
          ],
          versionId: questionBlueprintVersionId(
            "019e9315-6a87-715f-9861-8654df074101",
          ),
        }),
      InvalidQuestionStateTransitionError,
    );
  });

  it("rejects publish when pinned artifact status is not valid", async () => {
    const sourceWorkbookId = workbookId("019e9315-6a87-715f-9861-8654df074201");
    const draft = createTargetedDraftWithSources({
      document: documentUsing("sourceA"),
      sources: validatedSource("sourceA", sourceWorkbookId),
    });
    const repository = new KyselyQuestionBlueprintDraftRepository(
      createDbSpy(rowFromDraft(draft), {
        rowsByTable: {
          questionBlueprintDrafts: rowFromDraft(draft),
          questionBlueprints: rowFromBlueprint(createTestBlueprint()),
          sourceArtifacts: [
            sourceArtifactRow(sourceWorkbookId, { artifactStatus: "invalid" }),
          ],
        },
      }),
    );

    await assert.rejects(
      () =>
        repository.publishQuestionBlueprintDraft({
          blueprintId: draft.blueprintId ?? createTestBlueprint().id,
          draftId: draft.id,
          expectedRevision: 1,
          idempotencyKey: "publish-key",
          ownerUserId,
          publishedAt: at,
          sourceMaterialization: [
            publishSourceMaterialization("sourceA", sourceWorkbookId),
          ],
          versionId: questionBlueprintVersionId(
            "019e9315-6a87-715f-9861-8654df074101",
          ),
        }),
      InvalidQuestionStateTransitionError,
    );
  });

  it("rejects publish when pinned artifact revision does not match", async () => {
    const sourceWorkbookId = workbookId("019e9315-6a87-715f-9861-8654df074201");
    const draft = createTargetedDraftWithSources({
      document: documentUsing("sourceA"),
      sources: validatedSource("sourceA", sourceWorkbookId),
    });
    const repository = new KyselyQuestionBlueprintDraftRepository(
      createDbSpy(rowFromDraft(draft), {
        rowsByTable: {
          questionBlueprintDrafts: rowFromDraft(draft),
          questionBlueprints: rowFromBlueprint(createTestBlueprint()),
          sourceArtifacts: [
            sourceArtifactRow(sourceWorkbookId, {
              sourceRevisionId: sourceRevisionId(
                "019e9315-6a87-715f-9861-8654df074305",
              ),
            }),
          ],
        },
      }),
    );

    await assert.rejects(
      () =>
        repository.publishQuestionBlueprintDraft({
          blueprintId: draft.blueprintId ?? createTestBlueprint().id,
          draftId: draft.id,
          expectedRevision: 1,
          idempotencyKey: "publish-key",
          ownerUserId,
          publishedAt: at,
          sourceMaterialization: [
            publishSourceMaterialization("sourceA", sourceWorkbookId),
          ],
          versionId: questionBlueprintVersionId(
            "019e9315-6a87-715f-9861-8654df074101",
          ),
        }),
      InvalidQuestionStateTransitionError,
    );
  });

  it("rejects publish when pinned artifact workbook does not match", async () => {
    const sourceWorkbookId = workbookId("019e9315-6a87-715f-9861-8654df074201");
    const draft = createTargetedDraftWithSources({
      document: documentUsing("sourceA"),
      sources: validatedSource("sourceA", sourceWorkbookId),
    });
    const repository = new KyselyQuestionBlueprintDraftRepository(
      createDbSpy(rowFromDraft(draft), {
        rowsByTable: {
          questionBlueprintDrafts: rowFromDraft(draft),
          questionBlueprints: rowFromBlueprint(createTestBlueprint()),
          sourceArtifacts: [
            sourceArtifactRow(
              workbookId("019e9315-6a87-715f-9861-8654df074202"),
            ),
          ],
        },
      }),
    );

    await assert.rejects(
      () =>
        repository.publishQuestionBlueprintDraft({
          blueprintId: draft.blueprintId ?? createTestBlueprint().id,
          draftId: draft.id,
          expectedRevision: 1,
          idempotencyKey: "publish-key",
          ownerUserId,
          publishedAt: at,
          sourceMaterialization: [
            publishSourceMaterialization("sourceA", sourceWorkbookId),
          ],
          versionId: questionBlueprintVersionId(
            "019e9315-6a87-715f-9861-8654df074101",
          ),
        }),
      InvalidQuestionStateTransitionError,
    );
  });

  it("rejects prepared materialization for unused source", async () => {
    const draft = createTargetedDraftWithSources({
      document: documentUsing("sourceA"),
      sources: [
        ...uploadedSource("sourceA"),
        ...uploadedSource("sourceB", "Source B"),
      ],
    });
    const repository = new KyselyQuestionBlueprintDraftRepository(
      createPublishDbSpy(draft),
    );

    await assert.rejects(
      () =>
        repository.publishQuestionBlueprintDraft({
          blueprintId: draft.blueprintId ?? createTestBlueprint().id,
          draftId: draft.id,
          expectedRevision: 1,
          idempotencyKey: "publish-key",
          ownerUserId,
          sourceMaterialization: [publishSourceMaterialization("sourceB")],
          publishedAt: at,
          versionId: questionBlueprintVersionId(
            "019e9315-6a87-715f-9861-8654df074101",
          ),
        }),
      InvalidQuestionStateTransitionError,
    );
  });

  it("rejects used source that is not validated after materialization", async () => {
    const [source] = validatedSource(
      "sourceA",
      workbookId("019e9315-6a87-715f-9861-8654df074201"),
    );
    if (!source) throw new Error("missing source fixture");
    const draft = createTargetedDraftWithSources({
      document: documentUsing("sourceA"),
      sources: [{ ...source, status: "invalid" as const }],
    });
    const repository = new KyselyQuestionBlueprintDraftRepository(
      createPublishDbSpy(draft),
    );

    await assert.rejects(
      () =>
        repository.publishQuestionBlueprintDraft({
          blueprintId: draft.blueprintId ?? createTestBlueprint().id,
          draftId: draft.id,
          expectedRevision: 1,
          idempotencyKey: "publish-key",
          ownerUserId,
          sourceMaterialization: [],
          publishedAt: at,
          versionId: questionBlueprintVersionId(
            "019e9315-6a87-715f-9861-8654df074101",
          ),
        }),
      InvalidQuestionStateTransitionError,
    );
  });
});

function createDbSpy(
  row: unknown,
  options: {
    rowsAfterUpdateByTable?: Record<string, unknown>;
    rowsByTable?: Record<string, unknown>;
  } = {},
) {
  type Values = Record<string, unknown> & {
    document?: { toOperationNode: unknown };
    sources?: { toOperationNode: unknown };
  };

  const state: {
    insertValuesByTable: Record<string, Values | undefined>;
    lockedForUpdate: Record<string, boolean | undefined>;
    updateExecutionsByTable: Record<string, number | undefined>;
    updateValuesByTable: Record<string, Values | undefined>;
    whereCallsByTable: Record<
      string,
      { column: string; operator: string; value: unknown }[] | undefined
    >;
  } = {
    insertValuesByTable: {},
    lockedForUpdate: {},
    updateExecutionsByTable: {},
    updateValuesByTable: {},
    whereCallsByTable: {},
  };

  function rowForTable(table: string) {
    if (
      state.updateValuesByTable[table] &&
      options.rowsAfterUpdateByTable?.[table]
    ) {
      return options.rowsAfterUpdateByTable[table];
    }
    if (table === "questionBlueprintVersions") {
      return (
        options.rowsByTable?.[table] ??
        state.insertValuesByTable.questionBlueprintVersions
      );
    }
    return options.rowsByTable?.[table] ?? row;
  }

  function rowsForTable(table: string): unknown[] {
    const configured = options.rowsByTable?.[table];
    if (Array.isArray(configured)) return configured;
    const selected = rowForTable(table);
    if (table === "questionBlueprintDraftSources") {
      const rows = sourcesFromSelectedDraft(selected);
      const updated = state.updateValuesByTable.questionBlueprintDraftSources;
      if (!updated) return rows;
      return rows.map((row) =>
        row.sourceId === updated.sourceId ||
        row.sourceId ===
          state.whereCallsByTable.questionBlueprintDraftSources?.find(
            (call) => call.column === "sourceId",
          )?.value
          ? { ...row, ...updated }
          : row,
      );
    }
    if (table === "questionBlueprintVersionSources") {
      return sourcesFromSelectedVersion(selected);
    }
    return selected ? [selected] : [];
  }

  function rowAfterUpdate(table: string) {
    const rowAfterUpdate = options.rowsAfterUpdateByTable?.[table];
    if (rowAfterUpdate) return rowAfterUpdate;
    const selected = rowForTable(table);
    if (!selected || typeof selected !== "object") return selected;
    const values = state.updateValuesByTable[table] ?? {};
    return {
      ...selected,
      ...values,
      document: (selected as { document?: unknown }).document,
      sources: (selected as { sources?: unknown }).sources,
    };
  }

  const db = {
    state,
    insertInto(table: string) {
      const insertQuery = {
        execute() {
          return Promise.resolve();
        },
        onConflict() {
          return insertQuery;
        },
        returning() {
          return insertQuery;
        },
        returningAll() {
          return insertQuery;
        },
        async executeTakeFirstOrThrow() {
          if (table === "questionBlueprintVersions") {
            return {
              id: state.insertValuesByTable.questionBlueprintVersions?.id,
            };
          }
          return rowForTable(table);
        },
        values(values: Record<string, unknown> | Record<string, unknown>[]) {
          state.insertValuesByTable[table] = values as Values;
          return insertQuery;
        },
      };
      return insertQuery;
    },
    deleteFrom(table: string) {
      const deleteQuery = {
        execute() {
          return Promise.resolve();
        },
        where(column: string, operator: string, value: unknown) {
          state.whereCallsByTable[table] = [
            ...(state.whereCallsByTable[table] ?? []),
            { column, operator, value },
          ];
          return deleteQuery;
        },
      };
      return deleteQuery;
    },
    selectFrom(table: string) {
      let selectsMaxVersionNumber = false;
      const selectQuery = {
        execute() {
          return Promise.resolve(rowsForTable(table));
        },
        executeTakeFirst() {
          if (table === "questionBlueprintVersions") {
            if (selectsMaxVersionNumber) {
              return Promise.resolve({ maxVersionNumber: 1 });
            }
            return Promise.resolve(rowForTable(table));
          }
          return Promise.resolve(rowForTable(table));
        },
        executeTakeFirstOrThrow() {
          const selected = rowForTable(table);
          if (!selected) {
            throw new Error(`missing row for ${table}`);
          }
          return Promise.resolve(selected);
        },
        forUpdate() {
          state.lockedForUpdate[table] = true;
          return selectQuery;
        },
        innerJoin() {
          return selectQuery;
        },
        select(selection?: unknown) {
          if (selection === undefined) {
            selectsMaxVersionNumber = true;
          }
          return selectQuery;
        },
        selectAll() {
          return selectQuery;
        },
        orderBy() {
          return selectQuery;
        },
        where(column: string, operator: string, value: unknown) {
          state.whereCallsByTable[table] = [
            ...(state.whereCallsByTable[table] ?? []),
            { column, operator, value },
          ];
          return selectQuery;
        },
        whereRef() {
          return selectQuery;
        },
      };
      return selectQuery;
    },
    transaction() {
      return {
        execute<T>(fn: (tx: DatabaseExecutor) => Promise<T>) {
          return fn(db as unknown as DatabaseExecutor);
        },
      };
    },
    updateTable(table: string) {
      function countUpdate() {
        state.updateExecutionsByTable[table] =
          (state.updateExecutionsByTable[table] ?? 0) + 1;
      }
      const updateQuery = {
        async execute() {
          countUpdate();
          return [];
        },
        async executeTakeFirst() {
          countUpdate();
          return rowAfterUpdate(table);
        },
        async executeTakeFirstOrThrow() {
          countUpdate();
          return rowAfterUpdate(table);
        },
        returningAll() {
          return updateQuery;
        },
        returning() {
          return updateQuery;
        },
        set(values: Record<string, unknown>) {
          state.updateValuesByTable[table] = values as Values;
          return updateQuery;
        },
        where(column: string, operator: string, value: unknown) {
          state.whereCallsByTable[table] = [
            ...(state.whereCallsByTable[table] ?? []),
            { column, operator, value },
          ];
          return updateQuery;
        },
        whereExists() {
          return updateQuery;
        },
      };
      return updateQuery;
    },
  } as unknown as DatabaseExecutor & {
    state: typeof state;
  };

  return db;
}

function emptyDocument() {
  return questionBlueprintDocument({
    blocks: [],
    references: [],
    responseFields: [],
    schemaVersion: 1,
  });
}

function draftInput(patch: DraftInputPatch = {}) {
  return {
    baseVersionId: questionBlueprintVersionId(
      "019e9315-6a87-715f-9861-8654df074099",
    ),
    blueprintId: questionBlueprintId("019e9315-6a87-715f-9861-8654df074012"),
    createdByUserId: creatorUserId,
    description: questionBlueprintDescription(null),
    document: emptyDocument(),
    id: questionBlueprintDraftId("019e9315-6a87-715f-9861-8654df074015"),
    name: questionBlueprintName("Draft"),
    ownerUserId,
    sources: [],
    ...patch,
  };
}

function createTargetedDraft(patch: DraftInputPatch = {}) {
  return createQuestionBlueprintDraft(draftInput(patch), at);
}

function createTargetedDraftWithSources(
  patch: Pick<DraftInputPatch, "document" | "sources">,
) {
  return createTargetedDraft(patch);
}

function createPublishDbSpy(draft: QuestionBlueprintDraft) {
  const blueprint = createTestBlueprint();
  return createDbSpy(rowFromDraft(draft), {
    rowsByTable: {
      questionBlueprintDrafts: rowFromDraft(draft),
      questionBlueprints: rowFromBlueprint(blueprint),
    },
  });
}

function localSource(sourceId: string, name = "Source A") {
  return questionBlueprintDraftSourcesFromRows([
    {
      byteSize: null,
      checksumSha256: null,
      fileId: null,
      name,
      originalName: null,
      sourceId,
      status: "local",
      type: "workbook",
      workbookId: null,
    },
  ]);
}

function uploadedSource(sourceId: string, name = "Source A") {
  return questionBlueprintDraftSourcesFromRows([
    {
      byteSize: 1234,
      checksumSha256:
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      fileId: "019e9315-6a87-715f-9861-8654df074203",
      name,
      originalName: `${sourceId}.xlsx`,
      sourceArtifactId: testSourceArtifactId,
      sourceDocumentId: testSourceDocumentId,
      sourceId,
      sourceRevisionId: testSourceRevisionId,
      status: "uploaded",
      type: "workbook",
      workbookId: testWorkbookId,
    },
  ]);
}

function validatedSource(sourceId: string, sourceWorkbookId: WorkbookId) {
  return questionBlueprintDraftSourcesFromRows([
    {
      byteSize: 1234,
      checksumSha256:
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      fileId: "019e9315-6a87-715f-9861-8654df074203",
      name: "Source A",
      originalName: `${sourceId}.xlsx`,
      sourceArtifactId: testSourceArtifactId,
      sourceDocumentId: testSourceDocumentId,
      sourceId,
      sourceRevisionId: testSourceRevisionId,
      status: "validated",
      type: "workbook",
      workbookId: sourceWorkbookId,
    },
  ]);
}

function documentUsing(sourceId: string) {
  const referenceId = `workbook:${sourceId}:cell:Sheet1:A1`;
  return questionBlueprintDocument({
    blocks: [],
    references: [
      {
        id: referenceId,
        label: "Reference",
        required: true,
        source: {
          ref: "Sheet1!A1",
          schemaVersion: 1,
          sourceId,
          type: "workbook_cell",
        },
        value: { referenceId, schemaVersion: 1, type: "reference" },
      },
    ],
    responseFields: [],
    schemaVersion: 1,
  });
}

function createTestBlueprint(patch: BlueprintInputPatch = {}) {
  return createQuestionBlueprint(
    {
      createdByUserId: creatorUserId,
      currentVersionId: questionBlueprintVersionId(
        "019e9315-6a87-715f-9861-8654df074099",
      ),
      description: questionBlueprintDescription(null),
      document: emptyDocument(),
      id: questionBlueprintId("019e9315-6a87-715f-9861-8654df074012"),
      name: questionBlueprintName("Revenue"),
      ownerUserId,
      sources: [],
      visibility: questionBlueprintVisibility("private"),
      ...patch,
    },
    at,
  );
}

function createTestVersion(
  blueprint: QuestionBlueprint,
  id: QuestionBlueprintVersion["id"],
) {
  return createQuestionBlueprintVersion(
    {
      blueprintId: blueprint.id,
      createdByUserId: blueprint.createdByUserId,
      description: blueprint.description,
      document: blueprint.document,
      id,
      name: blueprint.name,
      ownerUserId: blueprint.ownerUserId,
      parentVersionId: blueprint.currentVersionId,
      sources: blueprint.sources,
      versionNumber: questionBlueprintVersionNumber(2),
    },
    blueprint.updatedAt,
  );
}

function rowFromBlueprint(blueprint: QuestionBlueprint) {
  return {
    archivedAt: blueprint.archivedAt,
    createdAt: blueprint.createdAt,
    createdByUserId: blueprint.createdByUserId,
    currentVersionId: blueprint.currentVersionId,
    description: blueprint.description,
    document: blueprint.document,
    id: blueprint.id,
    name: blueprint.name,
    ownerUserId: blueprint.ownerUserId,
    sources: blueprint.sources,
    status: blueprint.status,
    updatedAt: blueprint.updatedAt,
    visibility: blueprint.visibility,
  };
}

function rowFromDraft(draft: QuestionBlueprintDraft) {
  return {
    baseVersionId: draft.baseVersionId,
    blueprintId: draft.blueprintId,
    createdAt: draft.createdAt,
    createdByUserId: draft.createdByUserId,
    description: draft.description,
    discardedAt: draft.discardedAt,
    document: draft.document,
    id: draft.id,
    lastSavedAt: draft.lastSavedAt,
    name: draft.name,
    ownerUserId: draft.ownerUserId,
    publishedAt: draft.publishedAt,
    publishedVersionId: draft.publishedVersionId,
    publishIdempotencyKey: draft.publishIdempotencyKey,
    revision: draft.revision,
    sources: draft.sources,
    status: draft.status,
    updatedAt: draft.updatedAt,
  };
}

function rowFromVersion(version: QuestionBlueprintVersion) {
  return {
    blueprintId: version.blueprintId,
    createdAt: version.createdAt,
    createdByUserId: version.createdByUserId,
    description: version.description,
    document: version.document,
    id: version.id,
    name: version.name,
    ownerUserId: version.ownerUserId,
    parentVersionId: version.parentVersionId,
    publishedAt: version.publishedAt,
    sources: version.sources,
    versionNumber: version.versionNumber,
  };
}

function publishSourceMaterialization(
  sourceId: string,
  sourceWorkbookId: WorkbookId = testWorkbookId,
) {
  return {
    sourceArtifactId: testSourceArtifactId,
    sourceDocumentId: testSourceDocumentId,
    sourceId,
    sourceRevisionId: testSourceRevisionId,
    workbookId: sourceWorkbookId,
  };
}

function sourceArtifactRow(
  sourceWorkbookId: WorkbookId = testWorkbookId,
  patch: Partial<{
    artifactOwnerUserId: typeof ownerUserId;
    sourceDocumentId: typeof testSourceDocumentId;
    sourceRevisionId: typeof testSourceRevisionId;
    artifactStatus: string;
    workbookId: WorkbookId;
    workbookOwnerUserId: typeof ownerUserId;
    workbookStatus: string;
    sourceDocumentOwnerUserId: typeof ownerUserId;
  }> = {},
) {
  return {
    artifactOwnerUserId: ownerUserId,
    id: testSourceArtifactId,
    sourceDocumentId: testSourceDocumentId,
    sourceDocumentOwnerUserId: ownerUserId,
    sourceRevisionId: testSourceRevisionId,
    artifactStatus: "valid",
    workbookId: sourceWorkbookId,
    workbookOwnerUserId: ownerUserId,
    workbookStatus: "valid",
    ...patch,
  };
}

function sourcesFromSelectedDraft(selected: unknown) {
  if (!selected || typeof selected !== "object") return [];
  const draft = selected as {
    id?: string;
    sources?: QuestionBlueprintDraft["sources"];
  };
  return (draft.sources ?? []).map((source) => ({
    byteSize: source.byteSize === null ? null : String(source.byteSize),
    checksumSha256: source.checksumSha256,
    createdAt: at,
    draftId: draft.id,
    fileId: source.fileId,
    name: source.name,
    originalName: source.originalName,
    sourceArtifactId: source.sourceArtifactId,
    sourceDocumentId: source.sourceDocumentId,
    sourceId: source.sourceId,
    sourceRevisionId: source.sourceRevisionId,
    status: source.status,
    type: source.type,
    updatedAt: at,
    workbookId: source.workbookId,
  }));
}

function sourcesFromSelectedVersion(selected: unknown) {
  if (!selected || typeof selected !== "object") return [];
  const version = selected as {
    id?: string;
    sources?: QuestionBlueprintVersion["sources"];
  };
  return (version.sources ?? []).map((source) => ({
    blueprintVersionId: version.id,
    byteSize: source.byteSize === null ? null : String(source.byteSize),
    checksumSha256: source.checksumSha256,
    createdAt: at,
    fileId: source.fileId,
    name: source.name,
    originalName: source.originalName,
    sourceArtifactId: source.sourceArtifactId,
    sourceDocumentId: source.sourceDocumentId,
    sourceId: source.sourceId,
    sourceRevisionId: source.sourceRevisionId,
    type: source.type,
    workbookId: source.workbookId,
  }));
}

function versionSourceRows(
  versionId: QuestionBlueprintVersion["id"],
  sources: QuestionBlueprintVersion["sources"],
) {
  return sources.map((source) => ({
    blueprintVersionId: versionId,
    byteSize: source.byteSize === null ? null : String(source.byteSize),
    checksumSha256: source.checksumSha256,
    createdAt: at,
    fileId: source.fileId,
    name: source.name,
    originalName: source.originalName,
    sourceArtifactId: source.sourceArtifactId,
    sourceDocumentId: source.sourceDocumentId,
    sourceId: source.sourceId,
    sourceRevisionId: source.sourceRevisionId,
    type: source.type,
    workbookId: source.workbookId,
  }));
}
