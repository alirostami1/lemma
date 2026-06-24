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
  questionBlueprintVersionId,
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
    const updated = await repository.updateQuestionBlueprintDraft(draft);

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
});

function createDbSpy(row: unknown) {
  type Values = Record<string, unknown> & {
    document?: { toOperationNode: unknown };
    sources?: { toOperationNode: unknown };
  };

  const state: {
    insertValuesByTable: Record<string, Values | undefined>;
    lockedForUpdate: Record<string, boolean | undefined>;
    updateValuesByTable: Record<string, Values | undefined>;
  } = {
    insertValuesByTable: {},
    lockedForUpdate: {},
    updateValuesByTable: {},
  };

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
          return row;
        },
        values(values: Record<string, unknown>) {
          state.insertValuesByTable[table] = values as Values;
          return insertQuery;
        },
      };
      return insertQuery;
    },
    selectFrom(table: string) {
      const selectQuery = {
        executeTakeFirst() {
          if (table === "questionBlueprintVersions") {
            return Promise.resolve({ maxVersionNumber: 1 });
          }
          return Promise.resolve(row);
        },
        forUpdate() {
          state.lockedForUpdate[table] = true;
          return selectQuery;
        },
        select() {
          return selectQuery;
        },
        selectAll() {
          return selectQuery;
        },
        where() {
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
          return row;
        },
        async executeTakeFirstOrThrow() {
          return row;
        },
        returningAll() {
          return updateQuery;
        },
        set(values: Record<string, unknown>) {
          state.updateValuesByTable[table] = values as Values;
          return updateQuery;
        },
        where() {
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

function rowFromBlueprint(
  blueprint: ReturnType<typeof createQuestionBlueprint>,
) {
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

function rowFromDraft(draft: ReturnType<typeof createQuestionBlueprintDraft>) {
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
    revision: draft.revision,
    sources: draft.sources,
    status: draft.status,
    updatedAt: draft.updatedAt,
  };
}
