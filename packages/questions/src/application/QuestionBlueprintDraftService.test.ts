import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rootOperationLineage } from "@lemma/domain";
import type { CurrentUser } from "@lemma/identity/application";
import {
  createQuestionBlueprintDraft as createDraft,
  createQuestionBlueprint,
  createQuestionBlueprintVersion,
  markQuestionBlueprintDraftPublished,
  type QuestionBlueprint,
  type QuestionBlueprintDraft,
  type QuestionBlueprintDraftStatus,
  questionBlueprintDescription,
  questionBlueprintDocument,
  questionBlueprintDraftId,
  questionBlueprintDraftPublishIdempotencyKey,
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
  workbookId,
} from "../domain/index.js";
import { QuestionBlueprintDraftRevisionConflictError } from "./errors.js";
import type {
  DraftSourceFileMetadata,
  DraftSourceFilePort,
  DraftSourceWorkbookMaterialization,
  DraftSourceWorkbookRegistrationPort,
  IdGenerator,
  QuestionBlueprintDraftTransactionPort,
  QuestionsRepository,
} from "./ports.js";
import { QuestionBlueprintDraftService } from "./QuestionBlueprintDraftService.js";

const at = new Date("2026-06-24T00:00:00.000Z");
const ownerUserId = userId("019e9315-6a87-715f-9861-8654df099001");
const blueprintId = questionBlueprintId("019e9315-6a87-715f-9861-8654df099002");
const versionId = questionBlueprintVersionId(
  "019e9315-6a87-715f-9861-8654df099003",
);
const nextVersionId = questionBlueprintVersionId(
  "019e9315-6a87-715f-9861-8654df099008",
);
const draftId = questionBlueprintDraftId(
  "019e9315-6a87-715f-9861-8654df099004",
);
const testSourceDocumentId = sourceDocumentId(
  "019e9315-6a87-715f-9861-8654df099010",
);
const testSourceRevisionId = sourceRevisionId(
  "019e9315-6a87-715f-9861-8654df099011",
);
const testSourceArtifactId = sourceArtifactId(
  "019e9315-6a87-715f-9861-8654df099012",
);
const nextSourceRevisionId = sourceRevisionId(
  "019e9315-6a87-715f-9861-8654df099013",
);
const nextSourceArtifactId = sourceArtifactId(
  "019e9315-6a87-715f-9861-8654df099015",
);
const testWorkbookId = workbookId("019e9315-6a87-715f-9861-8654df099005");
const otherSourceDocumentId = sourceDocumentId(
  "019e9315-6a87-715f-9861-8654df099014",
);

type TestBlueprintInput = {
  createdByUserId: QuestionBlueprint["createdByUserId"];
  currentVersionId: QuestionBlueprint["currentVersionId"];
  description: QuestionBlueprint["description"];
  document: QuestionBlueprint["document"];
  id: QuestionBlueprint["id"];
  name: QuestionBlueprint["name"];
  ownerUserId: QuestionBlueprint["ownerUserId"];
  sources: QuestionBlueprint["sources"];
  visibility: QuestionBlueprint["visibility"];
};

