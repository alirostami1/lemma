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
  type QuestionWorkbookReferenceTargetAvailability,
  type QuestionWorkbookReferenceTargets,
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
import {
  DraftSourceEditorUploadInvalidError,
  DraftSourceEditorUploadNotFoundError,
  DraftSourceEditorUploadStorageError,
  DraftSourceFileInvalidError,
  QuestionBlueprintDraftRevisionConflictError,
  WorkbookSourceEditInvalidatesReferencesError,
} from "./errors.js";
import type {
  DraftSourceFileMetadata,
  DraftSourceFilePort,
  DraftSourceUploadMetadata,
  DraftSourceWorkbookFileInspection,
  DraftSourceWorkbookInspectionPort,
  DraftSourceWorkbookMaterialization,
  DraftSourceWorkbookRegistrationInput,
  DraftSourceWorkbookRegistrationPort,
  IdGenerator,
  QuestionBlueprintDraftTransactionPort,
  QuestionsRepository,
} from "./ports.js";
import {
  WORKBOOK_EDITOR_OUTPUT_FILE_METADATA_TYPE,
  WORKBOOK_EDITOR_OUTPUT_FILE_METADATA_VERSION,
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

  it("creates an editor-scoped workbook upload after draft source checks", async () => {
    let received:
      | Parameters<DraftSourceFilePort["createEditorOutputUpload"]>[0]
      | undefined;
    const service = createService({
      draft: createTargetedDraftWithWorkbook(),
      onCreateEditorOutputUpload: (input) => {
        received = input;
      },
    });

    const result =
      await service.createQuestionBlueprintDraftWorkbookEditorUpload({
        byteSize: 1234,
        checksumSha256:
          "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        currentUser: currentUser(),
        draftId,
        expectedRevision: 1,
        originalName: "source.xlsx",
        sourceId: "sourceA",
      });

    assert.equal(result.upload.id, "019e9315-6a87-715f-9861-8654df099080");
    assert.deepEqual(received, {
      byteSize: 1234,
      checksumSha256:
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      currentUser: currentUser(),
      draftId,
      draftRevision: 1,
      originalName: "source.xlsx",
      sourceArtifactId: testSourceArtifactId,
      sourceDocumentId: testSourceDocumentId,
      sourceId: "sourceA",
      sourceRevisionId: testSourceRevisionId,
    });
  });

  it("rejects editor-scoped workbook upload with a stale draft revision", async () => {
    const service = createService({
      draft: createTargetedDraftWithWorkbook(),
    });

    await assert.rejects(
      () =>
        service.createQuestionBlueprintDraftWorkbookEditorUpload({
          byteSize: 1234,
          checksumSha256:
            "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          contentType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          currentUser: currentUser(),
          draftId,
          expectedRevision: 2,
          originalName: "source.xlsx",
          sourceId: "sourceA",
        }),
      QuestionBlueprintDraftRevisionConflictError,
    );
  });

  it("returns a questions-owned error when editor upload creation fails expected validation", async () => {
    const service = createService({
      createEditorOutputUploadError: new DraftSourceEditorUploadInvalidError(),
      draft: createTargetedDraftWithWorkbook(),
    });

    await assert.rejects(
      () =>
        service.createQuestionBlueprintDraftWorkbookEditorUpload({
          byteSize: 1234,
          checksumSha256:
            "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          contentType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          currentUser: currentUser(),
          draftId,
          expectedRevision: 1,
          originalName: "source.xlsx",
          sourceId: "sourceA",
        }),
      DraftSourceEditorUploadInvalidError,
    );
  });

  it("returns a questions-owned error when editor upload creation has storage failure", async () => {
    const service = createService({
      createEditorOutputUploadError: new DraftSourceEditorUploadStorageError(),
      draft: createTargetedDraftWithWorkbook(),
    });

    await assert.rejects(
      () =>
        service.createQuestionBlueprintDraftWorkbookEditorUpload({
          byteSize: 1234,
          checksumSha256:
            "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          contentType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          currentUser: currentUser(),
          draftId,
          expectedRevision: 1,
          originalName: "source.xlsx",
          sourceId: "sourceA",
        }),
      DraftSourceEditorUploadStorageError,
    );
  });

  it("rejects editor-scoped workbook upload for a local source without an existing revision", async () => {
    const service = createService({
      draft: createTargetedDraftWithLocalSource(),
    });

    await assert.rejects(
      () =>
        service.createQuestionBlueprintDraftWorkbookEditorUpload({
          byteSize: 1234,
          checksumSha256:
            "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          contentType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          currentUser: currentUser(),
          draftId,
          expectedRevision: 1,
          originalName: "source.xlsx",
          sourceId: "sourceA",
        }),
      /requires an existing source revision/,
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

  it("inspects workbook files before the draft write transaction and registers inside it", async () => {
    const events: string[] = [];
    const service = createService({
      draft: createTargetedDraftWithLocalSource(),
      fileMetadata: createFileMetadata(),
      onInspectWorkbookSourceFile: () => {
        events.push("inspect");
      },
      onRegisterWorkbook: () => {
        events.push("register");
      },
      onTransactionStart: () => {
        events.push("transaction:start");
      },
      onTransactionEnd: () => {
        events.push("transaction:end");
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

    assert.deepEqual(events, [
      "inspect",
      "transaction:start",
      "register",
      "transaction:end",
    ]);
  });

  for (const [field, inspection] of [
    [
      "fileId",
      workbookInspectionFixture({
        fileMetadata: createFileMetadata({
          fileId: "019e9315-6a87-715f-9861-8654df099099",
        }),
      }),
    ],
    [
      "byteSize",
      workbookInspectionFixture({
        fileMetadata: createFileMetadata({ byteSize: 4321 }),
      }),
    ],
    [
      "checksumSha256",
      workbookInspectionFixture({
        fileMetadata: createFileMetadata({
          checksumSha256:
            "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        }),
      }),
    ],
    [
      "contentType",
      workbookInspectionFixture({
        fileMetadata: createFileMetadata({ contentType: "application/other" }),
      }),
    ],
  ] as const) {
    it(`rejects stale workbook inspection when ${field} does not match the source file`, async () => {
      const materializations: DraftSourceWorkbookMaterialization[] = [];
      let registered = false;
      const service = createService({
        draft: createTargetedDraftWithLocalSource(),
        fileMetadata: createFileMetadata(),
        inspection,
        onMaterialization: (materialization) => {
          materializations.push(materialization);
        },
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
        DraftSourceFileInvalidError,
      );

      assert.equal(registered, false);
      assert.deepEqual(materializations, []);
    });
  }

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

  it("saves editor output as a new revision and moves only the draft binding", async () => {
    const materializations: DraftSourceWorkbookMaterialization[] = [];
    const originalDraft = createTargetedDraftWithWorkbook();
    const originalSource = originalDraft.sources[0];
    const service = createService({
      draft: originalDraft,
      fileMetadata: createEditorOutputFileMetadata(),
      generatedSourceArtifactId: nextSourceArtifactId,
      generatedSourceRevisionId: nextSourceRevisionId,
      onMaterialization: (prepared) => {
        materializations.push(prepared);
      },
    });

    const result =
      await service.saveQuestionBlueprintDraftWorkbookSourceRevision({
        currentUser: currentUser(),
        draftId,
        expectedRevision: 1,
        editorOutputFileId: "019e9315-6a87-715f-9861-8654df099006",
        lineage: testLineage(),
        sourceId: "sourceA",
      });

    const materialization = materializations[0];
    assert.ok(materialization);
    assert.equal(materialization.sourceDocument, null);
    assert.equal(materialization.sourceDocumentId, testSourceDocumentId);
    assert.equal(materialization.sourceRevision.id, nextSourceRevisionId);
    assert.equal(
      materialization.sourceRevision.parentRevisionId,
      testSourceRevisionId,
    );
    assert.deepEqual(materialization.sourceRevision.editorMetadata, {
      origin: "workbook_editor",
    });
    assert.equal(materialization.sourceArtifact.id, nextSourceArtifactId);
    assert.equal(result.sourceRevision.id, nextSourceRevisionId);
    assert.equal(result.sourceArtifact.id, nextSourceArtifactId);
    assert.equal(
      result.draft.sources[0]?.sourceRevisionId,
      nextSourceRevisionId,
    );
    assert.equal(
      result.draft.sources[0]?.sourceArtifactId,
      nextSourceArtifactId,
    );
    assert.equal(originalSource?.sourceRevisionId, testSourceRevisionId);
    assert.equal(originalSource?.sourceArtifactId, testSourceArtifactId);
  });

  it("blocks workbook editor output that removes a used inserted value target", async () => {
    const materializations: DraftSourceWorkbookMaterialization[] = [];
    const service = createService({
      draft: createTargetedDraftWithWorkbook(
        documentWithInsertedWorkbookCellReference({
          id: "workbook:sourceA:cell:Sheet1:A1",
          ref: "Sheet1!A1",
        }),
      ),
      fileMetadata: createEditorOutputFileMetadata(),
      generatedSourceArtifactId: nextSourceArtifactId,
      generatedSourceRevisionId: nextSourceRevisionId,
      onMaterialization: (materialization) => {
        materializations.push(materialization);
      },
      referenceTargetAvailability: {
        status: "available",
        targets: {
          schemaVersion: 1,
          sheets: [
            {
              dimensions: { columnCount: 10, rowCount: 10 },
              name: "Other",
            },
          ],
        },
      },
    });

    await assert.rejects(
      () =>
        service.saveQuestionBlueprintDraftWorkbookSourceRevision({
          currentUser: currentUser(),
          draftId,
          editorOutputFileId: "019e9315-6a87-715f-9861-8654df099006",
          expectedRevision: 1,
          lineage: testLineage(),
          sourceId: "sourceA",
        }),
      (error) => {
        assert.ok(
          error instanceof WorkbookSourceEditInvalidatesReferencesError,
        );
        assert.deepEqual(error.details.affectedInsertedValues, [
          {
            label: "Inserted value from Sheet1 A1",
            problem: "The workbook sheet is no longer available.",
          },
        ]);
        const details = JSON.stringify(error.details);
        assert.equal(details.includes("sourceA"), false);
        assert.equal(details.includes("workbook:"), false);
        return true;
      },
    );

    assert.deepEqual(materializations, []);
    const readback = await service.getQuestionBlueprintDraft({
      currentUser: currentUser(),
      draftId,
    });
    assert.equal(
      readback.draft.sources[0]?.sourceRevisionId,
      testSourceRevisionId,
    );
    assert.equal(
      readback.draft.sources[0]?.sourceArtifactId,
      testSourceArtifactId,
    );
  });

  it("rejects stale editor output before reference invalidation", async () => {
    const materializations: DraftSourceWorkbookMaterialization[] = [];
    let registered = false;
    const service = createService({
      attachRaceBeforeMaterialization: true,
      draft: createTargetedDraftWithWorkbook(
        documentWithInsertedWorkbookCellReference({
          id: "workbook:sourceA:cell:Sheet1:A1",
          ref: "Sheet1!A1",
        }),
      ),
      fileMetadata: createEditorOutputFileMetadata(),
      generatedSourceArtifactId: nextSourceArtifactId,
      generatedSourceRevisionId: nextSourceRevisionId,
      onMaterialization: (materialization) => {
        materializations.push(materialization);
      },
      onRegisterWorkbook: () => {
        registered = true;
      },
      referenceTargetAvailability: {
        status: "available",
        targets: {
          schemaVersion: 1,
          sheets: [
            {
              dimensions: { columnCount: 10, rowCount: 10 },
              name: "Other",
            },
          ],
        },
      },
    });

    await assert.rejects(
      () =>
        service.saveQuestionBlueprintDraftWorkbookSourceRevision({
          currentUser: currentUser(),
          draftId,
          editorOutputFileId: "019e9315-6a87-715f-9861-8654df099006",
          expectedRevision: 1,
          lineage: testLineage(),
          sourceId: "sourceA",
        }),
      QuestionBlueprintDraftRevisionConflictError,
    );

    assert.equal(registered, false);
    assert.deepEqual(materializations, []);
  });

  it("blocks normal replacement upload that removes a used inserted value target", async () => {
    const materializations: DraftSourceWorkbookMaterialization[] = [];
    let registered = false;
    const service = createService({
      draft: createTargetedDraftWithWorkbook(
        documentWithInsertedWorkbookCellReference({
          id: "workbook:sourceA:cell:Sheet1:A1",
          ref: "Sheet1!A1",
        }),
      ),
      fileMetadata: createFileMetadata(),
      generatedSourceArtifactId: nextSourceArtifactId,
      generatedSourceRevisionId: nextSourceRevisionId,
      onMaterialization: (materialization) => {
        materializations.push(materialization);
      },
      onRegisterWorkbook: () => {
        registered = true;
      },
      referenceTargetAvailability: {
        status: "available",
        targets: {
          schemaVersion: 1,
          sheets: [
            {
              dimensions: { columnCount: 10, rowCount: 10 },
              name: "Other",
            },
          ],
        },
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
      WorkbookSourceEditInvalidatesReferencesError,
    );

    assert.equal(registered, false);
    assert.deepEqual(materializations, []);
    const readback = await service.getQuestionBlueprintDraft({
      currentUser: currentUser(),
      draftId,
    });
    assert.equal(
      readback.draft.sources[0]?.sourceRevisionId,
      testSourceRevisionId,
    );
    assert.equal(
      readback.draft.sources[0]?.sourceArtifactId,
      testSourceArtifactId,
    );
  });

  it("rejects stale replacement upload before reference invalidation", async () => {
    const materializations: DraftSourceWorkbookMaterialization[] = [];
    let registered = false;
    const service = createService({
      attachRaceBeforeMaterialization: true,
      draft: createTargetedDraftWithWorkbook(
        documentWithInsertedWorkbookCellReference({
          id: "workbook:sourceA:cell:Sheet1:A1",
          ref: "Sheet1!A1",
        }),
      ),
      fileMetadata: createFileMetadata(),
      generatedSourceArtifactId: nextSourceArtifactId,
      generatedSourceRevisionId: nextSourceRevisionId,
      onMaterialization: (materialization) => {
        materializations.push(materialization);
      },
      onRegisterWorkbook: () => {
        registered = true;
      },
      referenceTargetAvailability: {
        status: "available",
        targets: {
          schemaVersion: 1,
          sheets: [
            {
              dimensions: { columnCount: 10, rowCount: 10 },
              name: "Other",
            },
          ],
        },
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
    assert.deepEqual(materializations, []);
  });

  it("allows replacement upload with no used inserted values when targets are unavailable", async () => {
    const materializations: DraftSourceWorkbookMaterialization[] = [];
    const service = createService({
      draft: createTargetedDraftWithWorkbook(),
      fileMetadata: createFileMetadata(),
      generatedSourceArtifactId: nextSourceArtifactId,
      generatedSourceRevisionId: nextSourceRevisionId,
      onMaterialization: (materialization) => {
        materializations.push(materialization);
      },
      referenceTargetAvailability: {
        reason: "inspection_unavailable",
        status: "unavailable",
      },
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
      result.draft.sources[0]?.sourceRevisionId,
      nextSourceRevisionId,
    );
    assert.equal(materializations.length, 1);
    assert.deepEqual(materializations[0]?.sourceArtifact.artifactMetadata, {
      originalName: "source.xlsx",
    });
  });

  it("rejects existing-source editor output with pending validation targets when used refs exist", async () => {
    let registered = false;
    const service = createService({
      draft: createTargetedDraftWithWorkbook(
        documentWithInsertedWorkbookCellReference({
          id: "workbook:sourceA:cell:Sheet1:A1",
          ref: "Sheet1!A1",
        }),
      ),
      fileMetadata: createEditorOutputFileMetadata(),
      onRegisterWorkbook: () => {
        registered = true;
      },
      referenceTargetAvailability: {
        reason: "pending_validation",
        status: "unavailable",
      },
      registrationStatus: "pending_validation",
    });

    await assert.rejects(
      () =>
        service.saveQuestionBlueprintDraftWorkbookSourceRevision({
          currentUser: currentUser(),
          draftId,
          editorOutputFileId: "019e9315-6a87-715f-9861-8654df099006",
          expectedRevision: 1,
          lineage: testLineage(),
          sourceId: "sourceA",
        }),
      WorkbookSourceEditInvalidatesReferencesError,
    );

    assert.equal(registered, false);
  });

  it("rejects existing-source editor output when registration is invalid and used refs exist", async () => {
    const materializations: DraftSourceWorkbookMaterialization[] = [];
    let registered = false;
    const service = createService({
      draft: createTargetedDraftWithWorkbook(
        documentWithInsertedWorkbookCellReference({
          id: "workbook:sourceA:cell:Sheet1:A1",
          ref: "Sheet1!A1",
        }),
      ),
      fileMetadata: createEditorOutputFileMetadata(),
      generatedSourceArtifactId: nextSourceArtifactId,
      generatedSourceRevisionId: nextSourceRevisionId,
      onMaterialization: (materialization) => {
        materializations.push(materialization);
      },
      onRegisterWorkbook: () => {
        registered = true;
      },
      referenceTargetAvailability: {
        status: "available",
        targets: referenceTargetsFixture(),
      },
      registrationStatus: "invalid",
      registrationValidationError: "bad workbook",
    });

    await assert.rejects(
      () =>
        service.saveQuestionBlueprintDraftWorkbookSourceRevision({
          currentUser: currentUser(),
          draftId,
          editorOutputFileId: "019e9315-6a87-715f-9861-8654df099006",
          expectedRevision: 1,
          lineage: testLineage(),
          sourceId: "sourceA",
        }),
      WorkbookSourceEditInvalidatesReferencesError,
    );

    assert.equal(registered, false);
    assert.deepEqual(materializations, []);
    const readback = await service.getQuestionBlueprintDraft({
      currentUser: currentUser(),
      draftId,
    });
    assert.equal(
      readback.draft.sources[0]?.sourceRevisionId,
      testSourceRevisionId,
    );
    assert.equal(
      readback.draft.sources[0]?.sourceArtifactId,
      testSourceArtifactId,
    );
  });

  it("stores workbook target metadata on the new source artifact when provided", async () => {
    const materializations: DraftSourceWorkbookMaterialization[] = [];
    const registrationInputs: DraftSourceWorkbookRegistrationInput[] = [];
    let inspectionCount = 0;
    const service = createService({
      draft: createTargetedDraftWithWorkbook(
        documentWithInsertedWorkbookCellReference({
          id: "workbook:sourceA:cell:Sheet1:A1",
          ref: "Sheet1!A1",
        }),
      ),
      fileMetadata: createEditorOutputFileMetadata(),
      generatedSourceArtifactId: nextSourceArtifactId,
      generatedSourceRevisionId: nextSourceRevisionId,
      onMaterialization: (materialization) => {
        materializations.push(materialization);
      },
      onInspectWorkbookSourceFile: () => {
        inspectionCount += 1;
      },
      onRegisterWorkbook: (input) => {
        registrationInputs.push(input);
      },
      referenceTargetAvailability: {
        status: "available",
        targets: {
          schemaVersion: 1,
          sheets: [
            {
              dimensions: { columnCount: 1, rowCount: 1 },
              name: "Sheet1",
              valueCells: ["A1"],
            },
          ],
        },
      },
    });

    await service.saveQuestionBlueprintDraftWorkbookSourceRevision({
      currentUser: currentUser(),
      draftId,
      editorOutputFileId: "019e9315-6a87-715f-9861-8654df099006",
      expectedRevision: 1,
      lineage: testLineage(),
      sourceId: "sourceA",
    });

    assert.equal(inspectionCount, 1);
    assert.deepEqual(materializations[0]?.sourceArtifact.artifactMetadata, {
      originalName: "source.xlsx",
      workbookReferenceTargets: {
        schemaVersion: 1,
        sheets: [
          {
            dimensions: { columnCount: 1, rowCount: 1 },
            name: "Sheet1",
            valueCells: ["A1"],
          },
        ],
      },
    });
    assert.deepEqual(registrationInputs[0]?.inspection, {
      byteSize: 1234,
      checksumSha256:
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fileId: "019e9315-6a87-715f-9861-8654df099006",
      referenceTargetAvailability: {
        status: "available",
        targets: {
          schemaVersion: 1,
          sheets: [
            {
              dimensions: { columnCount: 1, rowCount: 1 },
              name: "Sheet1",
              valueCells: ["A1"],
            },
          ],
        },
      },
      referenceTargets: {
        schemaVersion: 1,
        sheets: [
          {
            dimensions: { columnCount: 1, rowCount: 1 },
            name: "Sheet1",
            valueCells: ["A1"],
          },
        ],
      },
      schemaVersion: 1,
      validation: { status: "valid" },
    });
  });

  it("rejects editor output for a source without an existing revision", async () => {
    const service = createService({
      draft: createTargetedDraftWithLocalSource(),
      fileMetadata: createFileMetadata(),
    });

    await assert.rejects(
      () =>
        service.saveQuestionBlueprintDraftWorkbookSourceRevision({
          currentUser: currentUser(),
          draftId,
          expectedRevision: 1,
          editorOutputFileId: "019e9315-6a87-715f-9861-8654df099006",
          lineage: testLineage(),
          sourceId: "sourceA",
        }),
      /requires an existing source revision/,
    );
  });

  it("rejects existing-source edits with partial source lifecycle pins", async () => {
    const [source] = validatedDraftWorkbookSources();
    if (!source) throw new Error("missing source fixture");
    const service = createService({
      draft: createUntargetedDraftWithSources([
        { ...source, sourceArtifactId: null },
      ]),
      fileMetadata: createFileMetadata(),
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
      /Workbook source is not validated/,
    );
  });

  it("rejects a normal workbook upload as workbook editor output", async () => {
    const service = createService({
      draft: createTargetedDraftWithWorkbook(),
      fileMetadata: createFileMetadata({ purpose: "workbook" }),
    });

    await assert.rejects(
      () =>
        service.saveQuestionBlueprintDraftWorkbookSourceRevision({
          currentUser: currentUser(),
          draftId,
          editorOutputFileId: "019e9315-6a87-715f-9861-8654df099006",
          expectedRevision: 1,
          lineage: testLineage(),
          sourceId: "sourceA",
        }),
      /Workbook editor output file is invalid/,
    );
  });

  it("rejects workbook editor output as a normal source attachment", async () => {
    const service = createService({
      draft: createTargetedDraftWithLocalSource(),
      fileMetadata: createEditorOutputFileMetadata(),
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

  it("rejects editor output scoped to another draft source", async () => {
    const service = createService({
      draft: createTargetedDraftWithWorkbook(),
      fileMetadata: createEditorOutputFileMetadata({
        metadata: {
          ...editorOutputFileMetadata(),
          sourceId: "otherSource",
        },
      }),
    });

    await assert.rejects(
      () =>
        service.saveQuestionBlueprintDraftWorkbookSourceRevision({
          currentUser: currentUser(),
          draftId,
          editorOutputFileId: "019e9315-6a87-715f-9861-8654df099006",
          expectedRevision: 1,
          lineage: testLineage(),
          sourceId: "sourceA",
        }),
      DraftSourceEditorUploadInvalidError,
    );
  });

  for (const [name, metadata, expectedError] of [
    [
      "missing metadata type",
      (() => {
        const { type: _type, ...rest } = editorOutputFileMetadata();
        return rest;
      })(),
      DraftSourceEditorUploadInvalidError,
    ],
    [
      "wrong metadata type",
      { ...editorOutputFileMetadata(), type: "other" },
      DraftSourceEditorUploadInvalidError,
    ],
    [
      "wrong metadata version",
      { ...editorOutputFileMetadata(), version: 2 },
      DraftSourceEditorUploadInvalidError,
    ],
    [
      "wrong metadata owner",
      {
        ...editorOutputFileMetadata(),
        ownerUserId: "019e9315-6a87-715f-9861-8654df099099",
      },
      DraftSourceEditorUploadInvalidError,
    ],
    [
      "wrong metadata draft",
      {
        ...editorOutputFileMetadata(),
        draftId: "019e9315-6a87-715f-9861-8654df099099",
      },
      DraftSourceEditorUploadInvalidError,
    ],
    [
      "wrong metadata source",
      { ...editorOutputFileMetadata(), sourceId: "otherSource" },
      DraftSourceEditorUploadInvalidError,
    ],
    [
      "wrong metadata draft revision",
      { ...editorOutputFileMetadata(), draftRevision: 2 },
      /workbook editor output is stale/,
    ],
    [
      "wrong metadata source document",
      {
        ...editorOutputFileMetadata(),
        sourceDocumentId: "019e9315-6a87-715f-9861-8654df099099",
      },
      /workbook editor output is stale/,
    ],
    [
      "wrong metadata source artifact",
      {
        ...editorOutputFileMetadata(),
        sourceArtifactId: "019e9315-6a87-715f-9861-8654df099099",
      },
      /workbook editor output is stale/,
    ],
  ] as const) {
    it(`rejects editor output with ${name}`, async () => {
      const materializations: DraftSourceWorkbookMaterialization[] = [];
      const service = createService({
        draft: createTargetedDraftWithWorkbook(),
        fileMetadata: createEditorOutputFileMetadata({ metadata }),
        onMaterialization: (materialization) => {
          materializations.push(materialization);
        },
      });

      await assert.rejects(
        () =>
          service.saveQuestionBlueprintDraftWorkbookSourceRevision({
            currentUser: currentUser(),
            draftId,
            editorOutputFileId: "019e9315-6a87-715f-9861-8654df099006",
            expectedRevision: 1,
            lineage: testLineage(),
            sourceId: "sourceA",
          }),
        expectedError,
      );

      assert.deepEqual(materializations, []);
    });
  }

  it("rejects stale editor output created for an older source revision without persisting a new revision", async () => {
    const staleSourceRevisionId = sourceRevisionId(
      "019e9315-6a87-715f-9861-8654df099081",
    );
    const sourceRevisionIds: string[] = [];
    const sourceArtifactIds: string[] = [];
    const service = createService({
      draft: createTargetedDraftWithWorkbook(),
      fileMetadata: createEditorOutputFileMetadata({
        metadata: {
          ...editorOutputFileMetadata(),
          sourceRevisionId: staleSourceRevisionId,
        },
      }),
      onMaterialization: (materialization) => {
        sourceRevisionIds.push(materialization.sourceRevisionId);
        sourceArtifactIds.push(materialization.sourceArtifactId);
      },
    });

    await assert.rejects(
      () =>
        service.saveQuestionBlueprintDraftWorkbookSourceRevision({
          currentUser: currentUser(),
          draftId,
          editorOutputFileId: "019e9315-6a87-715f-9861-8654df099006",
          expectedRevision: 1,
          lineage: testLineage(),
          sourceId: "sourceA",
        }),
      /workbook editor output is stale/,
    );

    assert.deepEqual(sourceRevisionIds, []);
    assert.deepEqual(sourceArtifactIds, []);
    const readback = await service.getQuestionBlueprintDraft({
      currentUser: currentUser(),
      draftId,
    });
    assert.equal(
      readback.draft.sources[0]?.sourceRevisionId,
      testSourceRevisionId,
    );
    assert.equal(
      readback.draft.sources[0]?.sourceArtifactId,
      testSourceArtifactId,
    );
  });

  it("completes an editor-scoped upload only when metadata matches the current source state", async () => {
    const service = createService({
      draft: createTargetedDraftWithWorkbook(),
      fileMetadata: createEditorOutputFileMetadata(),
      uploadMetadata: createEditorOutputUploadMetadata(),
    });

    const result =
      await service.completeQuestionBlueprintDraftWorkbookEditorUpload({
        currentUser: currentUser(),
        draftId,
        expectedRevision: 1,
        sourceId: "sourceA",
        uploadId: "019e9315-6a87-715f-9861-8654df099080",
      });

    assert.equal(
      result.editorOutputFile.id,
      "019e9315-6a87-715f-9861-8654df099006",
    );
  });

  it("rejects editor-scoped upload completion when metadata has the wrong source revision", async () => {
    const service = createService({
      draft: createTargetedDraftWithWorkbook(),
      uploadMetadata: createEditorOutputUploadMetadata({
        metadata: {
          ...editorOutputFileMetadata(),
          sourceRevisionId: sourceRevisionId(
            "019e9315-6a87-715f-9861-8654df099081",
          ),
        },
      }),
    });

    await assert.rejects(
      () =>
        service.completeQuestionBlueprintDraftWorkbookEditorUpload({
          currentUser: currentUser(),
          draftId,
          expectedRevision: 1,
          sourceId: "sourceA",
          uploadId: "019e9315-6a87-715f-9861-8654df099080",
        }),
      /workbook editor output is stale/,
    );
  });

  it("returns a questions-owned error when editor upload metadata is not found", async () => {
    const service = createService({
      draft: createTargetedDraftWithWorkbook(),
      getUploadMetadataError: new DraftSourceEditorUploadNotFoundError(),
    });

    await assert.rejects(
      () =>
        service.completeQuestionBlueprintDraftWorkbookEditorUpload({
          currentUser: currentUser(),
          draftId,
          expectedRevision: 1,
          sourceId: "sourceA",
          uploadId: "019e9315-6a87-715f-9861-8654df099080",
        }),
      DraftSourceEditorUploadNotFoundError,
    );
  });

  it("returns a questions-owned error when editor upload completion fails expected validation", async () => {
    const service = createService({
      completeEditorOutputUploadError:
        new DraftSourceEditorUploadInvalidError(),
      draft: createTargetedDraftWithWorkbook(),
      uploadMetadata: createEditorOutputUploadMetadata(),
    });

    await assert.rejects(
      () =>
        service.completeQuestionBlueprintDraftWorkbookEditorUpload({
          currentUser: currentUser(),
          draftId,
          expectedRevision: 1,
          sourceId: "sourceA",
          uploadId: "019e9315-6a87-715f-9861-8654df099080",
        }),
      DraftSourceEditorUploadInvalidError,
    );
  });

  it("does not normalize unexpected editor upload completion errors", async () => {
    const unexpected = new Error("programmer error");
    const service = createService({
      completeEditorOutputUploadError: unexpected,
      draft: createTargetedDraftWithWorkbook(),
      uploadMetadata: createEditorOutputUploadMetadata(),
    });

    await assert.rejects(
      () =>
        service.completeQuestionBlueprintDraftWorkbookEditorUpload({
          currentUser: currentUser(),
          draftId,
          expectedRevision: 1,
          sourceId: "sourceA",
          uploadId: "019e9315-6a87-715f-9861-8654df099080",
        }),
      (error: unknown) => error === unexpected,
    );
  });

  it("does not normalize unexpected file metadata errors", async () => {
    const unexpected = new Error("programmer error");
    const service = createService({
      draft: createTargetedDraftWithLocalSource(),
      fileMetadataError: unexpected,
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
      (error: unknown) => error === unexpected,
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

  it("maps unavailable source file metadata lookup to draft source invalid", async () => {
    const service = createService({
      draft: createTargetedDraftWithLocalSource(),
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
      /Draft source file is unavailable/,
    );
  });

  it("rethrows unexpected source file metadata lookup errors", async () => {
    const unexpected = new Error("database unavailable");
    const service = createService({
      draft: createTargetedDraftWithLocalSource(),
      fileMetadataUnexpectedError: unexpected,
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
      unexpected,
    );
  });

  it("rejects source files that become unavailable under the file guard lock", async () => {
    const service = createService({
      draft: createTargetedDraftWithLocalSource(),
      fileMetadata: createFileMetadata(),
      fileReferenceUnavailable: true,
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
      /Draft source file is unavailable/,
    );
  });

  it("rethrows unexpected file guard errors", async () => {
    const unexpected = new Error("database unavailable");
    const service = createService({
      draft: createTargetedDraftWithLocalSource(),
      fileMetadata: createFileMetadata(),
      fileReferenceUnexpectedError: unexpected,
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
      unexpected,
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
    createEditorOutputUploadError?: Error;
    draft?: QuestionBlueprintDraft | null;
    completeEditorOutputUploadError?: Error;
    fileMetadataError?: Error;
    fileMetadata?: DraftSourceFileMetadata;
    fileMetadataUnexpectedError?: Error;
    fileReferenceUnavailable?: boolean;
    fileReferenceUnexpectedError?: Error;
    getUploadMetadataError?: Error;
    uploadMetadata?: DraftSourceUploadMetadata;
    generatedSourceArtifactId?: typeof testSourceArtifactId;
    generatedSourceRevisionId?: typeof testSourceRevisionId;
    inspection?: DraftSourceWorkbookFileInspection;
    onListQuestionBlueprintDrafts?: (input: {
      statuses?: readonly QuestionBlueprintDraftStatus[];
    }) => void;
    onCreateEditorOutputUpload?: (
      input: Parameters<DraftSourceFilePort["createEditorOutputUpload"]>[0],
    ) => void;
    onMaterialization?: (input: DraftSourceWorkbookMaterialization) => void;
    onInspectWorkbookSourceFile?: () => void;
    onPublish?: (input: unknown) => void;
    onRegisterWorkbook?: (input: DraftSourceWorkbookRegistrationInput) => void;
    onTransactionEnd?: () => void;
    onTransactionStart?: () => void;
    previousRevisionSourceDocumentId?: typeof testSourceDocumentId;
    publishError?: Error;
    registrationStatus?: "pending_validation" | "valid" | "invalid";
    referenceTargetAvailability?: QuestionWorkbookReferenceTargetAvailability;
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
        deletedAt: null,
        editorMetadata: {},
        fileId: "019e9315-6a87-715f-9861-8654df099006",
        id,
        kind: "workbook" as const,
        ownerUserId,
        parentRevisionId: null,
        retentionExpiresAt: null,
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
        inspection: workbookInspectionFixture(options),
        registeredStatus: options.registrationStatus ?? "valid",
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
          retentionExpiresAt: null,
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

  const draftSourceWorkbookInspectionPort: DraftSourceWorkbookInspectionPort = {
    async inspectWorkbookSourceFile() {
      options.onInspectWorkbookSourceFile?.();
      return options.inspection ?? workbookInspectionFixture(options);
    },
  };

  const workbookRegistrationPort: DraftSourceWorkbookRegistrationPort = {
    async registerInspectedWorkbookFromFile(input) {
      options.onRegisterWorkbook?.(input);
      const status =
        input.inspection.validation.status === "invalid"
          ? "invalid"
          : (options.registrationStatus ?? "valid");
      return {
        inspection: input.inspection,
        status,
        validationError:
          input.inspection.validation.status === "invalid"
            ? input.inspection.validation.validationError
            : (options.registrationValidationError ?? null),
        workbookId: testWorkbookId,
      };
    },
  };

  const questionBlueprintDraftTransaction: QuestionBlueprintDraftTransactionPort =
    {
      async transaction(fn) {
        options.onTransactionStart?.();
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
        try {
          return await fn({
            fileReferenceGuard: {
              async assertFileAliasReferenceableForUpdate() {
                if (options.fileReferenceUnexpectedError) {
                  throw options.fileReferenceUnexpectedError;
                }
                if (options.fileReferenceUnavailable) {
                  throw new DraftSourceFileInvalidError(
                    "Draft source file is unavailable.",
                  );
                }
              },
            },
            questionsRepository:
              // This focused transaction fake implements only methods exercised
              // by the draft-source attach workflow under test.
              transactionQuestionsRepository as unknown as QuestionsRepository,
            workbookRegistrationPort,
          });
        } finally {
          options.onTransactionEnd?.();
        }
      },
    };

  return new QuestionBlueprintDraftService({
    clock: { now: () => at },
    draftSourceWorkbookInspectionPort,
    draftSourceFilePort: {
      async createEditorOutputUpload(input) {
        options.onCreateEditorOutputUpload?.(input);
        if (options.createEditorOutputUploadError) {
          throw options.createEditorOutputUploadError;
        }
        return createEditorOutputUploadResult();
      },
      async completeEditorOutputUpload() {
        if (options.completeEditorOutputUploadError) {
          throw options.completeEditorOutputUploadError;
        }
        const file = options.fileMetadata ?? createEditorOutputFileMetadata();
        return {
          file: {
            byteSize: file.byteSize,
            checksumSha256: file.checksumSha256,
            contentType: file.contentType,
            id: file.fileId,
            metadata: file.metadata,
            originalName: file.originalName,
            ownerUserId: file.ownerUserId,
            purpose: file.purpose,
          },
        };
      },
      async getFileMetadata() {
        if (options.fileMetadataUnexpectedError) {
          throw options.fileMetadataUnexpectedError;
        }
        if (options.fileMetadataError) throw options.fileMetadataError;
        if (!options.fileMetadata) {
          throw new DraftSourceFileInvalidError(
            "Draft source file is unavailable.",
          );
        }
        return options.fileMetadata;
      },
      async getUploadMetadata() {
        if (options.getUploadMetadataError) {
          throw options.getUploadMetadataError;
        }
        return options.uploadMetadata ?? createEditorOutputUploadMetadata();
      },
    } satisfies DraftSourceFilePort,
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
    // This focused repository fake implements only methods exercised by these
    // application service tests.
    questionsRepository: questionsRepository as unknown as QuestionsRepository,
  });
}

function availableReferenceTargetAvailability(
  value?: QuestionWorkbookReferenceTargetAvailability,
): QuestionWorkbookReferenceTargetAvailability {
  return value ?? { status: "available", targets: referenceTargetsFixture() };
}

function draftSourceWorkbookFileInspection(input: {
  byteSize: number;
  checksumSha256: string;
  contentType: string;
  fileId: string;
  referenceTargetAvailability: QuestionWorkbookReferenceTargetAvailability;
  validation?: DraftSourceWorkbookFileInspection["validation"];
}): DraftSourceWorkbookFileInspection {
  return {
    byteSize: input.byteSize,
    checksumSha256: input.checksumSha256,
    contentType: input.contentType,
    fileId: input.fileId,
    referenceTargetAvailability: input.referenceTargetAvailability,
    referenceTargets:
      input.referenceTargetAvailability.status === "available"
        ? input.referenceTargetAvailability.targets
        : null,
    schemaVersion: 1,
    validation:
      input.validation ??
      (input.referenceTargetAvailability.status === "available"
        ? { status: "valid" }
        : { status: "pending_validation" }),
  };
}

function workbookInspectionFixture(options: {
  fileMetadata?: DraftSourceFileMetadata;
  registrationStatus?: "pending_validation" | "valid" | "invalid";
  referenceTargetAvailability?: QuestionWorkbookReferenceTargetAvailability;
  registrationValidationError?: string | null;
}): DraftSourceWorkbookFileInspection {
  const file = options.fileMetadata ?? createFileMetadata();
  if (options.registrationStatus === "invalid") {
    return draftSourceWorkbookFileInspection({
      byteSize: file.byteSize,
      checksumSha256: file.checksumSha256,
      contentType: file.contentType,
      fileId: file.fileId,
      referenceTargetAvailability: {
        reason: "invalid_workbook",
        status: "unavailable",
      },
      validation: {
        status: "invalid",
        validationError:
          options.registrationValidationError ?? "Workbook is invalid.",
      },
    });
  }
  return draftSourceWorkbookFileInspection({
    byteSize: file.byteSize,
    checksumSha256: file.checksumSha256,
    contentType: file.contentType,
    fileId: file.fileId,
    referenceTargetAvailability: availableReferenceTargetAvailability(
      options.referenceTargetAvailability,
    ),
  });
}

function referenceTargetsFixture(): QuestionWorkbookReferenceTargets {
  return {
    schemaVersion: 1,
    sheets: [
      {
        dimensions: { columnCount: 3, rowCount: 3 },
        name: "Sheet1",
        valueCells: ["A1", "B2", "C3"],
      },
    ],
  };
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

function createTargetedDraftWithWorkbook(document = documentUsing("sourceA")) {
  return createDraft(
    {
      baseVersionId: versionId,
      blueprintId,
      createdByUserId: ownerUserId,
      description: questionBlueprintDescription(null),
      document,
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
    metadata: {},
    originalName: "source.xlsx",
    ownerUserId,
    purpose: "workbook",
    ...patch,
  };
}

function createEditorOutputFileMetadata(
  patch: Partial<DraftSourceFileMetadata> = {},
): DraftSourceFileMetadata {
  return createFileMetadata({
    metadata: editorOutputFileMetadata(),
    purpose: "workbook_editor_output",
    ...patch,
  });
}

function createEditorOutputUploadMetadata(
  patch: Partial<DraftSourceUploadMetadata> = {},
): DraftSourceUploadMetadata {
  return {
    metadata: editorOutputFileMetadata(),
    ownerUserId,
    purpose: "workbook_editor_output",
    uploadId: "019e9315-6a87-715f-9861-8654df099080",
    ...patch,
  };
}

function editorOutputFileMetadata() {
  return {
    draftId,
    draftRevision: 1,
    ownerUserId,
    sourceArtifactId: testSourceArtifactId,
    sourceDocumentId: testSourceDocumentId,
    sourceId: "sourceA",
    sourceRevisionId: testSourceRevisionId,
    type: WORKBOOK_EDITOR_OUTPUT_FILE_METADATA_TYPE,
    version: WORKBOOK_EDITOR_OUTPUT_FILE_METADATA_VERSION,
  };
}

function createEditorOutputUploadResult() {
  return {
    upload: {
      checksumSha256:
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      completedAt: null,
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      createdAt: at,
      createdByUserId: ownerUserId,
      expectedByteSize: 1234,
      id: "019e9315-6a87-715f-9861-8654df099080",
      originalName: "source.xlsx",
      purpose: "workbook_editor_output",
      status: "initiated" as const,
      updatedAt: at,
      uploadExpiresAt: at,
    },
    uploadUrl: {
      expiresInSeconds: 900,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
      method: "PUT" as const,
      url: "https://storage.example/upload",
    },
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
    deletedAt: null,
    editorMetadata: {},
    fileId: "019e9315-6a87-715f-9861-8654df099006",
    id: testSourceRevisionId,
    kind: "workbook" as const,
    ownerUserId,
    parentRevisionId: null,
    retentionExpiresAt: null,
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
    // CurrentUser has additional auth-derived fields irrelevant to these
    // application tests.
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

function documentWithInsertedWorkbookCellReference(input: {
  id: string;
  ref: string;
}) {
  return questionBlueprintDocument({
    blocks: [
      {
        content: [{ referenceId: input.id, type: "reference" }],
        id: "block_1",
        type: "text",
      },
    ],
    references: [
      {
        id: input.id,
        source: {
          ref: input.ref,
          schemaVersion: 1,
          sourceId: "sourceA",
          type: "workbook_cell",
        },
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
