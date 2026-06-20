import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { eventId as toEventId } from "@lemma/events/domain";
import { createCurrentUser } from "@lemma/identity/application";
import { createUser } from "@lemma/identity/domain";
import {
  createQuestionSet,
  InvalidQuestionFieldError,
  type Question,
  type QuestionBlueprint,
  type QuestionBlueprintVersion,
  type QuestionBlueprintVersionAsset,
  type QuestionGenerationRun,
  type QuestionSet,
  type QuestionSetQuestion,
  questionBlueprintId,
  questionBlueprintVersionId,
  questionSetDescription,
  questionSetId,
  questionSetName,
  userId,
  workbookId,
} from "../domain/index.js";
import { ForbiddenQuestionActionError } from "./errors.js";
import type { Clock, IdGenerator, QuestionsRepository } from "./ports.js";
import { QuestionBlueprintService } from "./QuestionBlueprintService.js";
import { QuestionSetService } from "./QuestionSetService.js";

const at = new Date("2026-06-15T00:00:00.000Z");
const ownerUserId = userId("019e9315-6a87-715f-9861-8654df074001");
const otherUserId = userId("019e9315-6a87-715f-9861-8654df074002");
const targetQuestionSetId = questionSetId(
  "019e9315-6a87-715f-9861-8654df074003",
);
const nextQuestionSetId = questionSetId("019e9315-6a87-715f-9861-8654df074004");
const nextBlueprintId = questionBlueprintId(
  "019e9315-6a87-715f-9861-8654df074005",
);
const nextBlueprintVersionId = questionBlueprintVersionId(
  "019e9315-6a87-715f-9861-8654df074006",
);
const sourceWorkbookId = workbookId("019e9315-6a87-715f-9861-8654df074007");
const otherWorkbookId = workbookId("019e9315-6a87-715f-9861-8654df074008");
const updatedBlueprintVersionId = questionBlueprintVersionId(
  "019e9315-6a87-715f-9861-8654df074009",
);

describe("QuestionSetService", () => {
  it("updates owned sets and rejects other users", async () => {
    const repository = new FakeQuestionsRepository();
    repository.questionSets.set(targetQuestionSetId, createTargetSet());
    const service = new QuestionSetService({
      questionsRepository: repository,
      idGenerator,
      clock,
    });

    const updated = await service.updateQuestionSet({
      currentUser: currentUser(ownerUserId),
      questionSetId: targetQuestionSetId,
      patch: { name: "Renamed" },
    });

    assert.equal(updated.questionSet.name, "Renamed");
    await assert.rejects(
      () =>
        service.updateQuestionSet({
          currentUser: currentUser(otherUserId),
          questionSetId: targetQuestionSetId,
          patch: { name: "Blocked" },
        }),
      ForbiddenQuestionActionError,
    );
  });
});