describe("QuestionBlueprintDraftService", () => {
  it("lists published drafts with published status filter", async () => {
    let receivedStatuses: readonly string[] | undefined;
    const service = createService({
      onListQuestionBlueprintDrafts: (input) => {
        receivedStatuses = input.statuses;
      },
    });

    await service.listQuestionBlueprintDrafts({
      currentUser: currentUser(),
      limit: 10,
      status: "published",
    });

    assert.deepEqual(receivedStatuses, ["published"]);
  });

  it("lists drafts by default when no status filter is provided", async () => {
    let receivedStatuses: readonly string[] | undefined;
    const service = createService({
      onListQuestionBlueprintDrafts: (input) => {
        receivedStatuses = input.statuses;
      },
    });

    await service.listQuestionBlueprintDrafts({
      currentUser: currentUser(),
      limit: 10,
    });

    assert.deepEqual(receivedStatuses, ["draft"]);
  });

  it("sets baseVersionId for targeted drafts", async () => {
    const service = createService();

    const result = await service.createQuestionBlueprintDraft({
      blueprintId,
      currentUser: currentUser(),
      document: emptyDocument(),
      name: "Draft",
      sources: [],
    });

    assert.equal(result.draft.blueprintId, blueprintId);
    assert.equal(result.draft.baseVersionId, versionId);
    assert.equal(result.draft.revision, 1);
  });

  it("leaves baseVersionId null for untargeted drafts", async () => {
    const service = createService();

    const result = await service.createQuestionBlueprintDraft({
      currentUser: currentUser(),
      document: emptyDocument(),
      name: "Draft",
      sources: [],
    });

    assert.equal(result.draft.blueprintId, null);
    assert.equal(result.draft.baseVersionId, null);
    assert.equal(result.draft.revision, 1);
  });

  it("initializes create draft source materialization server-side", async () => {
    const service = createService();

    const result = await service.createQuestionBlueprintDraft({
      currentUser: currentUser(),
      document: documentUsing("sourceA"),
      name: "Draft",
      sources: [{ name: "Source A", sourceId: "sourceA", type: "workbook" }],
    });

    assert.deepEqual(result.draft.sources, [
      {
        byteSize: null,
        checksumSha256: null,
        fileId: null,
        name: "Source A",
        originalName: null,
        sourceArtifactId: null,
        sourceDocumentId: null,
        sourceId: "sourceA",
        sourceRevisionId: null,
        status: "local",
        type: "workbook",
        workbookId: null,
      },
    ]);
  });

  it("rejects server-owned source materialization on draft create", async () => {
    const service = createService();

    await assert.rejects(
      () =>
        service.createQuestionBlueprintDraft({
          currentUser: currentUser(),
          document: documentUsing("sourceA"),
          name: "Draft",
          sources: [
            {
              name: "Source A",
              sourceId: "sourceA",
              type: "workbook",
              workbookId: "019e9315-6a87-715f-9861-8654df099005",
            },
          ],
        }),
      /cannot include workbookId/,
    );
  });

  it("creates edit drafts from the current blueprint version", async () => {
    const service = createService();

    const result = await service.createQuestionBlueprintEditDraft({
      blueprintId,
      currentUser: currentUser(),
    });

    assert.equal(result.resolution, "created");
    assert.equal(result.draft.blueprintId, blueprintId);
    assert.equal(result.draft.baseVersionId, versionId);
    assert.equal(result.draft.name, "Blueprint");
    assert.equal(result.draft.revision, 1);
  });

  it("resumes an active edit draft for the same owner and blueprint", async () => {
    const existing = createTargetedDraft();
    const service = createService({ activeDraft: existing });

    const result = await service.createQuestionBlueprintEditDraft({
      blueprintId,
      currentUser: currentUser(),
    });

    assert.equal(result.resolution, "resumed");
    assert.equal(result.draft, existing);
  });

  it("resumes edit draft when a concurrent create wins the unique race", async () => {
    const existing = createTargetedDraft();
    const service = createService({
      activeDraftAfterCreateRace: existing,
    });

    const result = await service.createQuestionBlueprintEditDraft({
      blueprintId,
      currentUser: currentUser(),
    });

    assert.equal(result.resolution, "resumed");
    assert.equal(result.draft, existing);
  });

  it("rejects draft updates with a stale expected revision", async () => {
    const service = createService({ draft: createTargetedDraft() });

    await assert.rejects(
      () =>
        service.updateQuestionBlueprintDraft({
          currentUser: currentUser(),
          draftId,
          patch: {
            description: null,
            document: emptyDocument(),
            expectedRevision: 2,
            name: "Draft",
            sources: [],
          },
        }),
      QuestionBlueprintDraftRevisionConflictError,
    );
  });

  it("optimistically locks draft updates by expected revision", async () => {
    const service = createService({ draft: createTargetedDraft() });

    const first = await service.updateQuestionBlueprintDraft({
      currentUser: currentUser(),
      draftId,
      patch: {
        description: null,
        document: emptyDocument(),
        expectedRevision: 1,
        name: "Draft",
        sources: [],
      },
    });

    assert.equal(first.draft.revision, 2);
    await assert.rejects(
      () =>
        service.updateQuestionBlueprintDraft({
          currentUser: currentUser(),
          draftId,
          patch: {
            description: null,
            document: emptyDocument(),
            expectedRevision: 1,
            name: "Draft",
            sources: [],
          },
        }),
      QuestionBlueprintDraftRevisionConflictError,
    );
  });

  it("materializes draft source intent input on draft update", async () => {
    const service = createService({ draft: createTargetedDraftWithWorkbook() });

    const result = await service.updateQuestionBlueprintDraft({
      currentUser: currentUser(),
      draftId,
      patch: {
        description: null,
        document: documentUsing("sourceA"),
        expectedRevision: 1,
        name: "Draft",
        sources: [
          { name: "Source A", sourceId: "sourceA", type: "workbook" },
          { name: "Source B", sourceId: "sourceB", type: "workbook" },
        ],
      },
    });

    assert.equal(
      result.draft.sources[0]?.workbookId,
      "019e9315-6a87-715f-9861-8654df099005",
    );
    assert.equal(result.draft.sources[0]?.status, "validated");
    assert.equal(
      result.draft.sources[0]?.checksumSha256,
      "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    );
    assert.equal(
      result.draft.sources[0]?.fileId,
      "019e9315-6a87-715f-9861-8654df099006",
    );
    assert.equal(result.draft.sources[0]?.originalName, "source.xlsx");
    assert.deepEqual(result.draft.sources[1], {
      byteSize: null,
      checksumSha256: null,
      fileId: null,
      name: "Source B",
      originalName: null,
      sourceArtifactId: null,
      sourceDocumentId: null,
      sourceId: "sourceB",
      sourceRevisionId: null,
      status: "local",
      type: "workbook",
      workbookId: null,
    });
    assert.equal(result.draft.revision, 2);
  });

  it("rejects server-owned source materialization on draft update", async () => {
    const service = createService({ draft: createTargetedDraftWithWorkbook() });

    await assert.rejects(
      () =>
        service.updateQuestionBlueprintDraft({
          currentUser: currentUser(),
          draftId,
          patch: {
            description: null,
            document: documentUsing("sourceA"),
            expectedRevision: 1,
            name: "Draft",
            sources: [
              {
                name: "Source A",
                sourceId: "sourceA",
                status: "validated",
                type: "workbook",
              },
            ],
          },
        }),
      /cannot include status/,
    );
  });

  it("attaches source files with the expected draft revision", async () => {
    const service = createService({
      draft: createTargetedDraftWithLocalSource(),
      fileMetadata: createFileMetadata(),
    });

    const result = await service.attachQuestionBlueprintDraftSourceFile({
      currentUser: currentUser(),
      draftId,
      expectedRevision: 1,
      fileId: "019e9315-6a87-715f-9861-8654df099006",
      lineage: testLineage(),
      sourceId: "sourceA",
    });

    assert.equal(result.draft.sources[0]?.status, "validated");
    assert.equal(
      result.draft.sources[0]?.fileId,
      "019e9315-6a87-715f-9861-8654df099006",
    );
    assert.equal(
      result.draft.sources[0]?.workbookId,
      "019e9315-6a87-715f-9861-8654df099005",
    );
    assert.equal(
      result.draft.sources[0]?.sourceDocumentId,
      testSourceDocumentId,
    );
    assert.equal(
      result.draft.sources[0]?.sourceRevisionId,
      testSourceRevisionId,
    );
    assert.equal(
      result.draft.sources[0]?.sourceArtifactId,
      testSourceArtifactId,
    );
  });

  it("reuses source document and parents new revision when replacing existing source", async () => {
    const materializations: DraftSourceWorkbookMaterialization[] = [];
    const service = createService({
      draft: createTargetedDraftWithWorkbook(),
      fileMetadata: createFileMetadata(),
      generatedSourceArtifactId: nextSourceArtifactId,
      generatedSourceRevisionId: nextSourceRevisionId,
      onMaterialization: (prepared) => {
        materializations.push(prepared);
      },
    });

    await service.attachQuestionBlueprintDraftSourceFile({
      currentUser: currentUser(),
      draftId,
      expectedRevision: 1,
      fileId: "019e9315-6a87-715f-9861-8654df099006",
      lineage: testLineage(),
      sourceId: "sourceA",
    });

    const materialization = materializations[0];
    assert.ok(materialization);
    assert.equal(materialization.sourceDocument, null);
    assert.equal(materialization.sourceArtifact?.id, nextSourceArtifactId);
    assert.equal(materialization.sourceDocumentId, testSourceDocumentId);
    assert.equal(materialization.sourceRevision?.id, nextSourceRevisionId);
    assert.equal(
      materialization.sourceRevision?.parentRevisionId,
      testSourceRevisionId,
    );
  });

  it("does not parent a new source revision to a previous revision from another document", async () => {
    const materializations: DraftSourceWorkbookMaterialization[] = [];
    const service = createService({
      draft: createTargetedDraftWithWorkbook(),
      fileMetadata: createFileMetadata(),
      generatedSourceArtifactId: nextSourceArtifactId,
      generatedSourceRevisionId: nextSourceRevisionId,
      onMaterialization: (prepared) => {
        materializations.push(prepared);
      },
      previousRevisionSourceDocumentId: otherSourceDocumentId,
    });

    await service.attachQuestionBlueprintDraftSourceFile({
      currentUser: currentUser(),
      draftId,
      expectedRevision: 1,
      fileId: "019e9315-6a87-715f-9861-8654df099006",
      lineage: testLineage(),
      sourceId: "sourceA",
    });

    const materialization = materializations[0];
    assert.ok(materialization);
    assert.equal(materialization.sourceRevision?.parentRevisionId, null);
  });

  it("uses transaction-scoped repository for previous source revision lookup", async () => {
    const service = createService({
      draft: createTargetedDraftWithWorkbook(),
      fileMetadata: createFileMetadata(),
      generatedSourceRevisionId: nextSourceRevisionId,
      rootFindSourceRevisionByIdThrows: true,
    });

    const result = await service.attachQuestionBlueprintDraftSourceFile({
      currentUser: currentUser(),
      draftId,
      expectedRevision: 1,
      fileId: "019e9315-6a87-715f-9861-8654df099006",
      lineage: testLineage(),
      sourceId: "sourceA",
    });

    assert.equal(
      result.draft.sources[0]?.sourceDocumentId,
      testSourceDocumentId,
    );
  });

  it("attaches pending workbook source as uploaded, not validated", async () => {
    const service = createService({
      draft: createTargetedDraftWithLocalSource(),
      fileMetadata: createFileMetadata(),
      registrationStatus: "pending_validation",
    });

    const result = await service.attachQuestionBlueprintDraftSourceFile({
      currentUser: currentUser(),
      draftId,
      expectedRevision: 1,
      fileId: "019e9315-6a87-715f-9861-8654df099006",
      lineage: testLineage(),
      sourceId: "sourceA",
    });

    assert.equal(result.draft.sources[0]?.status, "uploaded");
  });

  it("attaches invalid workbook source as invalid", async () => {
    const service = createService({
      draft: createTargetedDraftWithLocalSource(),
      fileMetadata: createFileMetadata(),
      registrationStatus: "invalid",
      registrationValidationError: "bad workbook",
    });

    const result = await service.attachQuestionBlueprintDraftSourceFile({
      currentUser: currentUser(),
      draftId,
      expectedRevision: 1,
      fileId: "019e9315-6a87-715f-9861-8654df099006",
      lineage: testLineage(),
      sourceId: "sourceA",
    });

    assert.equal(result.draft.sources[0]?.status, "invalid");
  });

  it("rejects source file attach with a stale expected revision", async () => {
    let registered = false;
    const service = createService({
      draft: createTargetedDraftWithLocalSource(),
      fileMetadata: createFileMetadata(),
      onRegisterWorkbook: () => {
        registered = true;
      },
    });

    await assert.rejects(
      () =>
        service.attachQuestionBlueprintDraftSourceFile({
          currentUser: currentUser(),
          draftId,
          expectedRevision: 2,
          fileId: "019e9315-6a87-715f-9861-8654df099006",
          lineage: testLineage(),
          sourceId: "sourceA",
        }),
      QuestionBlueprintDraftRevisionConflictError,
    );
    assert.equal(registered, false);
  });

  it("does not register workbook when attach races with another revision update", async () => {
    let registered = false;
    const service = createService({
      attachRaceBeforeMaterialization: true,
      draft: createTargetedDraftWithLocalSource(),
      fileMetadata: createFileMetadata(),
      onRegisterWorkbook: () => {
        registered = true;
      },
    });

    await assert.rejects(
      () =>
        service.attachQuestionBlueprintDraftSourceFile({
          currentUser: currentUser(),
          draftId,
          expectedRevision: 1,
          fileId: "019e9315-6a87-715f-9861-8654df099006",
          lineage: testLineage(),
          sourceId: "sourceA",
        }),
      QuestionBlueprintDraftRevisionConflictError,
    );

    assert.equal(registered, false);
    const readback = await service.getQuestionBlueprintDraft({
      currentUser: currentUser(),
      draftId,
    });
    assert.equal(readback.draft.revision, 2);
    assert.equal(readback.draft.sources[0]?.workbookId, null);
  });

  it("rejects source files owned by another user", async () => {
    const service = createService({
      draft: createTargetedDraftWithLocalSource(),
      fileMetadata: createFileMetadata({
        ownerUserId: userId("019e9315-6a87-715f-9861-8654df099009"),
      }),
    });

    await assert.rejects(
      () =>
        service.attachQuestionBlueprintDraftSourceFile({
          currentUser: currentUser(),
          draftId,
          expectedRevision: 1,
          fileId: "019e9315-6a87-715f-9861-8654df099006",
          lineage: testLineage(),
          sourceId: "sourceA",
        }),
      /Draft source file must belong to draft owner/,
    );
  });

  it("rejects non-workbook source files", async () => {
    const service = createService({
      draft: createTargetedDraftWithLocalSource(),
      fileMetadata: createFileMetadata({ contentType: "text/plain" }),
    });

    await assert.rejects(
      () =>
        service.attachQuestionBlueprintDraftSourceFile({
          currentUser: currentUser(),
          draftId,
          expectedRevision: 1,
          fileId: "019e9315-6a87-715f-9861-8654df099006",
          lineage: testLineage(),
          sourceId: "sourceA",
        }),
      /Draft source file must be an xlsx workbook/,
    );
  });

  it("optimistically locks draft discard by expected revision", async () => {
    const service = createService({ draft: createTargetedDraft() });

    await assert.rejects(
      () =>
        service.discardQuestionBlueprintDraft({
          currentUser: currentUser(),
          draftId,
          expectedRevision: 2,
        }),
      QuestionBlueprintDraftRevisionConflictError,
    );
  });

  it("rejects publish with a stale draft revision", async () => {
    const service = createService({ draft: createTargetedDraft() });

    await assert.rejects(
      () =>
        service.publishQuestionBlueprintDraft({
          currentUser: currentUser(),
          draftId,
          expectedRevision: 2,
          idempotencyKey: "publish-key",
          lineage: testLineage(),
        }),
      QuestionBlueprintDraftRevisionConflictError,
    );
  });

  it("rejects invalid uploaded source before registration", async () => {
    let registered = false;
    let published = false;
    const service = createService({
      draft: createUntargetedDraftWithInvalidUploadedSource(),
      onPublish: () => {
        published = true;
      },
      onRegisterWorkbook: () => {
        registered = true;
      },
    });

    await assert.rejects(
      () =>
        service.publishQuestionBlueprintDraft({
          currentUser: currentUser(),
          draftId,
          expectedRevision: 1,
          idempotencyKey: "publish-key",
          lineage: testLineage(),
        }),
      /Workbook source is not validated/,
    );

    assert.equal(registered, false);
    assert.equal(published, false);
  });

  it("rejects invalid source with workbook materialization before publish", async () => {
    let registered = false;
    let published = false;
    const service = createService({
      draft: createUntargetedDraftWithInvalidWorkbookSource(),
      onPublish: () => {
        published = true;
      },
      onRegisterWorkbook: () => {
        registered = true;
      },
    });

    await assert.rejects(
      () =>
        service.publishQuestionBlueprintDraft({
          currentUser: currentUser(),
          draftId,
          expectedRevision: 1,
          idempotencyKey: "publish-key",
          lineage: testLineage(),
        }),
      /Workbook source is not validated/,
    );

    assert.equal(registered, false);
    assert.equal(published, false);
  });

  it("rejects validated workbook source without source artifact pins", async () => {
    let published = false;
    const service = createService({
      draft: createUntargetedDraftWithValidatedWorkbookSourceWithoutArtifact(),
      onPublish: () => {
        published = true;
      },
    });

    await assert.rejects(
      () =>
        service.publishQuestionBlueprintDraft({
          currentUser: currentUser(),
          draftId,
          expectedRevision: 1,
          idempotencyKey: "publish-key",
          lineage: testLineage(),
        }),
      /Workbook source is not validated/,
    );

    assert.equal(published, false);
  });

  it("rejects validated workbook source without source document pin", async () => {
    const [source] = validatedDraftWorkbookSources();
    if (!source) throw new Error("missing source fixture");
    const service = createService({
      draft: createUntargetedDraftWithSources([
        { ...source, sourceDocumentId: null },
      ]),
    });

    await assert.rejects(
      () =>
        service.publishQuestionBlueprintDraft({
          currentUser: currentUser(),
          draftId,
          expectedRevision: 1,
          idempotencyKey: "publish-key",
          lineage: testLineage(),
        }),
      /Workbook source is not validated/,
    );
  });

  it("rejects validated workbook source without source revision pin", async () => {
    const [source] = validatedDraftWorkbookSources();
    if (!source) throw new Error("missing source fixture");
    const service = createService({
      draft: createUntargetedDraftWithSources([
        { ...source, sourceRevisionId: null },
      ]),
    });

    await assert.rejects(
      () =>
        service.publishQuestionBlueprintDraft({
          currentUser: currentUser(),
          draftId,
          expectedRevision: 1,
          idempotencyKey: "publish-key",
          lineage: testLineage(),
        }),
      /Workbook source is not validated/,
    );
  });

  it("rejects validated workbook source without source artifact pin", async () => {
    const [source] = validatedDraftWorkbookSources();
    if (!source) throw new Error("missing source fixture");
    const service = createService({
      draft: createUntargetedDraftWithSources([
        { ...source, sourceArtifactId: null },
      ]),
    });

    await assert.rejects(
      () =>
        service.publishQuestionBlueprintDraft({
          currentUser: currentUser(),
          draftId,
          expectedRevision: 1,
          idempotencyKey: "publish-key",
          lineage: testLineage(),
        }),
      /Workbook source is not validated/,
    );
  });

  it("publishes untargeted drafts with no base version", async () => {
    const service = createService({ draft: createUntargetedDraft() });

    const result = await service.publishQuestionBlueprintDraft({
      currentUser: currentUser(),
      draftId,
      expectedRevision: 1,
      idempotencyKey: "publish-key",
      lineage: testLineage(),
    });

    assert.equal(result.draft.baseVersionId, null);
    assert.equal(result.draft.blueprintId, blueprintId);
    assert.equal(result.questionBlueprint.currentVersionId, nextVersionId);
    assert.equal(result.questionBlueprintVersion.id, nextVersionId);
  });

  it("returns same published version for same publish idempotency key", async () => {
    const published = createPublishedDraft("publish-key");
    const service = createService({ draft: published });

    const result = await service.publishQuestionBlueprintDraft({
      currentUser: currentUser(),
      draftId,
      expectedRevision: 2,
      idempotencyKey: "publish-key",
      lineage: testLineage(),
    });

    assert.equal(result.questionBlueprintVersion.id, nextVersionId);
  });

  it("rejects a different publish idempotency key after publish", async () => {
    const published = createPublishedDraft("publish-key");
    const service = createService({ draft: published });

    await assert.rejects(
      () =>
        service.publishQuestionBlueprintDraft({
          currentUser: currentUser(),
          draftId,
          expectedRevision: 2,
          idempotencyKey: "different-key",
          lineage: testLineage(),
        }),
      /cannot be published from current state/,
    );
  });

  it("does not register workbooks while publishing unvalidated draft sources", async () => {
    let registered = false;
    const service = createService({
      draft: createUntargetedDraftWithUploadedSource(),
      onRegisterWorkbook: () => {
        registered = true;
      },
    });

    await assert.rejects(
      () =>
        service.publishQuestionBlueprintDraft({
          currentUser: currentUser(),
          draftId,
          expectedRevision: 1,
          idempotencyKey: "publish-key",
          lineage: testLineage(),
        }),
      /Workbook source is not validated/,
    );

    assert.equal(registered, false);
    const readback = await service.getQuestionBlueprintDraft({
      currentUser: currentUser(),
      draftId,
    });
    assert.equal(readback.draft.status, "draft");
    assert.equal(readback.draft.sources[0]?.workbookId, testWorkbookId);
  });
});

function createService(
  options: {
    activeDraft?: QuestionBlueprintDraft | null;
    activeDraftAfterCreateRace?: QuestionBlueprintDraft;
    attachRaceBeforeMaterialization?: boolean;
    draft?: QuestionBlueprintDraft | null;
    fileMetadata?: DraftSourceFileMetadata;
    generatedSourceArtifactId?: typeof testSourceArtifactId;
    generatedSourceRevisionId?: typeof testSourceRevisionId;
    onListQuestionBlueprintDrafts?: (input: {
      statuses?: readonly QuestionBlueprintDraftStatus[];
    }) => void;
    onMaterialization?: (input: DraftSourceWorkbookMaterialization) => void;
    onPublish?: (input: unknown) => void;
    onRegisterWorkbook?: (input: unknown) => void;
    previousRevisionSourceDocumentId?: typeof testSourceDocumentId;
    publishError?: Error;
    registrationStatus?: "pending_validation" | "valid" | "invalid";
    registrationValidationError?: string | null;
    rootFindSourceRevisionByIdThrows?: boolean;
  } = {},
) {
  let draft = options.draft ?? null;
  let initialDraftRead = true;
  let createdSourceDocument: DraftSourceWorkbookMaterialization["sourceDocument"] =
    null;
  let createdSourceRevision:
    | DraftSourceWorkbookMaterialization["sourceRevision"]
    | null = null;
  const questionsRepository = {
    async createQuestionBlueprintDraft(draft) {
      return draft;
    },
    async createOrResumeQuestionBlueprintEditDraft(input) {
      if (options.activeDraft) {
        return { draft: options.activeDraft, resolution: "resumed" as const };
      }
      if (options.activeDraftAfterCreateRace) {
        return {
          draft: options.activeDraftAfterCreateRace,
          resolution: "resumed" as const,
        };
      }
      return { draft: input.draft, resolution: "created" as const };
    },
    async findActiveQuestionBlueprintDraftByOwnerAndBlueprint() {
      return options.activeDraft ?? null;
    },
    async findQuestionBlueprintDraftById(id) {
      if (
        id === draftId &&
        options.attachRaceBeforeMaterialization &&
        initialDraftRead
      ) {
        initialDraftRead = false;
      }
      return id === draftId ? draft : null;
    },
    async findQuestionBlueprintDraftByIdForUpdate(id) {
      if (id !== draftId) return null;
      if (options.attachRaceBeforeMaterialization && draft) {
        draft = { ...draft, revision: draft.revision + 1 };
      }
      return draft;
    },
    async findQuestionBlueprintById(id) {
      if (id !== blueprintId) return null;
      return createTestBlueprint();
    },
    async findQuestionBlueprintVersionById(id) {
      if (id !== nextVersionId) return null;
      return createTestBlueprintVersion();
    },
    async listQuestionBlueprintDraftsByOwnerUserId(input) {
      options.onListQuestionBlueprintDrafts?.(input);
      return [];
    },
    async publishQuestionBlueprintDraft(input) {
      options.onPublish?.(input);
      if (options.publishError) throw options.publishError;
      if (!draft) return null;
      const materializedSources = draft.sources.map((source) => {
        const prepared = input.sourceMaterialization.find(
          (candidate) => candidate.sourceId === source.sourceId,
        );
        return prepared
          ? {
              ...source,
              sourceArtifactId: prepared.sourceArtifactId,
              sourceDocumentId: prepared.sourceDocumentId,
              sourceRevisionId: prepared.sourceRevisionId,
              status: "validated" as const,
              workbookId: prepared.workbookId,
            }
          : source;
      });
      return {
        draft: markQuestionBlueprintDraftPublished(
          draft,
          {
            blueprintId: input.blueprintId,
            idempotencyKey: input.idempotencyKey,
            sources: materializedSources,
            versionId: input.versionId,
          },
          at,
        ),
        questionBlueprint: createTestBlueprint({
          currentVersionId: input.versionId,
          id: input.blueprintId,
        }),
        questionBlueprintVersion: createTestBlueprintVersion(),
      };
    },
    async findSourceRevisionById(id) {
      if (options.rootFindSourceRevisionByIdThrows) {
        throw new Error("root repository should not resolve source revision");
      }
      if (id !== testSourceRevisionId) return null;
      return {
        byteSize: 1234,
        checksumSha256:
          "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        createdAt: at,
        createdByUserId: ownerUserId,
        editorMetadata: {},
        fileId: "019e9315-6a87-715f-9861-8654df099006",
        id,
        kind: "workbook" as const,
        ownerUserId,
        parentRevisionId: null,
        sourceDocumentId:
          options.previousRevisionSourceDocumentId ?? testSourceDocumentId,
      };
    },
    async createSourceDocument(document) {
      createdSourceDocument = document;
      return document;
    },
    async createSourceRevision(revision) {
      createdSourceRevision = revision;
      return revision;
    },
    async createSourceArtifact(artifact) {
      options.onMaterialization?.({
        advanceDocumentHead: true,
        attachedAt: at,
        draftSourceStatus:
          artifact.status === "valid"
            ? "validated"
            : artifact.status === "invalid"
              ? "invalid"
              : "uploaded",
        sourceArtifact: artifact,
        sourceArtifactId: artifact.id,
        sourceDocument: createdSourceDocument,
        sourceDocumentId: createdSourceDocument?.id ?? testSourceDocumentId,
        sourceRevision: createdSourceRevision ?? revisionFixture(),
        sourceRevisionId: createdSourceRevision?.id ?? testSourceRevisionId,
        workbookId: artifact.workbookId ?? testWorkbookId,
      });
      return artifact;
    },
    async setSourceDocumentCurrentRevision() {
      return (
        createdSourceDocument ?? {
          createdAt: at,
          currentRevisionId: testSourceRevisionId,
          deletedAt: null,
          id: testSourceDocumentId,
          kind: "workbook" as const,
          name: "Source A",
          ownerUserId,
          status: "active" as const,
          updatedAt: at,
        }
      );
    },
    async updateQuestionBlueprintDraftWithExpectedRevision(input) {
      if (draft?.revision !== input.expectedRevision) return null;
      draft = input.draft;
      return draft;
    },
  } satisfies Pick<
    QuestionsRepository,
    | "createQuestionBlueprintDraft"
    | "createOrResumeQuestionBlueprintEditDraft"
    | "createSourceArtifact"
    | "createSourceDocument"
    | "createSourceRevision"
    | "findActiveQuestionBlueprintDraftByOwnerAndBlueprint"
    | "findQuestionBlueprintDraftById"
    | "findQuestionBlueprintDraftByIdForUpdate"
    | "findQuestionBlueprintById"
    | "findQuestionBlueprintVersionById"
    | "findSourceRevisionById"
    | "listQuestionBlueprintDraftsByOwnerUserId"
    | "publishQuestionBlueprintDraft"
    | "setSourceDocumentCurrentRevision"
    | "updateQuestionBlueprintDraftWithExpectedRevision"
  >;

  const workbookRegistrationPort: DraftSourceWorkbookRegistrationPort = {
    async registerWorkbookFromFile(input) {
      options.onRegisterWorkbook?.(input);
      return {
        status: options.registrationStatus ?? "valid",
        validationError: options.registrationValidationError ?? null,
        workbookId: testWorkbookId,
      };
    },
  };

  const questionBlueprintDraftTransaction: QuestionBlueprintDraftTransactionPort =
    {
      async transaction(fn) {
        const transactionQuestionsRepository = {
          ...questionsRepository,
          async findSourceRevisionById(id: typeof testSourceRevisionId) {
            if (id !== testSourceRevisionId) return null;
            return {
              byteSize: 1234,
              checksumSha256:
                "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
              contentType:
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              createdAt: at,
              createdByUserId: ownerUserId,
              editorMetadata: {},
              fileId: "019e9315-6a87-715f-9861-8654df099006",
              id,
              kind: "workbook" as const,
              ownerUserId,
              parentRevisionId: null,
              sourceDocumentId:
                options.previousRevisionSourceDocumentId ??
                testSourceDocumentId,
            };
          },
        };
        return fn({
          questionsRepository:
            transactionQuestionsRepository as unknown as QuestionsRepository,
          workbookRegistrationPort,
        });
      },
    };

  return new QuestionBlueprintDraftService({
    clock: { now: () => at },
    draftSourceFilePort: {
      async getFileMetadata() {
        if (!options.fileMetadata) throw new Error("file missing");
        return options.fileMetadata;
      },
    } as DraftSourceFilePort,
    idGenerator: {
      questionBlueprintDraftId: () => draftId,
      questionBlueprintId: () => blueprintId,
      questionBlueprintVersionId: () => nextVersionId,
      sourceArtifactId: () =>
        options.generatedSourceArtifactId ?? testSourceArtifactId,
      sourceDocumentId: () => testSourceDocumentId,
      sourceRevisionId: () =>
        options.generatedSourceRevisionId ?? testSourceRevisionId,
    } as IdGenerator,
    questionBlueprintDraftTransaction,
    questionsRepository: questionsRepository as unknown as QuestionsRepository,
  });
}

function createTestBlueprint(patch: Partial<TestBlueprintInput> = {}) {
  return createQuestionBlueprint(
    {
      createdByUserId: ownerUserId,
      currentVersionId: versionId,
      description: questionBlueprintDescription(null),
      document: emptyDocument(),
      id: blueprintId,
      name: questionBlueprintName("Blueprint"),
      ownerUserId,
      sources: [],
      visibility: questionBlueprintVisibility("private"),
      ...patch,
    },
    at,
  );
}

function createTargetedDraft() {
  return createDraft(
    {
      baseVersionId: versionId,
      blueprintId,
      createdByUserId: ownerUserId,
      description: questionBlueprintDescription(null),
      document: emptyDocument(),
      id: draftId,
      name: questionBlueprintName("Draft"),
      ownerUserId,
      sources: [],
    },
    at,
  );
}

function createUntargetedDraft() {
  return createDraft(
    {
      baseVersionId: null,
      blueprintId: null,
      createdByUserId: ownerUserId,
      description: questionBlueprintDescription(null),
      document: emptyDocument(),
      id: draftId,
      name: questionBlueprintName("Draft"),
      ownerUserId,
      sources: [],
    },
    at,
  );
}

function createUntargetedDraftWithUploadedSource() {
  return createDraft(
    {
      baseVersionId: null,
      blueprintId: null,
      createdByUserId: ownerUserId,
      description: questionBlueprintDescription(null),
      document: documentUsing("sourceA"),
      id: draftId,
      name: questionBlueprintName("Draft"),
      ownerUserId,
      sources: questionBlueprintDraftSourcesFromRows([
        {
          byteSize: 1234,
          checksumSha256:
            "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          fileId: "019e9315-6a87-715f-9861-8654df099006",
          name: "Source A",
          originalName: "source.xlsx",
          sourceArtifactId: testSourceArtifactId,
          sourceDocumentId: testSourceDocumentId,
          sourceId: "sourceA",
          sourceRevisionId: testSourceRevisionId,
          status: "uploaded",
          type: "workbook",
          workbookId: testWorkbookId,
        },
      ]),
    },
    at,
  );
}

function createUntargetedDraftWithInvalidUploadedSource() {
  return createDraft(
    {
      baseVersionId: null,
      blueprintId: null,
      createdByUserId: ownerUserId,
      description: questionBlueprintDescription(null),
      document: documentUsing("sourceA"),
      id: draftId,
      name: questionBlueprintName("Draft"),
      ownerUserId,
      sources: questionBlueprintDraftSourcesFromRows([
        {
          byteSize: 1234,
          checksumSha256:
            "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          fileId: "019e9315-6a87-715f-9861-8654df099006",
          name: "Source A",
          originalName: "source.xlsx",
          sourceArtifactId: testSourceArtifactId,
          sourceDocumentId: testSourceDocumentId,
          sourceId: "sourceA",
          sourceRevisionId: testSourceRevisionId,
          status: "invalid",
          type: "workbook",
          workbookId: testWorkbookId,
        },
      ]),
    },
    at,
  );
}

function createUntargetedDraftWithInvalidWorkbookSource() {
  const [source] = validatedDraftWorkbookSources();
  if (!source) throw new Error("missing source fixture");
  return createUntargetedDraftWithSources([{ ...source, status: "invalid" }]);
}

function createUntargetedDraftWithValidatedWorkbookSourceWithoutArtifact() {
  const [source] = validatedDraftWorkbookSources();
  if (!source) throw new Error("missing source fixture");
  return createUntargetedDraftWithSources([
    {
      ...source,
      sourceArtifactId: null,
      sourceDocumentId: null,
      sourceRevisionId: null,
    },
  ]);
}

function createUntargetedDraftWithSources(
  sources: QuestionBlueprintDraft["sources"],
) {
  return createDraft(
    {
      baseVersionId: null,
      blueprintId: null,
      createdByUserId: ownerUserId,
      description: questionBlueprintDescription(null),
      document: documentUsing("sourceA"),
      id: draftId,
      name: questionBlueprintName("Draft"),
      ownerUserId,
      sources,
    },
    at,
  );
}

function createTargetedDraftWithWorkbook() {
  return createDraft(
    {
      baseVersionId: versionId,
      blueprintId,
      createdByUserId: ownerUserId,
      description: questionBlueprintDescription(null),
      document: documentUsing("sourceA"),
      id: draftId,
      name: questionBlueprintName("Draft"),
      ownerUserId,
      sources: validatedDraftWorkbookSources(),
    },
    at,
  );
}

function createTargetedDraftWithLocalSource() {
  return createDraft(
    {
      baseVersionId: versionId,
      blueprintId,
      createdByUserId: ownerUserId,
      description: questionBlueprintDescription(null),
      document: documentUsing("sourceA"),
      id: draftId,
      name: questionBlueprintName("Draft"),
      ownerUserId,
      sources: questionBlueprintDraftSourcesFromRows([
        {
          byteSize: null,
          checksumSha256: null,
          fileId: null,
          name: "Source A",
          originalName: null,
          sourceId: "sourceA",
          status: "local",
          type: "workbook",
          workbookId: null,
        },
      ]),
    },
    at,
  );
}

function createFileMetadata(
  patch: Partial<DraftSourceFileMetadata> = {},
): DraftSourceFileMetadata {
  return {
    byteSize: 1234,
    checksumSha256:
      "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    fileId: "019e9315-6a87-715f-9861-8654df099006",
    originalName: "source.xlsx",
    ownerUserId,
    purpose: "workbook",
    ...patch,
  };
}

function validatedDraftWorkbookSources() {
  return questionBlueprintDraftSourcesFromRows([
    {
      byteSize: 1234,
      checksumSha256:
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      fileId: "019e9315-6a87-715f-9861-8654df099006",
      name: "Source A",
      originalName: "source.xlsx",
      sourceArtifactId: testSourceArtifactId,
      sourceDocumentId: testSourceDocumentId,
      sourceId: "sourceA",
      sourceRevisionId: testSourceRevisionId,
      status: "validated",
      type: "workbook",
      workbookId: workbookId("019e9315-6a87-715f-9861-8654df099005"),
    },
  ]);
}

function revisionFixture() {
  return {
    byteSize: 1234,
    checksumSha256:
      "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    createdAt: at,
    createdByUserId: ownerUserId,
    editorMetadata: {},
    fileId: "019e9315-6a87-715f-9861-8654df099006",
    id: testSourceRevisionId,
    kind: "workbook" as const,
    ownerUserId,
    parentRevisionId: null,
    sourceDocumentId: testSourceDocumentId,
  };
}

function createPublishedDraft(idempotencyKey: string) {
  return markQuestionBlueprintDraftPublished(
    createTargetedDraft(),
    {
      blueprintId,
      idempotencyKey:
        questionBlueprintDraftPublishIdempotencyKey(idempotencyKey),
      sources: [],
      versionId: nextVersionId,
    },
    at,
  );
}

function createTestBlueprintVersion() {
  return createQuestionBlueprintVersion(
    {
      blueprintId,
      createdByUserId: ownerUserId,
      description: questionBlueprintDescription(null),
      document: emptyDocument(),
      id: nextVersionId,
      name: questionBlueprintName("Blueprint"),
      ownerUserId,
      parentVersionId: versionId,
      sources: [],
      versionNumber: questionBlueprintVersionNumber(2),
    },
    at,
  );
}

function currentUser(): CurrentUser {
  return {
    isAdmin: false,
    roles: [],
    user: { id: ownerUserId },
  } as unknown as CurrentUser;
}

function testLineage() {
  return rootOperationLineage("019e9315-6a87-715f-9861-8654df099009");
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

function emptyDocument() {
  return questionBlueprintDocument({
    blocks: [],
    references: [],
    responseFields: [],
    schemaVersion: 1,
  });
}
