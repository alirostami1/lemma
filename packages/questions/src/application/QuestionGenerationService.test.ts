import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rootOperationLineage } from "@lemma/domain";
import type { OutboxRepository } from "@lemma/events/application";
import { eventId } from "@lemma/events/domain";
import { displayName, emailAddress, identityId } from "@lemma/identity/domain";
import {
  createQuestionBlueprint,
  createQuestionBlueprintVersion,
  createQuestionSet,
  markQuestionGenerationRunFailed,
  type QuestionBlueprint,
  type QuestionBlueprintVersion,
  type QuestionGenerationRun,
  type QuestionSet,
  questionBlueprintDescription,
  questionBlueprintDocument,
  questionBlueprintDraftId,
  questionBlueprintId,
  questionBlueprintName,
  questionBlueprintVersionId,
  questionBlueprintVersionNumber,
  questionBlueprintVisibility,
  questionGenerationRunId,
  questionId,
  questionSetDescription,
  questionSetId,
  questionSetName,
  sourceArtifactId,
  sourceDocumentId,
  sourceRevisionId,
  userId,
  workbookId,
} from "../domain/index.js";
import {
  InvalidQuestionBlueprintError,
  QuestionBlueprintNotFoundError,
} from "./errors.js";
import type {
  Clock,
  IdGenerator,
  QuestionGenerationTransactionPort,
  QuestionsRepository,
  WorkbookAccessPort,
} from "./ports.js";
import { QuestionGenerationService } from "./QuestionGenerationService.js";

const at = new Date("2026-06-21T00:00:00.000Z");
const ownerUserId = userId("019e9315-6a87-715f-9861-8654df076001");
const blueprintId = questionBlueprintId("019e9315-6a87-715f-9861-8654df076002");
const otherBlueprintId = questionBlueprintId(
  "019e9315-6a87-715f-9861-8654df076017",
);
const v1Id = questionBlueprintVersionId("019e9315-6a87-715f-9861-8654df076003");
const v2Id = questionBlueprintVersionId("019e9315-6a87-715f-9861-8654df076004");
const setId = questionSetId("019e9315-6a87-715f-9861-8654df076005");
const runId = questionGenerationRunId("019e9315-6a87-715f-9861-8654df076006");
const retryRunId = questionGenerationRunId(
  "019e9315-6a87-715f-9861-8654df076007",
);
const testSourceDocumentId = sourceDocumentId(
  "019e9315-6a87-715f-9861-8654df076018",
);
const testSourceRevisionId = sourceRevisionId(
  "019e9315-6a87-715f-9861-8654df076019",
);
const testSourceArtifactId = sourceArtifactId(
  "019e9315-6a87-715f-9861-8654df076020",
);

const currentUser = {
  isAdmin: false,
  roles: [],
  user: {
    createdAt: at,
    displayName: displayName("Generator"),
    email: emailAddress("generator@example.com"),
    id: ownerUserId,
    identityId: identityId("oidc:generator"),
    status: "active",
    updatedAt: at,
  },
} as const;

