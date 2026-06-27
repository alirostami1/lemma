import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rootOperationLineage } from "@lemma/domain";
import type { CurrentUser } from "@lemma/identity/application";
import {
  attachDraftSourceFile,
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
  userId,
  workbookId,
} from "../domain/index.js";
import { QuestionBlueprintDraftRevisionConflictError } from "./errors.js";
import type {
  DraftSourceFileMetadata,
  DraftSourceFilePort,
  IdGenerator,
  QuestionsRepository,
  WorkbookRegistrationPort,
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
        sourceId: "sourceA",
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
    assert.equal(result.draft.sources[0]?.checksumSha256, null);
    assert.equal(result.draft.sources[0]?.fileId, null);
    assert.equal(result.draft.sources[0]?.originalName, null);
    assert.deepEqual(result.draft.sources[1], {
      byteSize: null,
      checksumSha256: null,
      fileId: null,
      name: "Source B",
      originalName: null,
      sourceId: "sourceB",
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
    assert.equal(readback.draft.sources[0]?.workbookId, null);
  });
});

function createService(
  options: {
    activeDraft?: QuestionBlueprintDraft | null;
    activeDraftAfterCreateRace?: QuestionBlueprintDraft;
    attachRaceBeforeMaterialization?: boolean;
    draft?: QuestionBlueprintDraft | null;
    fileMetadata?: DraftSourceFileMetadata;
    onListQuestionBlueprintDrafts?: (input: {
      statuses?: readonly QuestionBlueprintDraftStatus[];
    }) => void;
    onPublish?: (input: unknown) => void;
    onRegisterWorkbook?: (input: unknown) => void;
    publishError?: Error;
  } = {},
) {
  let draft = options.draft ?? null;
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
      return id === draftId ? draft : null;
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
    async attachQuestionBlueprintDraftSourceFileWithExpectedRevision(input) {
      if (!draft || draft.id !== input.draftId) return null;
      if (draft.revision !== input.expectedRevision) {
        throw new QuestionBlueprintDraftRevisionConflictError();
      }
      if (options.attachRaceBeforeMaterialization) {
        draft = { ...draft, revision: draft.revision + 1 };
        throw new QuestionBlueprintDraftRevisionConflictError();
      }
      const source = draft.sources.find(
        (candidate) => candidate.sourceId === input.sourceId,
      );
      if (!source) return null;
      const registered = await input.registerWorkbookFromFile({
        currentUser: input.currentUser,
        fileId: input.file.fileId,
        lineage: input.lineage,
        name: source.name,
      });
      draft = attachDraftSourceFile(
        draft,
        {
          byteSize: input.file.byteSize,
          checksumSha256: input.file.checksumSha256,
          fileId: input.file.fileId,
          originalName: input.file.originalName,
          sourceId: input.sourceId,
          workbookId: workbookId(registered.workbookId),
        },
        input.registeredAt,
      );
      return draft;
    },
    async updateQuestionBlueprintDraftWithExpectedRevision(input) {
      if (draft?.revision !== input.expectedRevision) return null;
      draft = input.draft;
      return draft;
    },
  } satisfies Pick<
    QuestionsRepository,
    | "attachQuestionBlueprintDraftSourceFileWithExpectedRevision"
    | "createQuestionBlueprintDraft"
    | "createOrResumeQuestionBlueprintEditDraft"
    | "findActiveQuestionBlueprintDraftByOwnerAndBlueprint"
    | "findQuestionBlueprintDraftById"
    | "findQuestionBlueprintById"
    | "findQuestionBlueprintVersionById"
    | "listQuestionBlueprintDraftsByOwnerUserId"
    | "publishQuestionBlueprintDraft"
    | "updateQuestionBlueprintDraftWithExpectedRevision"
  >;

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
    } as IdGenerator,
    questionsRepository: questionsRepository as unknown as QuestionsRepository,
    workbookRegistrationPort: {
      async registerWorkbookFromFile(input) {
        options.onRegisterWorkbook?.(input);
        return { workbookId: "019e9315-6a87-715f-9861-8654df099005" };
      },
    } as WorkbookRegistrationPort,
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
          sourceId: "sourceA",
          status: "uploaded",
          type: "workbook",
          workbookId: null,
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
          sourceId: "sourceA",
          status: "invalid",
          type: "workbook",
          workbookId: null,
        },
      ]),
    },
    at,
  );
}

function createUntargetedDraftWithInvalidWorkbookSource() {
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
          byteSize: null,
          checksumSha256: null,
          fileId: null,
          name: "Source A",
          originalName: null,
          sourceId: "sourceA",
          status: "invalid",
          type: "workbook",
          workbookId: workbookId("019e9315-6a87-715f-9861-8654df099005"),
        },
      ]),
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
      sources: questionBlueprintDraftSourcesFromRows([
        {
          byteSize: null,
          checksumSha256: null,
          fileId: null,
          name: "Source A",
          originalName: null,
          sourceId: "sourceA",
          status: "validated",
          type: "workbook",
          workbookId: workbookId("019e9315-6a87-715f-9861-8654df099005"),
        },
      ]),
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
