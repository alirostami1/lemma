import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CurrentUser } from "@lemma/identity/application";
import { Hono } from "hono";
import {
  DraftSourceEditorUploadInvalidError,
  DraftSourceEditorUploadNotFoundError,
  DraftSourceEditorUploadStorageError,
  type DraftSourceFilePort,
  type IdGenerator,
  QuestionBlueprintDraftRevisionConflictError,
  type QuestionBlueprintDraftService,
  type QuestionBlueprintDraftTransactionPort,
  type QuestionBlueprintService,
  type QuestionGenerationService,
  type QuestionLibraryService,
  type QuestionSetService,
  type QuestionsRepository,
  SourceDocumentRevisionConflictError,
  WorkbookEditorOutputStaleError,
  WorkbookSourceEditInvalidatesReferencesError,
} from "../application/index.js";
import { QuestionBlueprintDraftService as RealQuestionBlueprintDraftService } from "../application/QuestionBlueprintDraftService.js";
import {
  createQuestionBlueprint,
  createQuestionBlueprintDraft,
  questionBlueprintDescription,
  questionBlueprintDocument,
  questionBlueprintDraftId,
  questionBlueprintDraftSourcesFromRows,
  questionBlueprintId,
  questionBlueprintName,
  questionBlueprintVersionId,
  questionBlueprintVisibility,
  userId,
} from "../domain/index.js";
import type { QuestionsAppEnv } from "./env.js";
import { questionsRoutes } from "./routes.js";

const ownerUserId = userId("019e9315-6a87-715f-9861-8654df099001");
const blueprintId = questionBlueprintId("019e9315-6a87-715f-9861-8654df099002");
const versionId = questionBlueprintVersionId(
  "019e9315-6a87-715f-9861-8654df099003",
);
const draftId = questionBlueprintDraftId(
  "019e9315-6a87-715f-9861-8654df099004",
);
const at = new Date("2026-06-24T00:00:00.000Z");