describe("QuestionGenerationService", () => {
  it("pins current published blueprint version when creating a run", async () => {
    const fixture = createFixture();
    const result = await fixture.service.createQuestionGenerationRun({
      blueprintId,
      count: 2,
      currentUser,
      limit: 20,
      lineage: rootOperationLineage("019e9315-6a87-715f-9861-8654df076008"),
      targetQuestionSetId: setId,
    });

    assert.equal(result.questionGenerationRun.blueprintId, blueprintId);
    assert.equal(result.questionGenerationRun.blueprintVersionId, v1Id);
    assert.equal(result.questionGenerationRun.blueprintSnapshot.name, "v1");
    assert.equal(
      result.questionGenerationRun.blueprintSnapshot.blueprintVersionId,
      v1Id,
    );
  });

  it("keeps old run snapshot and retry pinned to v1 after blueprint publishes v2", async () => {
    const fixture = createFixture();
    const created = await fixture.service.createQuestionGenerationRun({
      blueprintId,
      count: 1,
      currentUser,
      limit: 20,
      lineage: rootOperationLineage("019e9315-6a87-715f-9861-8654df076009"),
      targetQuestionSetId: setId,
    });
    fixture.blueprint.currentVersionId = v2Id;
    fixture.blueprint.name = questionBlueprintName("v2");
    fixture.runs.set(
      created.questionGenerationRun.id,
      markQuestionGenerationRunFailed(
        created.questionGenerationRun,
        "fail",
        at,
      ),
    );

    const retry = await fixture.service.retryQuestionGenerationRun({
      currentUser,
      limit: 20,
      lineage: rootOperationLineage("019e9315-6a87-715f-9861-8654df076010"),
      questionGenerationRunId: created.questionGenerationRun.id,
    });

    assert.equal(created.questionGenerationRun.blueprintVersionId, v1Id);
    assert.equal(created.questionGenerationRun.blueprintSnapshot.name, "v1");
    assert.equal(retry.questionGenerationRun.blueprintVersionId, v1Id);
    assert.equal(retry.questionGenerationRun.blueprintSnapshot.name, "v1");
  });

  it("rejects generation when current published version cannot be loaded", async () => {
    const fixture = createFixture();
    fixture.versions.delete(v1Id);

    await assert.rejects(
      () =>
        fixture.service.createQuestionGenerationRun({
          blueprintId,
          count: 1,
          currentUser,
          limit: 20,
          lineage: rootOperationLineage("019e9315-6a87-715f-9861-8654df076011"),
          targetQuestionSetId: setId,
        }),
      QuestionBlueprintNotFoundError,
    );
  });

  it("rejects generation when current version belongs to another blueprint", async () => {
    const fixture = createFixture();
    fixture.versions.set(v1Id, createVersion(v1Id, "v1", 1, otherBlueprintId));

    await assert.rejects(
      () =>
        fixture.service.createQuestionGenerationRun({
          blueprintId,
          count: 1,
          currentUser,
          limit: 20,
          lineage: rootOperationLineage("019e9315-6a87-715f-9861-8654df076018"),
          targetQuestionSetId: setId,
        }),
      InvalidQuestionBlueprintError,
    );
    assert.equal(fixture.runs.size, 0);
  });
});

type GenerationServiceRepo = Pick<
  QuestionsRepository,
  | "createQuestionGenerationRun"
  | "findQuestionBlueprintById"
  | "findQuestionBlueprintVersionById"
  | "findQuestionGenerationRunById"
  | "findQuestionSetById"
>;

function createFixture() {
  const blueprint = createBlueprint(v1Id, "v1");
  const versions = new Map<
    QuestionBlueprintVersion["id"],
    QuestionBlueprintVersion
  >([
    [v1Id, createVersion(v1Id, "v1", 1)],
    [v2Id, createVersion(v2Id, "v2", 2)],
  ]);
  const set = createSet();
  const runs = new Map<QuestionGenerationRun["id"], QuestionGenerationRun>();
  const repo = {
    async createQuestionGenerationRun(run: QuestionGenerationRun) {
      runs.set(run.id, run);
      return run;
    },
    async findQuestionBlueprintById() {
      return blueprint;
    },
    async findQuestionBlueprintVersionById(id: QuestionBlueprintVersion["id"]) {
      return versions.get(id) ?? null;
    },
    async findQuestionGenerationRunById(id: QuestionGenerationRun["id"]) {
      return runs.get(id) ?? null;
    },
    async findQuestionSetById() {
      return set;
    },
  } satisfies GenerationServiceRepo;
  const transaction = {
    async transaction(fn) {
      return fn({
        outboxRepository: fakeOutboxRepository(),
        questionsRepository: asQuestionsRepository(repo),
      });
    },
  } satisfies QuestionGenerationTransactionPort;
  const service = new QuestionGenerationService({
    clock: { now: () => at } satisfies Clock,
    idGenerator: createIds(),
    questionGenerationTransaction: transaction,
    questionsRepository: asQuestionsRepository(repo),
    workbookAccessPort: {
      async canUserAccessWorkbook() {
        return true;
      },
    } satisfies WorkbookAccessPort,
  });
  return { blueprint, runs, service, versions };
}

