import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { type OperationLineage, rootOperationLineage } from "@lemma/domain";
import type { OutboxRepository } from "@lemma/events/application";
import { eventId } from "@lemma/events/domain";
import {
  createInitialQuestionGenerationRun,
  createQuestionBlueprintSnapshot,
  createQuestionBlueprintVersion,
  type Question,
  type QuestionBlueprintVersion,
  type QuestionGenerationRun,
  type QuestionSetQuestion,
  questionBlueprintDescription,
  questionBlueprintDocument,
  questionBlueprintDraftId,
  questionBlueprintId,
  questionBlueprintName,
  questionBlueprintVersionId,
  questionBlueprintVersionNumber,
  questionGenerationRunId,
  questionId,
  questionSetId,
  type UserId,
  userId,
  type WorkbookId,
  workbookCalculationId,
  workbookId,
} from "../domain/index.js";
import type {
  Clock,
  IdGenerator,
  QuestionGenerationTransactionPort,
  QuestionsRepository,
  QuestionValueResolverPort,
  WorkbookCalculationPort,
  WorkbookSnapshotReadPort,
} from "./ports.js";
import { QuestionGenerationWorkerService } from "./QuestionGenerationWorkerService.js";

const at = new Date("2026-06-22T00:00:00.000Z");
const ownerUserId = userId("019e9315-6a87-715f-9861-8654df077001");
const blueprintId = questionBlueprintId("019e9315-6a87-715f-9861-8654df077002");
const v1Id = questionBlueprintVersionId("019e9315-6a87-715f-9861-8654df077003");
const runId = questionGenerationRunId("019e9315-6a87-715f-9861-8654df077004");
const targetQuestionSetId = questionSetId(
  "019e9315-6a87-715f-9861-8654df077005",
);
const workbookAId = workbookId("019e9315-6a87-715f-9861-8654df077011");
const workbookBId = workbookId("019e9315-6a87-715f-9861-8654df077012");
const calculationId = workbookCalculationId(
  "019e9315-6a87-715f-9861-8654df077013",
);

