import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DatabaseExecutor } from "@lemma/db";
import {
  createQuestionBlueprint,
  createQuestionBlueprintDraft,
  questionBlueprintDescription,
  questionBlueprintDocument,
  questionBlueprintDraftId,
  questionBlueprintId,
  questionBlueprintName,
  questionBlueprintVisibility,
  userId,
} from "../domain/index.js";
import { KyselyQuestionBlueprintDraftRepository } from "./KyselyQuestionBlueprintDraftRepository.js";
import { KyselyQuestionBlueprintRepository } from "./KyselyQuestionBlueprintRepository.js";

const at = new Date("2026-06-18T00:00:00.000Z");
const ownerUserId = userId("019e9315-6a87-715f-9861-8654df074010");
const creatorUserId = userId("019e9315-6a87-715f-9861-8654df074011");

describe("KyselyQuestion persistence", () => {
  it("persists an empty blueprint sources array as jsonb", async () => {
    const blueprint = createQuestionBlueprint(
      {
        createdByUserId: creatorUserId,
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
    const insertSources = db.state.insertValues?.sources;
    if (!insertSources) throw new Error("missing inserted sources expression");
    assert.equal(typeof insertSources.toOperationNode, "function");
  });

  it("persists empty draft sources as jsonb on create and update", async () => {
    const draft = createQuestionBlueprintDraft(
      {
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
    const updated = await repository.updateQuestionBlueprintDraft(draft);

    assert.equal(created.sources.length, 0);
    assert.equal(updated?.sources.length, 0);
    const insertSources = db.state.insertValues?.sources;
    const updateSources = db.state.updateValues?.sources;
    if (!insertSources) throw new Error("missing inserted sources expression");
    if (!updateSources) throw new Error("missing updated sources expression");
    assert.equal(typeof insertSources.toOperationNode, "function");
    assert.equal(typeof updateSources.toOperationNode, "function");
  });
});

function createDbSpy(row: unknown) {
  const state: {
    insertValues?: { sources?: { toOperationNode: unknown } };
    updateValues?: { sources?: { toOperationNode: unknown } };
  } = {};

  const insertQuery = {
    returningAll() {
      return insertQuery;
    },
    async executeTakeFirstOrThrow() {
      return row;
    },
    values(values: Record<string, unknown>) {
      state.insertValues = values;
      return insertQuery;
    },
  };

  const updateQuery = {
    async executeTakeFirst() {
      return row;
    },
    returningAll() {
      return updateQuery;
    },
    set(values: Record<string, unknown>) {
      state.updateValues = values;
      return updateQuery;
    },
    where() {
      return updateQuery;
    },
  };

  return {
    state,
    insertInto() {
      return insertQuery;
    },
    updateTable() {
      return updateQuery;
    },
  } as unknown as DatabaseExecutor & {
    state: typeof state;
  };
}

function emptyDocument() {
  return questionBlueprintDocument({
    blocks: [],
    references: [],
    responseFields: [],
    schemaVersion: 1,
  });
}

function rowFromBlueprint(
  blueprint: ReturnType<typeof createQuestionBlueprint>,
) {
  return {
    archivedAt: blueprint.archivedAt,
    createdAt: blueprint.createdAt,
    createdByUserId: blueprint.createdByUserId,
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

function rowFromDraft(draft: ReturnType<typeof createQuestionBlueprintDraft>) {
  return {
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
    sources: draft.sources,
    status: draft.status,
    updatedAt: draft.updatedAt,
  };
}
