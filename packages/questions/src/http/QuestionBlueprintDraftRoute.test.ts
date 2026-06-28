import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CurrentUser } from "@lemma/identity/application";
import { Hono } from "hono";
import {
  QuestionBlueprintDraftRevisionConflictError,
  type QuestionBlueprintDraftService,
  type QuestionBlueprintService,
  type QuestionGenerationService,
  type QuestionLibraryService,
  type QuestionSetService,
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
          async discardQuestionBlueprintDraft(input: {
            expectedRevision: number;
          }) {
            if (input.expectedRevision !== 1) {
              throw new QuestionBlueprintDraftRevisionConflictError();
            }
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
    draftSourceFilePort: {} as never,
    idGenerator: {
      questionBlueprintDraftId: () => draftId,
      questionBlueprintId: () => blueprintId,
      questionBlueprintVersionId: () => versionId,
    } as never,
    questionBlueprintDraftTransaction: {
      async transaction() {
        throw new Error("not implemented in route test");
      },
    } as never,
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
    } as never,
  });
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