function asQuestionsRepository(
  repo: GenerationServiceRepo,
): QuestionsRepository {
  // Service tests fake only repository methods exercised by each scenario.
  return repo as unknown as QuestionsRepository;
}

function fakeOutboxRepository(): OutboxRepository {
  // Transaction port requires full outbox shape; these tests only append events.
  return { async appendEvents() {} } as unknown as OutboxRepository;
}

function createIds(): IdGenerator {
  let nextRunId = runId;
  return {
    eventId: () => eventId("019e9315-6a87-715f-9861-8654df076012"),
    questionBlueprintDraftId: () =>
      questionBlueprintDraftId("019e9315-6a87-715f-9861-8654df076013"),
    questionBlueprintId: () => blueprintId,
    questionBlueprintVersionId: () => v1Id,
    questionGenerationRunId: () => {
      const id = nextRunId;
      nextRunId = retryRunId;
      return id;
    },
    questionId: () => questionId("019e9315-6a87-715f-9861-8654df076014"),
    questionSetId: () => setId,
    sourceArtifactId: () => testSourceArtifactId,
    sourceDocumentId: () => testSourceDocumentId,
    sourceRevisionId: () => testSourceRevisionId,
  };
}

function createBlueprint(
  currentVersionId: QuestionBlueprint["currentVersionId"],
  name: string,
) {
  return createQuestionBlueprint(
    {
      createdByUserId: ownerUserId,
      currentVersionId,
      description: questionBlueprintDescription(null),
      document: document(name),
      id: blueprintId,
      name: questionBlueprintName(name),
      ownerUserId,
      sources: [source(name)],
      visibility: questionBlueprintVisibility("private"),
    },
    at,
  );
}

function createVersion(
  id: QuestionBlueprintVersion["id"],
  name: string,
  versionNumber: number,
  versionBlueprintId = blueprintId,
) {
  return createQuestionBlueprintVersion(
    {
      blueprintId: versionBlueprintId,
      createdByUserId: ownerUserId,
      description: questionBlueprintDescription(null),
      document: document(name),
      id,
      name: questionBlueprintName(name),
      ownerUserId,
      parentVersionId: null,
      sources: [source(name)],
      versionNumber: questionBlueprintVersionNumber(versionNumber),
    },
    at,
  );
}

function createSet(): QuestionSet {
  return createQuestionSet(
    {
      createdByUserId: ownerUserId,
      description: questionSetDescription(null),
      id: setId,
      name: questionSetName("Set"),
      ownerUserId,
    },
    at,
  );
}

function document(label: string) {
  return questionBlueprintDocument({
    blocks: [],
    references: [
      {
        id: `workbook:source_1:cell:Sheet1:${label === "v1" ? "A1" : "B1"}`,
        source: {
          ref: `Sheet1!${label === "v1" ? "A1" : "B1"}`,
          schemaVersion: 1,
          sourceId: "source_1",
          type: "workbook_cell",
        },
      },
    ],
    responseFields: [],
    schemaVersion: 2,
  });
}

function source(label: string) {
  return {
    byteSize: 1024,
    checksumSha256:
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    fileId: "019e9315-6a87-715f-9861-8654df076021",
    name: `Source ${label}`,
    originalName: "source.xlsx",
    sourceArtifactId: testSourceArtifactId,
    sourceDocumentId: testSourceDocumentId,
    sourceId: "source_1",
    sourceRevisionId: testSourceRevisionId,
    type: "workbook" as const,
    workbookId: workbookId(
      label === "v1"
        ? "019e9315-6a87-715f-9861-8654df076015"
        : "019e9315-6a87-715f-9861-8654df076016",
    ),
  };
}