describe("QuestionBlueprintService", () => {
  it("does not save an unused workbook as a source asset", async () => {
    const repository = new FakeQuestionsRepository();
    const service = new QuestionBlueprintService({
      questionsRepository: repository,
      idGenerator,
      clock,
    });

    const result = await service.createQuestionBlueprint({
      currentUser: currentUser(ownerUserId),
      name: "Practice",
      document: emptyBlueprintDocument,
      workbookSources: [],
    });

    assert.equal(result.questionBlueprint.id, nextBlueprintId);
    assert.equal(
      result.questionBlueprint.currentVersion.id,
      nextBlueprintVersionId,
    );
    assert.equal(repository.questionBlueprintVersions.size, 1);
    assert.deepEqual(
      repository.questionBlueprintVersionAssets.get(nextBlueprintVersionId),
      [],
    );
  });

  it("saves source assets only for attached workbooks used by the document", async () => {
    const repository = new FakeQuestionsRepository();
    const service = new QuestionBlueprintService({
      questionsRepository: repository,
      idGenerator,
      clock,
    });

    const result = await service.createQuestionBlueprint({
      currentUser: currentUser(ownerUserId),
      name: "Practice",
      document: workbookBlueprintDocument("source_1"),
      workbookSources: [
        { sourceId: "source_1", name: "Used", workbookId: sourceWorkbookId },
        { sourceId: "source_2", name: "Unused", workbookId: otherWorkbookId },
      ],
    });

    assert.deepEqual(result.questionBlueprint.workbookSources, [
      { sourceId: "source_1", name: "Used", workbookId: sourceWorkbookId },
    ]);
    assert.deepEqual(result.questionBlueprint.currentVersion.sourceAssets, [
      {
        questionBlueprintVersionId: nextBlueprintVersionId,
        workbookId: sourceWorkbookId,
        kind: "workbook",
        position: 0,
        createdAt: at,
      },
    ]);
    assert.deepEqual(
      repository.questionBlueprintVersionAssets.get(nextBlueprintVersionId),
      result.questionBlueprint.currentVersion.sourceAssets,
    );
  });

  it("rejects create without explicit workbookSources", async () => {
    const repository = new FakeQuestionsRepository();
    const service = new QuestionBlueprintService({
      questionsRepository: repository,
      idGenerator,
      clock,
    });

    await assert.rejects(
      () =>
        service.createQuestionBlueprint({
          currentUser: currentUser(ownerUserId),
          name: "Practice",
          document: workbookBlueprintDocument("source_1"),
        } as never),
      (error: unknown) => {
        return (
          error instanceof InvalidQuestionFieldError &&
          /workbookSources/.test(error.message)
        );
      },
    );
  });

  it("updates source assets only for attached workbooks used by the new document", async () => {
    const repository = new FakeQuestionsRepository();
    const versionIds = [nextBlueprintVersionId, updatedBlueprintVersionId];
    const service = new QuestionBlueprintService({
      questionsRepository: repository,
      idGenerator: {
        ...idGenerator,
        questionBlueprintVersionId: () => {
          const id = versionIds.shift();
          if (!id) {
            throw new Error("Unexpected blueprint version id request.");
          }
          return id;
        },
      },
      clock,
    });
    await service.createQuestionBlueprint({
      currentUser: currentUser(ownerUserId),
      name: "Practice",
      document: workbookBlueprintDocument("source_1"),
      workbookSources: [
        { sourceId: "source_1", name: "First", workbookId: sourceWorkbookId },
        { sourceId: "source_2", name: "Second", workbookId: otherWorkbookId },
      ],
    });

    const result = await service.updateQuestionBlueprint({
      currentUser: currentUser(ownerUserId),
      questionBlueprintId: nextBlueprintId,
      patch: {
        document: workbookBlueprintDocument("source_2"),
        workbookSources: [
          { sourceId: "source_1", name: "First", workbookId: sourceWorkbookId },
          { sourceId: "source_2", name: "Second", workbookId: otherWorkbookId },
        ],
      },
    });

    assert.deepEqual(result.questionBlueprint.workbookSources, [
      { sourceId: "source_2", name: "Second", workbookId: otherWorkbookId },
    ]);
    assert.deepEqual(
      repository.questionBlueprintVersionAssets.get(updatedBlueprintVersionId),
      [
        {
          questionBlueprintVersionId: updatedBlueprintVersionId,
          workbookId: otherWorkbookId,
          kind: "workbook",
          position: 0,
          createdAt: at,
        },
      ],
    );
  });

  it("rejects document update without explicit workbookSources", async () => {
    const repository = new FakeQuestionsRepository();
    const versionIds = [nextBlueprintVersionId, updatedBlueprintVersionId];
    const service = new QuestionBlueprintService({
      questionsRepository: repository,
      idGenerator: {
        ...idGenerator,
        questionBlueprintVersionId: () => {
          const id = versionIds.shift();
          if (!id) {
            throw new Error("Unexpected blueprint version id request.");
          }
          return id;
        },
      },
      clock,
    });

    await service.createQuestionBlueprint({
      currentUser: currentUser(ownerUserId),
      name: "Practice",
      document: workbookBlueprintDocument("source_1"),
      workbookSources: [
        { sourceId: "source_1", name: "First", workbookId: sourceWorkbookId },
      ],
    });

    await assert.rejects(
      () =>
        service.updateQuestionBlueprint({
          currentUser: currentUser(ownerUserId),
          questionBlueprintId: nextBlueprintId,
          patch: {
            document: workbookBlueprintDocument("source_1"),
          },
        }),
      (error: unknown) => {
        return (
          error instanceof InvalidQuestionFieldError &&
          /workbookSources/.test(error.message)
        );
      },
    );
  });
});

const clock: Clock = {
  now: () => at,
};

const idGenerator: IdGenerator = {
  questionSetId: () => nextQuestionSetId,
  questionBlueprintId: () => nextBlueprintId,
  questionBlueprintVersionId: () => nextBlueprintVersionId,
  questionId: () => {
    throw new Error("Not implemented.");
  },
  questionGenerationRunId: () => {
    throw new Error("Not implemented.");
  },
  eventId: () => toEventId("019e9315-6a87-715f-9861-8654df074007"),
};

const emptyBlueprintDocument = {
  schemaVersion: 1,
  blocks: [],
  responseFields: [],
  references: [],
};

function workbookBlueprintDocument(sourceId: string) {
  return {
    schemaVersion: 1,
    blocks: [],
    responseFields: [],
    references: [
      {
        id: "revenue",
        source: {
          schemaVersion: 1,
          type: "workbook_cell",
          sourceId,
          ref: "Sheet1!A1",
        },
      },
    ],
  };
}

function createTargetSet() {
  return createQuestionSet(
    {
      id: targetQuestionSetId,
      ownerUserId,
      createdByUserId: ownerUserId,
      name: questionSetName("Original"),
      description: questionSetDescription(null),
    },
    at,
  );
}

function currentUser(id: typeof ownerUserId | typeof otherUserId) {
  return createCurrentUser({
    user: createUser(
      {
        id,
        identityId: `oidc:${id}`,
        email: `${id}@example.com`,
        displayName: "Questions User",
      },
      at,
    ),
    roles: [],
    at,
  });
}

