import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CurrentUser } from "@lemma/identity/application";
import {
  createQuestionBlueprint,
  questionBlueprintDescription,
  questionBlueprintDocument,
  questionBlueprintDraftId,
  questionBlueprintId,
  questionBlueprintName,
  questionBlueprintVersionId,
  questionBlueprintVisibility,
  userId,
} from "../domain/index.js";
import type {
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
const draftId = questionBlueprintDraftId(
  "019e9315-6a87-715f-9861-8654df099004",
);

describe("QuestionBlueprintDraftService", () => {
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
});

function createService() {
  return new QuestionBlueprintDraftService({
    clock: { now: () => at },
    draftSourceFilePort: {} as DraftSourceFilePort,
    idGenerator: {
      questionBlueprintDraftId: () => draftId,
    } as IdGenerator,
    questionsRepository: {
      async createQuestionBlueprintDraft(draft) {
        return draft;
      },
      async findQuestionBlueprintById(id) {
        if (id !== blueprintId) return null;
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
          },
          at,
        );
      },
    } as QuestionsRepository,
    workbookRegistrationPort: {} as WorkbookRegistrationPort,
  });
}

function currentUser(): CurrentUser {
  return {
    isAdmin: false,
    roles: [],
    user: { id: ownerUserId },
  } as unknown as CurrentUser;
}

function emptyDocument() {
  return questionBlueprintDocument({
    blocks: [],
    references: [],
    responseFields: [],
    schemaVersion: 1,
  });
}