describe("QuestionGenerationWorkerService", () => {
  it("materializes from pinned blueprintVersionId instead of stored mutable blueprint snapshot content", async () => {
    const version = createVersion(v1Id, "v1");
    const run = createInitialQuestionGenerationRun(
      {
        blueprintId,
        blueprintVersionId: v1Id,
        blueprintSnapshot: createSnapshot("v2 stored snapshot"),
        createdByUserId: ownerUserId,
        id: runId,
        ownerUserId,
        requestedCount: 1,
        targetQuestionSetId,
      },
      at,
    );
    const runs = new Map<QuestionGenerationRun["id"], QuestionGenerationRun>([
      [run.id, run],
    ]);
    const questions: Question[] = [];
    const repo = {
      async completeQuestionGenerationRun(input: {
        run: QuestionGenerationRun;
        questions: readonly Question[];
        memberships: readonly QuestionSetQuestion[];
      }) {
        runs.set(input.run.id, input.run);
        questions.push(...input.questions);
        return input.run;
      },
      async findQuestionBlueprintVersionById(
        id: QuestionBlueprintVersion["id"],
      ) {
        return id === version.id ? version : null;
      },
      async findQuestionGenerationRunById(id: QuestionGenerationRun["id"]) {
        return runs.get(id) ?? null;
      },
      async updateQuestionGenerationRun(run: QuestionGenerationRun) {
        runs.set(run.id, run);
        return run;
      },
    } satisfies WorkerRepo;
    const service = new QuestionGenerationWorkerService({
      clock: { now: () => at } satisfies Clock,
      idGenerator: createIds(),
      questionGenerationTransaction: transaction(repo),
      questionValueResolverPort: {
        async resolveReference() {
          return null;
        },
      } satisfies QuestionValueResolverPort,
      questionsRepository: asQuestionsRepository(repo),
      workbookCalculationPort: {
        async requestCalculation() {
          throw new Error("workbook calculation should not be requested");
        },
      } satisfies WorkbookCalculationPort,
      workbookSnapshotReadPort: {
        async listSnapshotMetadataForCalculation() {
          return [];
        },
      } satisfies WorkbookSnapshotReadPort,
    });

    const result = await service.materializeQuestionGenerationRun({
      eventWorkbookSnapshotIds: [],
      lineage: rootOperationLineage("019e9315-6a87-715f-9861-8654df077006"),
      questionGenerationRunId: run.id,
    });

    assert.equal(result.status, "processed");
    assert.equal(questions[0]?.body.blocks[0]?.type, "text");
    assert.deepEqual(questions[0]?.body.blocks[0], {
      content: [{ text: "v1", type: "text" }],
      id: "prompt",
      type: "text",
    });
  });

  it("requests workbook calculation using pinned version sources instead of stale run snapshot sources", async () => {
    const version = createWorkbookVersion(v1Id, workbookAId);
    const run = createInitialQuestionGenerationRun(
      {
        blueprintId,
        blueprintVersionId: v1Id,
        blueprintSnapshot: createWorkbookSnapshot(workbookBId),
        createdByUserId: ownerUserId,
        id: runId,
        ownerUserId,
        requestedCount: 2,
        targetQuestionSetId,
      },
      at,
    );
    const runs = new Map<QuestionGenerationRun["id"], QuestionGenerationRun>([
      [run.id, run],
    ]);
    const repo = {
      async completeQuestionGenerationRun() {
        throw new Error("question generation should wait for workbook results");
      },
      async findQuestionBlueprintVersionById(
        id: QuestionBlueprintVersion["id"],
      ) {
        return id === version.id ? version : null;
      },
      async findQuestionGenerationRunById(id: QuestionGenerationRun["id"]) {
        return runs.get(id) ?? null;
      },
      async updateQuestionGenerationRun(run: QuestionGenerationRun) {
        runs.set(run.id, run);
        return run;
      },
    } satisfies WorkerRepo;
    const capturedRequests: WorkbookCalculationRequest[] = [];
    const service = new QuestionGenerationWorkerService({
      clock: { now: () => at } satisfies Clock,
      idGenerator: createIds(),
      questionGenerationTransaction: transaction(repo),
      questionValueResolverPort: {
        async resolveReference() {
          return null;
        },
      } satisfies QuestionValueResolverPort,
      questionsRepository: asQuestionsRepository(repo),
      workbookCalculationPort: {
        async requestCalculation(input) {
          capturedRequests.push(input);
          return { workbookCalculationId: calculationId };
        },
      } satisfies WorkbookCalculationPort,
      workbookSnapshotReadPort: {
        async listSnapshotMetadataForCalculation() {
          return [];
        },
      } satisfies WorkbookSnapshotReadPort,
    });

    const result = await service.orchestrateQuestionGenerationRun({
      lineage: rootOperationLineage("019e9315-6a87-715f-9861-8654df077014"),
      questionGenerationRunId: run.id,
    });

    assert.equal(result.status, "waiting_for_workbook_calculation");
    const captured = capturedRequests[0];
    assert.ok(captured);
    assert.deepEqual(captured.sources, [
      { sourceId: "source_1", workbookId: workbookAId },
    ]);
    assert.notDeepEqual(captured.sources, [
      { sourceId: "source_1", workbookId: workbookBId },
    ]);
  });

  it("fails the run permanently when the pinned blueprint version is missing", async () => {
    const run = createInitialQuestionGenerationRun(
      {
        blueprintId,
        blueprintVersionId: v1Id,
        blueprintSnapshot: createSnapshot("v1"),
        createdByUserId: ownerUserId,
        id: runId,
        ownerUserId,
        requestedCount: 1,
        targetQuestionSetId,
      },
      at,
    );
    const runs = new Map<QuestionGenerationRun["id"], QuestionGenerationRun>([
      [run.id, run],
    ]);
    const repo = {
      async completeQuestionGenerationRun() {
        throw new Error("question generation should fail before completion");
      },
      async findQuestionBlueprintVersionById() {
        return null;
      },
      async findQuestionGenerationRunById(id: QuestionGenerationRun["id"]) {
        return runs.get(id) ?? null;
      },
      async updateQuestionGenerationRun(run: QuestionGenerationRun) {
        runs.set(run.id, run);
        return run;
      },
    } satisfies WorkerRepo;
    const service = new QuestionGenerationWorkerService({
      clock: { now: () => at } satisfies Clock,
      idGenerator: createIds(),
      questionGenerationTransaction: transaction(repo),
      questionValueResolverPort: {
        async resolveReference() {
          return null;
        },
      } satisfies QuestionValueResolverPort,
      questionsRepository: asQuestionsRepository(repo),
      workbookCalculationPort: {
        async requestCalculation() {
          throw new Error("workbook calculation should not be requested");
        },
      } satisfies WorkbookCalculationPort,
      workbookSnapshotReadPort: {
        async listSnapshotMetadataForCalculation() {
          return [];
        },
      } satisfies WorkbookSnapshotReadPort,
    });

    const result = await service.materializeQuestionGenerationRun({
      eventWorkbookSnapshotIds: [],
      lineage: rootOperationLineage("019e9315-6a87-715f-9861-8654df077010"),
      questionGenerationRunId: run.id,
    });

    assert.equal(result.status, "failed");
    assert.equal(result.questionGenerationRun.status, "failed");
    assert.match(
      result.questionGenerationRun.errorMessage ?? "",
      /question blueprint not found/,
    );
  });
});