class FakeQuestionsRepository implements QuestionsRepository {
  readonly questionSets = new Map<string, QuestionSet>();
  readonly questionBlueprints = new Map<string, QuestionBlueprint>();
  readonly questionBlueprintVersions = new Map<
    string,
    QuestionBlueprintVersion
  >();
  readonly questionBlueprintVersionAssets = new Map<
    string,
    QuestionBlueprintVersionAsset[]
  >();

  async findQuestionSetById(id: QuestionSet["id"]) {
    return this.questionSets.get(id) ?? null;
  }

  async listQuestionSetsByOwnerUserId() {
    return [...this.questionSets.values()];
  }

  async createQuestionSet(set: QuestionSet) {
    this.questionSets.set(set.id, set);
    return set;
  }

  async updateQuestionSet(set: QuestionSet) {
    this.questionSets.set(set.id, set);
    return set;
  }

  async removeQuestionFromSet() {}

  async listQuestionsBySetId() {
    return [];
  }

  async findQuestionBlueprintById(id: QuestionBlueprint["id"]) {
    return this.questionBlueprints.get(id) ?? null;
  }

  async findQuestionBlueprintVersionById(id: QuestionBlueprintVersion["id"]) {
    return this.questionBlueprintVersions.get(id) ?? null;
  }

  async findCurrentQuestionBlueprintVersion(
    blueprintId: QuestionBlueprint["id"],
  ) {
    return (
      [...this.questionBlueprintVersions.values()].find(
        (version) => version.questionBlueprintId === blueprintId,
      ) ?? null
    );
  }

  async listQuestionBlueprintVersions() {
    return [...this.questionBlueprintVersions.values()];
  }

  async listQuestionBlueprintVersionAssets(input: {
    blueprintVersionId: QuestionBlueprintVersion["id"];
  }) {
    return (
      this.questionBlueprintVersionAssets.get(input.blueprintVersionId) ?? []
    );
  }

  async listQuestionBlueprintVersionAssetsByVersionIds(input: {
    blueprintVersionIds: readonly QuestionBlueprintVersion["id"][];
  }) {
    return input.blueprintVersionIds.flatMap(
      (id) => this.questionBlueprintVersionAssets.get(id) ?? [],
    );
  }

  async listQuestionBlueprintsByOwnerUserId() {
    return [...this.questionBlueprints.values()];
  }

  async createQuestionBlueprint(blueprint: QuestionBlueprint) {
    this.questionBlueprints.set(blueprint.id, blueprint);
    return blueprint;
  }

  async createQuestionBlueprintVersion(version: QuestionBlueprintVersion) {
    this.questionBlueprintVersions.set(version.id, version);
    return version;
  }

  async createQuestionBlueprintWithVersion(input: {
    blueprint: QuestionBlueprint;
    version: QuestionBlueprintVersion;
    assets: readonly QuestionBlueprintVersionAsset[];
  }) {
    const blueprint = {
      ...input.blueprint,
      currentVersionId: input.version.id,
    };
    this.questionBlueprints.set(blueprint.id, blueprint);
    this.questionBlueprintVersions.set(input.version.id, input.version);
    this.questionBlueprintVersionAssets.set(input.version.id, [
      ...input.assets,
    ]);
    return blueprint;
  }

  async updateQuestionBlueprint(blueprint: QuestionBlueprint) {
    this.questionBlueprints.set(blueprint.id, blueprint);
    return blueprint;
  }

  async updateQuestionBlueprintCurrentVersion(): Promise<QuestionBlueprint | null> {
    throw new Error("Not implemented.");
  }

  async updateQuestionBlueprintWithNewVersion(input: {
    blueprint: QuestionBlueprint;
    version: QuestionBlueprintVersion;
    assets: readonly QuestionBlueprintVersionAsset[];
  }): Promise<QuestionBlueprint | null> {
    this.questionBlueprints.set(input.blueprint.id, input.blueprint);
    this.questionBlueprintVersions.set(input.version.id, input.version);
    this.questionBlueprintVersionAssets.set(input.version.id, [
      ...input.assets,
    ]);
    return input.blueprint;
  }

  async findQuestionById() {
    return null;
  }

  async listQuestionsByOwnerUserId(): Promise<Question[]> {
    return [];
  }

  async deleteQuestion() {
    return null;
  }

  async findQuestionGenerationRunById() {
    return null;
  }

  async findQuestionGenerationRunByWorkbookCalculationId() {
    return null;
  }

  async listQuestionGenerationRunsByOwnerUserId(): Promise<
    QuestionGenerationRun[]
  > {
    return [];
  }

  async createQuestionGenerationRun(run: QuestionGenerationRun) {
    return run;
  }

  async updateQuestionGenerationRun(run: QuestionGenerationRun) {
    return run;
  }

  async completeQuestionGenerationRun(input: {
    run: QuestionGenerationRun;
    questions: readonly Question[];
    memberships: readonly QuestionSetQuestion[];
  }) {
    return input.run;
  }
}
