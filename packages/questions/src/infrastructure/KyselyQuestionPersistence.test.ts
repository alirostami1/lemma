import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DatabaseExecutor } from "@lemma/db";
import {
  QuestionBlueprintBaseVersionConflictError,
  QuestionBlueprintDraftRevisionConflictError,
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
  questionBlueprintDraftSources,
  questionBlueprintId,
  questionBlueprintName,
  questionBlueprintVersionId,
  questionBlueprintVersionNumber,
  questionBlueprintVisibility,
  userId,
  type WorkbookId,
  workbookId,
} from "../domain/index.js";
import { KyselyQuestionBlueprintDraftRepository } from "./KyselyQuestionBlueprintDraftRepository.js";
import { KyselyQuestionBlueprintRepository } from "./KyselyQuestionBlueprintRepository.js";

const at = new Date("2026-06-18T00:00:00.000Z");
const ownerUserId = userId("019e9315-6a87-715f-9861-8654df074010");
const creatorUserId = userId("019e9315-6a87-715f-9861-8654df074011");

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
  it("persists an empty blueprint sources array as jsonb", async () => {
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

    const created = await repository.createQuestionBlueprint(blueprint);

    assert.equal(created.sources.length, 0);
    assert.equal(
      created.currentVersionId,
      "019e9315-6a87-715f-9861-8654df074099",
    );
    const blueprintInsert = db.state.insertValuesByTable.questionBlueprints;
    const versionInsert =
      db.state.insertValuesByTable.questionBlueprintVersions;
    assert.equal(
      blueprintInsert?.currentVersionId,
      "019e9315-6a87-715f-9861-8654df074099",
    );
    assert.equal(versionInsert?.id, "019e9315-6a87-715f-9861-8654df074099");
    assert.equal(versionInsert?.blueprintId, blueprint.id);
    assert.equal(versionInsert?.versionNumber, 1);
    assert.equal(versionInsert?.parentVersionId, null);
    assert.equal(db.state.updateValuesByTable.questionBlueprints, undefined);
    const insertSources = blueprintInsert?.sources;
    const versionDocument = versionInsert?.document;
    const versionSources = versionInsert?.sources;
    if (!insertSources) throw new Error("missing inserted sources expression");
    if (!versionDocument)
      throw new Error("missing version document expression");
    if (!versionSources) throw new Error("missing version sources expression");
    assert.equal(typeof insertSources.toOperationNode, "function");
    assert.equal(typeof versionDocument.toOperationNode, "function");
    assert.equal(typeof versionSources.toOperationNode, "function");
  });

  it("updates blueprint cache without appending a version", async () => {
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

    const updated = await repository.updateQuestionBlueprint(blueprint);

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

  it("appends a version when updating blueprint definition", async () => {
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
    const nextVersionId = questionBlueprintVersionId(
      "019e9315-6a87-715f-9861-8654df074100",
    );
    const db = createDbSpy(rowFromBlueprint(blueprint));
    const repository = new KyselyQuestionBlueprintRepository(db);

    await repository.updateQuestionBlueprintDefinition({
      blueprint,
      versionId: nextVersionId,
    });

    const versionInsert =
      db.state.insertValuesByTable.questionBlueprintVersions;
    assert.equal(db.state.lockedForUpdate.questionBlueprints, true);
    assert.equal(versionInsert?.id, nextVersionId);
    assert.equal(versionInsert?.blueprintId, blueprint.id);
    assert.equal(versionInsert?.versionNumber, 2);
    assert.equal(versionInsert?.parentVersionId, blueprint.currentVersionId);
    assert.equal(
      db.state.updateValuesByTable.questionBlueprints?.currentVersionId,
      nextVersionId,
    );
  });

  it("persists empty draft sources as jsonb on create and update", async () => {
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
    const insertSources =
      db.state.insertValuesByTable.questionBlueprintDrafts?.sources;
    const updateSources =
      db.state.updateValuesByTable.questionBlueprintDrafts?.sources;
    if (!insertSources) throw new Error("missing inserted sources expression");
    if (!updateSources) throw new Error("missing updated sources expression");
    assert.equal(typeof insertSources.toOperationNode, "function");
    assert.equal(typeof updateSources.toOperationNode, "function");
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

  it("applies prepared materialization to a locked uploaded source", async () => {
    const sourceWorkbookId = workbookId("019e9315-6a87-715f-9861-8654df074201");
    const versionId = questionBlueprintVersionId(
      "019e9315-6a87-715f-9861-8654df074101",
    );
    const lockedDraft = createTargetedDraftWithSources({
      document: documentUsing("sourceA"),
      sources: uploadedSource("sourceA"),
    });
    const blueprint = createTestBlueprint();
    const publishedSources = [
      {
        name: "Source A",
        sourceId: "sourceA",
        type: "workbook" as const,
        workbookId: sourceWorkbookId,
      },
    ];
    const publishedDraftSources = lockedDraft.sources.map((source) => ({
      ...source,
      status: "validated" as const,
      workbookId: sourceWorkbookId,
    }));
    const publishedDraft = markQuestionBlueprintDraftPublished(
      lockedDraft,
      {
        blueprintId: blueprint.id,
        idempotencyKey: "publish-key",
        sources: publishedDraftSources,
        versionId,
      },
      at,
    );
    const publishedBlueprint = createTestBlueprint({
      currentVersionId: versionId,
      document: lockedDraft.document,
      sources: publishedSources,
    });
    const publishedVersion = createQuestionBlueprintVersion(
      {
        blueprintId: blueprint.id,
        createdByUserId: blueprint.createdByUserId,
        description: lockedDraft.description,
        document: lockedDraft.document,
        id: versionId,
        name: lockedDraft.name,
        ownerUserId: lockedDraft.ownerUserId,
        parentVersionId: blueprint.currentVersionId,
        sources: publishedSources,
        versionNumber: questionBlueprintVersionNumber(2),
      },
      at,
    );
    const db = createDbSpy(rowFromDraft(lockedDraft), {
      rowsAfterUpdateByTable: {
        questionBlueprintDrafts: rowFromDraft(publishedDraft),
        questionBlueprints: rowFromBlueprint(publishedBlueprint),
      },
      rowsByTable: {
        questionBlueprintDrafts: rowFromDraft(lockedDraft),
        questionBlueprints: rowFromBlueprint(blueprint),
        questionBlueprintVersions: rowFromVersion(publishedVersion),
      },
    });
    const repository = new KyselyQuestionBlueprintDraftRepository(db);

    const result = await repository.publishQuestionBlueprintDraft({
      blueprintId: blueprint.id,
      draftId: lockedDraft.id,
      expectedRevision: 1,
      idempotencyKey: "publish-key",
      ownerUserId,
      sourceMaterialization: [
        { sourceId: "sourceA", workbookId: sourceWorkbookId },
      ],
      publishedAt: at,
      versionId,
    });

    assert.equal(result?.draft.sources[0]?.status, "validated");
    assert.equal(result?.draft.sources[0]?.workbookId, sourceWorkbookId);
    assert.equal(
      result?.questionBlueprint.sources[0]?.workbookId,
      sourceWorkbookId,
    );
    assert.equal(
      result?.questionBlueprintVersion.sources[0]?.workbookId,
      sourceWorkbookId,
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
            {
              sourceId: "missingSource",
              workbookId: workbookId("019e9315-6a87-715f-9861-8654df074201"),
            },
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
            { sourceId: "sourceA", workbookId: sourceWorkbookId },
            { sourceId: "sourceA", workbookId: sourceWorkbookId },
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
          sourceMaterialization: [
            {
              sourceId: "sourceA",
              workbookId: workbookId("019e9315-6a87-715f-9861-8654df074201"),
            },
          ],
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
            {
              sourceId: "sourceA",
              workbookId: workbookId("019e9315-6a87-715f-9861-8654df074202"),
            },
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
            { sourceId: "sourceA", workbookId: sourceWorkbookId },
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
        name: "Source A",
        sourceId: "sourceA",
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
        { sourceId: "sourceA", workbookId: sourceWorkbookId },
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
          sourceMaterialization: [
            {
              sourceId: "sourceB",
              workbookId: workbookId("019e9315-6a87-715f-9861-8654df074201"),
            },
          ],
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
    updateValuesByTable: Record<string, Values | undefined>;
    whereCallsByTable: Record<
      string,
      { column: string; operator: string; value: unknown }[] | undefined
    >;
  } = {
    insertValuesByTable: {},
    lockedForUpdate: {},
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
        values(values: Record<string, unknown>) {
          state.insertValuesByTable[table] = values as Values;
          return insertQuery;
        },
      };
      return insertQuery;
    },
    selectFrom(table: string) {
      let selectsMaxVersionNumber = false;
      const selectQuery = {
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
        select() {
          selectsMaxVersionNumber = true;
          return selectQuery;
        },
        selectAll() {
          return selectQuery;
        },
        where(column: string, operator: string, value: unknown) {
          state.whereCallsByTable[table] = [
            ...(state.whereCallsByTable[table] ?? []),
            { column, operator, value },
          ];
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
      const updateQuery = {
        async executeTakeFirst() {
          return rowAfterUpdate(table);
        },
        async executeTakeFirstOrThrow() {
          return rowAfterUpdate(table);
        },
        returningAll() {
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

function uploadedSource(sourceId: string, name = "Source A") {
  return questionBlueprintDraftSources([
    {
      byteSize: 1234,
      checksumSha256:
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      fileId: "019e9315-6a87-715f-9861-8654df074203",
      name,
      originalName: `${sourceId}.xlsx`,
      sourceId,
      status: "uploaded",
      type: "workbook",
      workbookId: null,
    },
  ]);
}

function validatedSource(sourceId: string, sourceWorkbookId: WorkbookId) {
  return questionBlueprintDraftSources([
    {
      byteSize: 1234,
      checksumSha256:
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      fileId: "019e9315-6a87-715f-9861-8654df074203",
      name: "Source A",
      originalName: `${sourceId}.xlsx`,
      sourceId,
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