describe("question blueprint draft route", () => {
  it("accepts status query for listing question blueprint drafts", async () => {
    let receivedStatus: string | undefined;
    const app = createApp({
      questionBlueprintDraftService: {
        async listQuestionBlueprintDrafts(input: { status?: string }) {
          receivedStatus = input.status;
          return { drafts: [], nextCursor: null };
        },
      } as unknown as QuestionBlueprintDraftService,
    });

    const response = await app.request(
      "/question-blueprint-drafts?status=published",
    );

    assert.equal(response.status, 200);
    assert.equal(receivedStatus, "published");
  });

  it("accepts source update intent without server-owned materialization", async () => {
    const app = createApp({
      questionBlueprintDraftService: createRealQuestionBlueprintDraftService(),
    });

    const response = await app.request(
      `/question-blueprint-drafts/${draftId}`,
      {
        body: JSON.stringify(updateDraftBody({ sources: [sourcePatch()] })),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      },
    );

    assert.equal(response.status, 200);
  });

  it("rejects Python source intents before draft create or update", async () => {
    let createCalled = false;
    let updateCalled = false;
    const app = createApp({
      questionBlueprintDraftService: {
        async createQuestionBlueprintDraft() {
          createCalled = true;
          return { draft: createDraft() };
        },
        async updateQuestionBlueprintDraft() {
          updateCalled = true;
          return { draft: createDraft() };
        },
      } as unknown as QuestionBlueprintDraftService,
    });
    const sources = [
      { name: "Generator", sourceId: "generator", type: "python" },
    ];

    const createResponse = await app.request("/question-blueprint-drafts", {
      body: JSON.stringify({
        description: null,
        document: emptyDocument(),
        name: "Draft",
        sources,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    const updateResponse = await app.request(
      `/question-blueprint-drafts/${draftId}`,
      {
        body: JSON.stringify(updateDraftBody({ sources })),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      },
    );

    assert.equal(createResponse.status, 400);
    assert.equal(updateResponse.status, 400);
    assert.equal(createCalled, false);
    assert.equal(updateCalled, false);
  });

  for (const field of [
    "byteSize",
    "checksumSha256",
    "fileId",
    "originalName",
    "processor",
    "sourceArtifactId",
    "sourceDocumentId",
    "sourceRevisionId",
    "status",
    "workbookId",
  ] as const) {
    it(`rejects source update server-owned field ${field}`, async () => {
      const app = createApp();

      const response = await app.request(
        `/question-blueprint-drafts/${draftId}`,
        {
          body: JSON.stringify(
            updateDraftBody({
              sources: [{ ...sourcePatch(), [field]: serverOwnedValue(field) }],
            }),
          ),
          headers: { "content-type": "application/json" },
          method: "PATCH",
        },
      );

      assert.equal(response.status, 400);
    });
  }

  it("rejects source create server-owned materialization fields", async () => {
    const app = createApp();

    const response = await app.request("/question-blueprint-drafts", {
      body: JSON.stringify({
        description: null,
        document: emptyDocument(),
        name: "Draft",
        sources: [
          {
            ...sourcePatch(),
            byteSize: 123,
            checksumSha256:
              "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            fileId: "019e9315-6a87-715f-9861-8654df099006",
            originalName: "evil.xlsx",
            processor: { anything: true },
            sourceArtifactId: "evil",
            sourceDocumentId: "evil",
            sourceRevisionId: "evil",
            status: "validated",
            workbookId: "019e9315-6a87-715f-9861-8654df099007",
          },
        ],
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    assert.equal(response.status, 400);
  });

  it("rejects sourceId in attach source file body", async () => {
    const app = createApp();

    const response = await app.request(
      `/question-blueprint-drafts/${draftId}/sources/sourceA/file`,
      {
        body: JSON.stringify({
          expectedRevision: 1,
          fileId: "019e9315-6a87-715f-9861-8654df099006",
          sourceId: "sourceA",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    assert.equal(response.status, 400);
  });

  it("accepts intent-only workbook editor output for a new source revision", async () => {
    let received:
      | {
          editorOutputFileId: string;
          expectedRevision: number;
          sourceId: string;
        }
      | undefined;
    const app = createApp({
      questionBlueprintDraftService: {
        async saveQuestionBlueprintDraftWorkbookSourceRevision(input: {
          editorOutputFileId: string;
          expectedRevision: number;
          sourceId: string;
        }) {
          received = input;
          return savedRevisionResult();
        },
      } as unknown as QuestionBlueprintDraftService,
    });

    const response = await app.request(
      `/question-blueprint-drafts/${draftId}/sources/sourceA/revisions`,
      {
        body: JSON.stringify({
          expectedRevision: 1,
          editorOutputFileId: "019e9315-6a87-715f-9861-8654df099006",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    assert.equal(response.status, 200);
    assert.equal(received?.expectedRevision, 1);
    assert.equal(
      received?.editorOutputFileId,
      "019e9315-6a87-715f-9861-8654df099006",
    );
    assert.equal(received?.sourceId, "sourceA");
    const body = (await response.json()) as Record<string, unknown>;
    assert.deepEqual(Object.keys(body).sort(), [
      "draft",
      "sourceArtifact",
      "sourceRevision",
    ]);
  });

  it("creates workbook editor output upload for a draft source", async () => {
    let received:
      | {
          draftId: string;
          expectedRevision: number;
          originalName: string;
          sourceId: string;
        }
      | undefined;
    const app = createApp({
      questionBlueprintDraftService: {
        async createQuestionBlueprintDraftWorkbookEditorUpload(input: {
          draftId: string;
          expectedRevision: number;
          originalName: string;
          sourceId: string;
        }) {
          received = input;
          return editorUploadResult();
        },
      } as unknown as QuestionBlueprintDraftService,
    });

    const response = await app.request(
      `/question-blueprint-drafts/${draftId}/sources/sourceA/workbook-editor-uploads`,
      {
        body: JSON.stringify(editorUploadBody()),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    assert.equal(response.status, 201);
    assert.equal(received?.draftId, draftId);
    assert.equal(received?.sourceId, "sourceA");
    assert.equal(received?.expectedRevision, 1);
    const body = (await response.json()) as Record<string, unknown>;
    assert.deepEqual(Object.keys(body).sort(), ["upload", "uploadUrl"]);
    assert.equal((body.upload as { purpose?: string }).purpose, undefined);
  });

  it("rejects fractional expected revision for workbook editor upload", async () => {
    const app = createApp();

    const response = await app.request(
      `/question-blueprint-drafts/${draftId}/sources/sourceA/workbook-editor-uploads`,
      {
        body: JSON.stringify({
          ...editorUploadBody(),
          expectedRevision: 1.5,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    assert.equal(response.status, 400);
  });

  it("maps stale workbook editor upload revision to conflict", async () => {
    const app = createApp({
      questionBlueprintDraftService: {
        async createQuestionBlueprintDraftWorkbookEditorUpload() {
          throw new QuestionBlueprintDraftRevisionConflictError();
        },
      } as unknown as QuestionBlueprintDraftService,
    });

    const response = await app.request(
      `/question-blueprint-drafts/${draftId}/sources/sourceA/workbook-editor-uploads`,
      {
        body: JSON.stringify(editorUploadBody()),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    assert.equal(response.status, 409);
  });

  it("maps invalid workbook editor upload creation to a questions-owned bad request response", async () => {
    const app = createApp({
      questionBlueprintDraftService: {
        async createQuestionBlueprintDraftWorkbookEditorUpload() {
          throw new DraftSourceEditorUploadInvalidError();
        },
      } as unknown as QuestionBlueprintDraftService,
    });

    const response = await app.request(
      `/question-blueprint-drafts/${draftId}/sources/sourceA/workbook-editor-uploads`,
      {
        body: JSON.stringify(editorUploadBody()),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    assert.equal(response.status, 400);
    const body = (await response.json()) as { error: { code: string } };
    assert.equal(body.error.code, "DRAFT_SOURCE_EDITOR_UPLOAD_INVALID");
  });

  it("maps workbook editor upload creation storage failure to a questions-owned upstream response", async () => {
    const app = createApp({
      questionBlueprintDraftService: {
        async createQuestionBlueprintDraftWorkbookEditorUpload() {
          throw new DraftSourceEditorUploadStorageError();
        },
      } as unknown as QuestionBlueprintDraftService,
    });

    const response = await app.request(
      `/question-blueprint-drafts/${draftId}/sources/sourceA/workbook-editor-uploads`,
      {
        body: JSON.stringify(editorUploadBody()),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    assert.equal(response.status, 502);
    const body = (await response.json()) as { error: { code: string } };
    assert.equal(body.error.code, "DRAFT_SOURCE_EDITOR_UPLOAD_STORAGE_ERROR");
  });

  it("completes workbook editor output upload with an editor-specific response", async () => {
    let received:
      | {
          draftId: string;
          expectedRevision: number;
          sourceId: string;
          uploadId: string;
        }
      | undefined;
    const app = createApp({
      questionBlueprintDraftService: {
        async completeQuestionBlueprintDraftWorkbookEditorUpload(input: {
          draftId: string;
          expectedRevision: number;
          sourceId: string;
          uploadId: string;
        }) {
          received = input;
          return editorUploadCompletionResult();
        },
      } as unknown as QuestionBlueprintDraftService,
    });

    const response = await app.request(
      `/question-blueprint-drafts/${draftId}/sources/sourceA/workbook-editor-uploads/019e9315-6a87-715f-9861-8654df099080/completions`,
      {
        body: JSON.stringify({ expectedRevision: 1 }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    assert.equal(response.status, 201);
    assert.equal(received?.draftId, draftId);
    assert.equal(received?.sourceId, "sourceA");
    assert.equal(received?.uploadId, "019e9315-6a87-715f-9861-8654df099080");
    const body = (await response.json()) as Record<string, unknown>;
    assert.deepEqual(Object.keys(body).sort(), ["editorOutputFile"]);
    assert.equal(
      (body.editorOutputFile as { purpose?: string }).purpose,
      undefined,
    );
  });

  it("rejects fractional expected revision for workbook editor upload completion", async () => {
    const response = await createApp().request(
      `/question-blueprint-drafts/${draftId}/sources/sourceA/workbook-editor-uploads/019e9315-6a87-715f-9861-8654df099080/completions`,
      {
        body: JSON.stringify({ expectedRevision: 1.5 }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    assert.equal(response.status, 400);
  });

  it("maps stale workbook editor upload completion metadata to conflict", async () => {
    const app = createApp({
      questionBlueprintDraftService: {
        async completeQuestionBlueprintDraftWorkbookEditorUpload() {
          throw new WorkbookEditorOutputStaleError();
        },
      } as unknown as QuestionBlueprintDraftService,
    });

    const response = await app.request(
      `/question-blueprint-drafts/${draftId}/sources/sourceA/workbook-editor-uploads/019e9315-6a87-715f-9861-8654df099080/completions`,
      {
        body: JSON.stringify({ expectedRevision: 1 }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    assert.equal(response.status, 409);
    const body = (await response.json()) as { error: { code: string } };
    assert.equal(body.error.code, "WORKBOOK_EDITOR_OUTPUT_STALE");
  });

  it("maps missing workbook editor upload completion to a questions-owned not found response", async () => {
    const app = createApp({
      questionBlueprintDraftService: {
        async completeQuestionBlueprintDraftWorkbookEditorUpload() {
          throw new DraftSourceEditorUploadNotFoundError();
        },
      } as unknown as QuestionBlueprintDraftService,
    });

    const response = await app.request(
      `/question-blueprint-drafts/${draftId}/sources/sourceA/workbook-editor-uploads/019e9315-6a87-715f-9861-8654df099080/completions`,
      {
        body: JSON.stringify({ expectedRevision: 1 }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    assert.equal(response.status, 404);
    const body = (await response.json()) as { error: { code: string } };
    assert.equal(body.error.code, "DRAFT_SOURCE_EDITOR_UPLOAD_NOT_FOUND");
  });

  it("maps invalid workbook editor upload completion to a questions-owned bad request response", async () => {
    const app = createApp({
      questionBlueprintDraftService: {
        async completeQuestionBlueprintDraftWorkbookEditorUpload() {
          throw new DraftSourceEditorUploadInvalidError();
        },
      } as unknown as QuestionBlueprintDraftService,
    });

    const response = await app.request(
      `/question-blueprint-drafts/${draftId}/sources/sourceA/workbook-editor-uploads/019e9315-6a87-715f-9861-8654df099080/completions`,
      {
        body: JSON.stringify({ expectedRevision: 1 }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    assert.equal(response.status, 400);
    const body = (await response.json()) as { error: { code: string } };
    assert.equal(body.error.code, "DRAFT_SOURCE_EDITOR_UPLOAD_INVALID");
  });

  it("maps workbook editor upload completion storage failure to a questions-owned upstream response", async () => {
    const app = createApp({
      questionBlueprintDraftService: {
        async completeQuestionBlueprintDraftWorkbookEditorUpload() {
          throw new DraftSourceEditorUploadStorageError();
        },
      } as unknown as QuestionBlueprintDraftService,
    });

    const response = await app.request(
      `/question-blueprint-drafts/${draftId}/sources/sourceA/workbook-editor-uploads/019e9315-6a87-715f-9861-8654df099080/completions`,
      {
        body: JSON.stringify({ expectedRevision: 1 }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    assert.equal(response.status, 502);
    const body = (await response.json()) as { error: { code: string } };
    assert.equal(body.error.code, "DRAFT_SOURCE_EDITOR_UPLOAD_STORAGE_ERROR");
  });

  it("maps stale workbook editor save metadata to conflict", async () => {
    const app = createApp({
      questionBlueprintDraftService: {
        async saveQuestionBlueprintDraftWorkbookSourceRevision() {
          throw new WorkbookEditorOutputStaleError();
        },
      } as unknown as QuestionBlueprintDraftService,
    });

    const response = await app.request(
      `/question-blueprint-drafts/${draftId}/sources/sourceA/revisions`,
      {
        body: JSON.stringify({
          expectedRevision: 1,
          editorOutputFileId: "019e9315-6a87-715f-9861-8654df099006",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    assert.equal(response.status, 409);
    const body = (await response.json()) as { error: { code: string } };
    assert.equal(body.error.code, "WORKBOOK_EDITOR_OUTPUT_STALE");
  });

  it("maps reference-breaking workbook editor save to conflict with user-facing details", async () => {
    const app = createApp({
      questionBlueprintDraftService: {
        async saveQuestionBlueprintDraftWorkbookSourceRevision() {
          throw new WorkbookSourceEditInvalidatesReferencesError([
            {
              label: "Inserted value from Sheet1 A1",
              problem: "The referenced cell is no longer available.",
            },
          ]);
        },
      } as unknown as QuestionBlueprintDraftService,
    });

    const response = await app.request(
      `/question-blueprint-drafts/${draftId}/sources/sourceA/revisions`,
      {
        body: JSON.stringify({
          expectedRevision: 1,
          editorOutputFileId: "019e9315-6a87-715f-9861-8654df099006",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    assert.equal(response.status, 409);
    const body = (await response.json()) as {
      error: { code: string; details: unknown };
    };
    assert.equal(
      body.error.code,
      "WORKBOOK_SOURCE_EDIT_INVALIDATES_REFERENCES",
    );
    assert.deepEqual(body.error.details, {
      affectedInsertedValues: [
        {
          label: "Inserted value from Sheet1 A1",
          problem: "The referenced cell is no longer available.",
        },
      ],
      recoveryAction:
        "Remove or replace the affected inserted values before saving this workbook.",
      summary: "Some inserted values need attention.",
    });
    const details = JSON.stringify(body.error.details);
    assert.equal(details.includes("sourceA"), false);
    assert.equal(details.includes("workbook:"), false);
  });

  it("maps reference-breaking source attach to conflict with typed recovery details", async () => {
    const app = createApp({
      questionBlueprintDraftService: {
        async attachQuestionBlueprintDraftSourceFile() {
          throw new WorkbookSourceEditInvalidatesReferencesError([
            {
              label: "Revenue total",
              problem: "The referenced cell is no longer available.",
            },
          ]);
        },
      } as unknown as QuestionBlueprintDraftService,
    });

    const response = await app.request(
      `/question-blueprint-drafts/${draftId}/sources/sourceA/file`,
      {
        body: JSON.stringify({
          expectedRevision: 1,
          fileId: "019e9315-6a87-715f-9861-8654df099006",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    assert.equal(response.status, 409);
    const body = (await response.json()) as {
      error: { code: string; details: unknown };
    };
    assert.equal(
      body.error.code,
      "WORKBOOK_SOURCE_EDIT_INVALIDATES_REFERENCES",
    );
    assert.deepEqual(body.error.details, {
      affectedInsertedValues: [
        {
          label: "Revenue total",
          problem: "The referenced cell is no longer available.",
        },
      ],
      recoveryAction:
        "Remove or replace the affected inserted values before saving this workbook.",
      summary: "Some inserted values need attention.",
    });
    const details = JSON.stringify(body.error.details);
    assert.equal(details.includes("sourceA"), false);
    assert.equal(details.includes("workbook:"), false);
  });

  it("maps invalid workbook editor save metadata to a questions-owned bad request response", async () => {
    const app = createApp({
      questionBlueprintDraftService: {
        async saveQuestionBlueprintDraftWorkbookSourceRevision() {
          throw new DraftSourceEditorUploadInvalidError();
        },
      } as unknown as QuestionBlueprintDraftService,
    });

    const response = await app.request(
      `/question-blueprint-drafts/${draftId}/sources/sourceA/revisions`,
      {
        body: JSON.stringify({
          expectedRevision: 1,
          editorOutputFileId: "019e9315-6a87-715f-9861-8654df099006",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    assert.equal(response.status, 400);
    const body = (await response.json()) as { error: { code: string } };
    assert.equal(body.error.code, "DRAFT_SOURCE_EDITOR_UPLOAD_INVALID");
  });

  it("rejects server-owned materialization in workbook revision body", async () => {
    const app = createApp();

    const response = await app.request(
      `/question-blueprint-drafts/${draftId}/sources/sourceA/revisions`,
      {
        body: JSON.stringify({
          expectedRevision: 1,
          editorOutputFileId: "019e9315-6a87-715f-9861-8654df099006",
          sourceArtifactId: "019e9315-6a87-715f-9861-8654df099012",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    assert.equal(response.status, 400);
  });

  it("rejects fractional expected revision for workbook revision save", async () => {
    const response = await createApp().request(
      `/question-blueprint-drafts/${draftId}/sources/sourceA/revisions`,
      {
        body: JSON.stringify({
          editorOutputFileId: "019e9315-6a87-715f-9861-8654df099006",
          expectedRevision: 1.5,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    assert.equal(response.status, 400);
  });

  it("rejects missing workbook revision save body", async () => {
    const response = await createApp().request(
      `/question-blueprint-drafts/${draftId}/sources/sourceA/revisions`,
      {
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    assert.equal(response.status, 400);
  });

  it("rejects fractional expected revision for existing source attach", async () => {
    const response = await createApp().request(
      `/question-blueprint-drafts/${draftId}/sources/sourceA/file`,
      {
        body: JSON.stringify({
          expectedRevision: 1.5,
          fileId: "019e9315-6a87-715f-9861-8654df099006",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    assert.equal(response.status, 400);
  });

  it("maps stale source document head on workbook revision save to conflict", async () => {
    const app = createApp({
      questionBlueprintDraftService: {
        async saveQuestionBlueprintDraftWorkbookSourceRevision() {
          throw new SourceDocumentRevisionConflictError();
        },
      } as unknown as QuestionBlueprintDraftService,
    });

    const response = await app.request(
      `/question-blueprint-drafts/${draftId}/sources/sourceA/revisions`,
      {
        body: JSON.stringify({
          expectedRevision: 1,
          editorOutputFileId: "019e9315-6a87-715f-9861-8654df099006",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    assert.equal(response.status, 409);
    const body = (await response.json()) as { error: { code: string } };
    assert.equal(body.error.code, "SOURCE_DOCUMENT_REVISION_CONFLICT");
  });

  it("does not register direct published blueprint create/update routes", async () => {
    const app = createApp();

    const createResponse = await app.request("/question-blueprints", {
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    const updateResponse = await app.request(
      `/question-blueprints/${blueprintId}`,
      {
        body: JSON.stringify({}),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      },
    );

    assert.equal(createResponse.status, 404);
    assert.equal(updateResponse.status, 404);
  });

  it("maps stale source file attach revision to DRAFT_REVISION_CONFLICT", async () => {
    const app = createApp();

    const response = await app.request(
      `/question-blueprint-drafts/${draftId}/sources/sourceA/file`,
      {
        body: JSON.stringify({
          expectedRevision: 2,
          fileId: "019e9315-6a87-715f-9861-8654df099006",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    assert.equal(response.status, 409);
    const body = (await response.json()) as { error: { code: string } };
    assert.equal(body.error.code, "DRAFT_REVISION_CONFLICT");
  });

  it("discards draft with expected revision", async () => {
    const app = createApp();

    const response = await app.request(
      `/question-blueprint-drafts/${draftId}/discard`,
      {
        body: JSON.stringify({ expectedRevision: 1 }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    assert.equal(response.status, 204);
  });

  it("rejects discard without expected revision body", async () => {
    const app = createApp();

    const response = await app.request(
      `/question-blueprint-drafts/${draftId}/discard`,
      {
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    assert.equal(response.status, 400);
  });

  it("maps stale discard revision to DRAFT_REVISION_CONFLICT", async () => {
    const app = createApp();

    const response = await app.request(
      `/question-blueprint-drafts/${draftId}/discard`,
      {
        body: JSON.stringify({ expectedRevision: 2 }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    assert.equal(response.status, 409);
    const body = (await response.json()) as { error: { code: string } };
    assert.equal(body.error.code, "DRAFT_REVISION_CONFLICT");
  });
});

function createApp(
  options: {
    questionBlueprintDraftService?: QuestionBlueprintDraftService;
  } = {},
) {
  const app = new Hono<QuestionsAppEnv>();
  app.route(
    "/",
    questionsRoutes({
      questionBlueprintDraftService:
        options.questionBlueprintDraftService ??
        ({
          async createQuestionBlueprintDraft() {
            return { draft: createDraft() };
          },
          async listQuestionBlueprintDrafts() {
            return { drafts: [], nextCursor: null };
          },
          async attachQuestionBlueprintDraftSourceFile(input: {
            expectedRevision: number;
          }) {
            if (input.expectedRevision !== 1) {
              throw new QuestionBlueprintDraftRevisionConflictError();
            }
            return { draft: createDraft() };
          },
          async createQuestionBlueprintDraftWorkbookEditorUpload() {
            return editorUploadResult();
          },
          async completeQuestionBlueprintDraftWorkbookEditorUpload() {
            return editorUploadCompletionResult();
          },
          async discardQuestionBlueprintDraft(input: {
            expectedRevision: number;
          }) {
            if (input.expectedRevision !== 1) {
              throw new QuestionBlueprintDraftRevisionConflictError();
            }
          },
          async saveQuestionBlueprintDraftWorkbookSourceRevision() {
            return savedRevisionResult();
          },
          async updateQuestionBlueprintDraft() {
            return { draft: createDraft() };
          },
        } as unknown as QuestionBlueprintDraftService),
      questionBlueprintService: {} as unknown as QuestionBlueprintService,
      questionGenerationService: {} as unknown as QuestionGenerationService,
      questionLibraryService: {} as unknown as QuestionLibraryService,
      questionSetService: {} as unknown as QuestionSetService,
      requireIdentity: async (c, next) => {
        c.set("identity", currentUser());
        c.set("requestId", "019e9315-6a87-715f-9861-8654df099099");
        await next();
      },
    }),
  );
  return app;
}

function createRealQuestionBlueprintDraftService() {
  let draft = createDraft();
  return new RealQuestionBlueprintDraftService({
    clock: { now: () => at },
    draftSourceFilePort: unusedDraftSourceFilePort(),
    draftSourceWorkbookInspectionPort: {
      inspectWorkbookSourceFile: async () => {
        throw new Error("unused in route draft update validation");
      },
    },
    idGenerator: routeTestIdGenerator(),
    questionBlueprintDraftTransaction: unusedDraftTransaction(),
    // This route test exercises only draft update validation; the real service
    // calls only these repository methods on that path.
    questionsRepository: {
      async findQuestionBlueprintDraftById() {
        return draft;
      },
      async findQuestionBlueprintById() {
        return createBlueprint();
      },
      async updateQuestionBlueprintDraftWithExpectedRevision(input: {
        draft: typeof draft;
        expectedRevision: number;
      }) {
        if (draft.revision !== input.expectedRevision) return null;
        draft = input.draft;
        return draft;
      },
    } as Pick<
      QuestionsRepository,
      | "findQuestionBlueprintDraftById"
      | "findQuestionBlueprintById"
      | "updateQuestionBlueprintDraftWithExpectedRevision"
    > as QuestionsRepository,
  });
}

function unusedDraftSourceFilePort(): DraftSourceFilePort {
  return {
    async createEditorOutputUpload() {
      throw new Error("unused in route test");
    },
    async completeEditorOutputUpload() {
      throw new Error("unused in route test");
    },
    async getFileMetadata() {
      throw new Error("unused in route test");
    },
    async getUploadMetadata() {
      throw new Error("unused in route test");
    },
  };
}

function unusedDraftTransaction(): QuestionBlueprintDraftTransactionPort {
  return {
    async transaction() {
      throw new Error("unused in route test");
    },
  };
}

function routeTestIdGenerator(): IdGenerator {
  const unused = () => {
    throw new Error("unused in route test");
  };
  return {
    eventId: unused,
    questionBlueprintDraftId: () => draftId,
    questionBlueprintId: () => blueprintId,
    questionBlueprintVersionId: () => versionId,
    questionGenerationRunId: unused,
    questionId: unused,
    questionSetId: unused,
    sourceArtifactId: unused,
    sourceDocumentId: unused,
    sourceRevisionId: unused,
  };
}

function updateDraftBody(patch: { sources: unknown[] }) {
  return {
    description: null,
    document: emptyDocument(),
    expectedRevision: 1,
    name: "Draft",
    sources: patch.sources,
  };
}

function editorUploadBody() {
  return {
    byteSize: 1234,
    checksumSha256:
      "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    expectedRevision: 1,
    originalName: "source.xlsx",
  };
}

function editorUploadResult() {
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
      status: "initiated",
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

function editorUploadCompletionResult() {
  return {
    editorOutputFile: {
      byteSize: 1234,
      checksumSha256:
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      id: "019e9315-6a87-715f-9861-8654df099006",
      originalName: "source.xlsx",
    },
  };
}

function sourcePatch() {
  return { name: "Source A", sourceId: "sourceA", type: "workbook" };
}

function serverOwnedValue(field: string) {
  if (field === "byteSize") return 1234;
  if (field === "status") return "uploaded";
  if (field === "processor") return { anything: true };
  if (
    field === "sourceArtifactId" ||
    field === "sourceDocumentId" ||
    field === "sourceRevisionId"
  ) {
    return "evil";
  }
  if (field === "checksumSha256") {
    return "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  }
  if (field === "originalName") return "source.xlsx";
  return "019e9315-6a87-715f-9861-8654df099006";
}

function createDraft() {
  return createQuestionBlueprintDraft(
    {
      baseVersionId: versionId,
      blueprintId,
      createdByUserId: ownerUserId,
      description: questionBlueprintDescription(null),
      document: questionBlueprintDocument(emptyDocument()),
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

function savedRevisionResult() {
  return {
    draft: createDraft(),
    sourceArtifact: {
      artifactMetadata: {},
      createdAt: at,
      id: "019e9315-6a87-715f-9861-8654df099012",
      kind: "workbook" as const,
      ownerUserId,
      processor: "lemma-workbook",
      processorVersion: "1",
      sourceRevisionId: "019e9315-6a87-715f-9861-8654df099011",
      status: "pending_validation" as const,
      updatedAt: at,
      validationError: null,
      workbookId: "019e9315-6a87-715f-9861-8654df099005",
    },
    sourceRevision: {
      byteSize: 1234,
      checksumSha256:
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      createdAt: at,
      createdByUserId: ownerUserId,
      editorMetadata: { origin: "workbook_editor" },
      fileId: "019e9315-6a87-715f-9861-8654df099006",
      id: "019e9315-6a87-715f-9861-8654df099011",
      kind: "workbook" as const,
      ownerUserId,
      parentRevisionId: "019e9315-6a87-715f-9861-8654df099010",
      sourceDocumentId: "019e9315-6a87-715f-9861-8654df099010",
    },
  };
}

function createBlueprint() {
  return createQuestionBlueprint(
    {
      createdByUserId: ownerUserId,
      currentVersionId: versionId,
      description: questionBlueprintDescription(null),
      document: questionBlueprintDocument(emptyDocument()),
      id: blueprintId,
      name: questionBlueprintName("Blueprint"),
      ownerUserId,
      sources: [],
      visibility: questionBlueprintVisibility("private"),
    },
    at,
  );
}

function emptyDocument() {
  return {
    blocks: [],
    references: [],
    responseFields: [],
    schemaVersion: 1,
  };
}

function currentUser(): CurrentUser {
  return {
    isAdmin: false,
    roles: [],
    user: { id: ownerUserId },
  } as unknown as CurrentUser;
}
