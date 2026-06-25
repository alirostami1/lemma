import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CurrentUser } from "@lemma/identity/application";
import { Hono } from "hono";
import type {
  QuestionBlueprintDraftService,
  QuestionBlueprintService,
  QuestionGenerationService,
  QuestionLibraryService,
  QuestionSetService,
} from "../application/index.js";
import {
  createQuestionBlueprintDraft,
  questionBlueprintDescription,
  questionBlueprintDocument,
  questionBlueprintDraftId,
  questionBlueprintId,
  questionBlueprintName,
  questionBlueprintVersionId,
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

describe("question blueprint edit draft route", () => {
  it("accepts no request body", async () => {
    const app = createApp();

    const response = await app.request(
      `/question-blueprints/${blueprintId}/edit-draft`,
      { method: "POST" },
    );

    assert.equal(response.status, 201);
  });

  it("accepts an empty request body object", async () => {
    const app = createApp();

    const response = await app.request(
      `/question-blueprints/${blueprintId}/edit-draft`,
      {
        body: "{}",
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    assert.equal(response.status, 201);
  });

  it("accepts resume_or_create mode", async () => {
    const app = createApp();

    const response = await app.request(
      `/question-blueprints/${blueprintId}/edit-draft`,
      {
        body: JSON.stringify({ mode: "resume_or_create" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    assert.equal(response.status, 201);
  });

  it("rejects invalid JSON", async () => {
    const app = createApp();

    const response = await app.request(
      `/question-blueprints/${blueprintId}/edit-draft`,
      {
        body: "{",
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    assert.equal(response.status, 400);
  });

  it("rejects unknown request body fields", async () => {
    const app = createApp();

    const response = await app.request(
      `/question-blueprints/${blueprintId}/edit-draft`,
      {
        body: JSON.stringify({ unexpected: true }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    assert.equal(response.status, 400);
  });
});

function createApp() {
  const app = new Hono<QuestionsAppEnv>();
  app.route(
    "/",
    questionsRoutes({
      questionBlueprintDraftService: {
        async createQuestionBlueprintEditDraft() {
          return { draft: createDraft(), resolution: "created" as const };
        },
      } as unknown as QuestionBlueprintDraftService,
      questionBlueprintService: {} as unknown as QuestionBlueprintService,
      questionGenerationService: {} as unknown as QuestionGenerationService,
      questionLibraryService: {} as unknown as QuestionLibraryService,
      questionSetService: {} as unknown as QuestionSetService,
      requireIdentity: async (c, next) => {
        c.set("identity", currentUser());
        c.set("requestId", "request-1");
        await next();
      },
    }),
  );
  return app;
}

function createDraft() {
  return createQuestionBlueprintDraft(
    {
      baseVersionId: versionId,
      blueprintId,
      createdByUserId: ownerUserId,
      description: questionBlueprintDescription(null),
      document: questionBlueprintDocument({
        blocks: [],
        references: [],
        responseFields: [],
        schemaVersion: 1,
      }),
      id: draftId,
      name: questionBlueprintName("Draft"),
      ownerUserId,
      sources: [],
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