type WorkerRepo = Pick<
  QuestionsRepository,
  | "completeQuestionGenerationRun"
  | "findQuestionBlueprintVersionById"
  | "findQuestionGenerationRunById"
  | "updateQuestionGenerationRun"
>;

type WorkbookCalculationRequest = {
  ownerUserId: UserId;
  createdByUserId: UserId;
  sources: readonly {
    sourceId: string;
    workbookId: WorkbookId;
  }[];
  requestedCount: number;
  correlationId?: string | null;
  lineage: OperationLineage;
};

function transaction(repo: WorkerRepo): QuestionGenerationTransactionPort {
  return {
    async transaction(fn) {
      return fn({
        outboxRepository: fakeOutboxRepository(),
        questionsRepository: asQuestionsRepository(repo),
      });
    },
  };
}

function asQuestionsRepository(repo: WorkerRepo): QuestionsRepository {
  // Worker tests fake only repository methods exercised by each scenario.
  return repo as unknown as QuestionsRepository;
}

function fakeOutboxRepository(): OutboxRepository {
  // Transaction port requires full outbox shape; these tests only append events.
  return { async appendEvents() {} } as unknown as OutboxRepository;
}

function createIds(): IdGenerator {
  return {
    eventId: () => eventId("019e9315-6a87-715f-9861-8654df077007"),
    questionBlueprintDraftId: () =>
      questionBlueprintDraftId("019e9315-6a87-715f-9861-8654df077008"),
    questionBlueprintId: () => blueprintId,
    questionBlueprintVersionId: () => v1Id,
    questionGenerationRunId: () => runId,
    questionId: () => questionId("019e9315-6a87-715f-9861-8654df077009"),
    questionSetId: () => targetQuestionSetId,
  };
}

function createVersion(id: QuestionBlueprintVersion["id"], label: string) {
  return createQuestionBlueprintVersion(
    {
      blueprintId,
      createdByUserId: ownerUserId,
      description: questionBlueprintDescription(null),
      document: document(label),
      id,
      name: questionBlueprintName(label),
      ownerUserId,
      parentVersionId: null,
      sources: [],
      versionNumber: questionBlueprintVersionNumber(1),
    },
    at,
  );
}

function createWorkbookVersion(
  id: QuestionBlueprintVersion["id"],
  sourceWorkbookId: WorkbookId,
) {
  return createQuestionBlueprintVersion(
    {
      blueprintId,
      createdByUserId: ownerUserId,
      description: questionBlueprintDescription(null),
      document: workbookDocument(),
      id,
      name: questionBlueprintName("workbook v1"),
      ownerUserId,
      parentVersionId: null,
      sources: [workbookSource(sourceWorkbookId)],
      versionNumber: questionBlueprintVersionNumber(1),
    },
    at,
  );
}

function createSnapshot(label: string) {
  return createQuestionBlueprintSnapshot({
    blueprintId,
    blueprintVersionId: v1Id,
    capturedAt: at,
    description: questionBlueprintDescription(null),
    document: document(label),
    name: questionBlueprintName(label),
    sources: [],
  });
}

function createWorkbookSnapshot(sourceWorkbookId: WorkbookId) {
  return createQuestionBlueprintSnapshot({
    blueprintId,
    blueprintVersionId: v1Id,
    capturedAt: at,
    description: questionBlueprintDescription(null),
    document: workbookDocument(),
    name: questionBlueprintName("stale workbook snapshot"),
    sources: [workbookSource(sourceWorkbookId)],
  });
}

function document(label: string) {
  return questionBlueprintDocument({
    blocks: [
      {
        content: [{ text: label, type: "text" }],
        id: "prompt",
        type: "text",
      },
    ],
    references: [],
    responseFields: [],
    schemaVersion: 1,
  });
}

function workbookDocument() {
  return questionBlueprintDocument({
    blocks: [],
    references: [
      {
        id: "workbook:source_1:cell:Sheet1:A1",
        source: {
          ref: "Sheet1!A1",
          schemaVersion: 1,
          sourceId: "source_1",
          type: "workbook_cell",
        },
      },
    ],
    responseFields: [],
    schemaVersion: 1,
  });
}

function workbookSource(sourceWorkbookId: WorkbookId) {
  return {
    byteSize: null,
    checksumSha256: null,
    fileId: null,
    name: "Workbook source",
    originalName: null,
    sourceId: "source_1",
    type: "workbook" as const,
    workbookId: sourceWorkbookId,
  };
}
