import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { OutboxRepository } from "@lemma/events/application";
import {
  type DomainEventEnvelope,
  type EventId,
  type OutboxEvent,
  eventId as toEventId,
} from "@lemma/events/domain";
import {
  cancelQuestionGenerationRun,
  createQuestionGenerationRun,
  createQuestionSet,
  type Question,
  type QuestionBlueprint,
  type QuestionBlueprintVersion,
  type QuestionBlueprintVersionAsset,
  type QuestionGenerationRun,
  type QuestionSet,
  type QuestionSetQuestion,
  questionBlueprintDescription,
  questionBlueprintDocument,
  questionBlueprintId,
  questionBlueprintName,
  questionBlueprintVersionId,
  questionBlueprintVisibility,
  questionGenerationRunId,
  questionId,
  questionSetDescription,
  questionSetId,
  questionSetName,
  userId,
  type WorkbookCalculationId,
  workbookCalculationId,
  workbookId,
  workbookSnapshotId,
} from "../domain/index.js";
import { createQuestionBlueprintVersion } from "../domain/question-blueprint.js";
import { WorkbookQuestionSourceError } from "./errors.js";
import type {
  IdGenerator,
  QuestionGenerationTransactionPort,
  QuestionsRepository,
  QuestionValueResolverPort,
  WorkbookCalculationPort,
} from "./ports.js";
import { QuestionGenerationWorkerService } from "./QuestionGenerationWorkerService.js";

const at = new Date("2026-01-01T00:00:00.000Z");
const ownerUserId = userId("019e9315-6a87-715f-9861-8654df070d01");
const runId = questionGenerationRunId("019e9315-6a87-715f-9861-8654df070d02");
const targetQuestionSetId = questionSetId(
  "019e9315-6a87-715f-9861-8654df070d03",
);
const blueprintId = questionBlueprintId("019e9315-6a87-715f-9861-8654df070d04");
const versionId = questionBlueprintVersionId(
  "019e9315-6a87-715f-9861-8654df070d05",
);
const workbookIdValue = workbookId("019e9315-6a87-715f-9861-8654df070d06");
const blueprintSources = [
  {
    type: "workbook" as const,
    sourceId: "source_1",
    name: "Source 1",
    workbookId: workbookIdValue,
  },
];
const calculationId = workbookCalculationId(
  "019e9315-6a87-715f-9861-8654df070d07",
);
const snapshotId = workbookSnapshotId("019e9315-6a87-715f-9861-8654df070d08");
const generatedQuestionId = questionId("019e9315-6a87-715f-9861-8654df070d09");
const eventIds = [
  toEventId("019e9315-6a87-715f-9861-8654df070d0a"),
  toEventId("019e9315-6a87-715f-9861-8654df070d0b"),
  toEventId("019e9315-6a87-715f-9861-8654df070d0c"),
  toEventId("019e9315-6a87-715f-9861-8654df070d0d"),
] as const;
const lineage = {
  requestId: "019e9315-6a87-715f-9861-8654df070d10",
  correlationId: "019e9315-6a87-715f-9861-8654df070d10",
  causationId: null,
};

describe("QuestionGenerationWorkerService", () => {
  it("orchestrates workbook calculation then materializes questions", async () => {
    const state = createHarness();
    const requested = await state.service.orchestrateQuestionGenerationRun({
      questionGenerationRunId: runId,
      lineage,
    });
    const ready = await state.service.orchestrateQuestionGenerationRun({
      questionGenerationRunId: runId,
      workbookCalculationId: calculationId,
      workbookSnapshotIds: [snapshotId],
      lineage,
    });
    assert.equal(ready.status, "materialization_ready");
    const result = await state.service.materializeQuestionGenerationRun({
      questionGenerationRunId: runId,
      workbookSnapshotIds:
        ready.status === "materialization_ready"
          ? ready.workbookSnapshotIds
          : [],
      lineage,
    });

    assert.equal(requested.status, "waiting_for_workbook_calculation");
    assert.equal(result.status, "processed");
    assert.equal(result.questionGenerationRun.status, "succeeded");
    assert.deepEqual(
      state.outboxEvents.map((event) => event.type),
      [
        "question_generation.run_waiting_for_workbook_calculation.v1",
        "question_generation.run_materializing.v1",
        "question_generation.run_succeeded.v1",
        "question_set.questions_added.v1",
      ],
    );
    assert.deepEqual(state.events, [
      "request",
      "transaction",
      "update:waiting_for_workbook_calculation",
      "append-events",
      "transaction",
      "update:materializing",
      "append-events",
      "resolve",
      "transaction",
      "complete",
      "append-events",
    ]);
    assert.equal(state.createdQuestions.length, 1);
    assert.equal(state.memberships.length, 1);
    assert.equal(
      state.createdQuestions[0]?.source?.workbookSnapshotId,
      snapshotId,
    );
  });

  it("skips terminal runs", async () => {
    const state = createHarness({
      run: cancelQuestionGenerationRun(createQueuedRun(), at),
    });
    const result = await state.service.orchestrateQuestionGenerationRun({
      questionGenerationRunId: runId,
      lineage,
    });

    assert.equal(result.status, "skipped");
    assert.equal(result.reason, "terminal");
    assert.equal(state.events.length, 0);
  });

  it("skips duplicate materialization after a run reaches a terminal state", async () => {
    const state = createHarness();
    const processed = await state.service.materializeQuestionGenerationRun({
      questionGenerationRunId: runId,
      workbookSnapshotIds: [snapshotId],
      lineage,
    });
    const eventCount = state.outboxEvents.length;

    const duplicate = await state.service.materializeQuestionGenerationRun({
      questionGenerationRunId: runId,
      workbookSnapshotIds: [snapshotId],
      lineage,
    });

    assert.equal(processed.status, "processed");
    assert.equal(duplicate.status, "skipped");
    assert.equal(duplicate.reason, "terminal");
    assert.equal(state.createdQuestions.length, 1);
    assert.equal(state.memberships.length, 1);
    assert.equal(state.outboxEvents.length, eventCount);
  });

  it("skips completion when another worker already committed the run", async () => {
    const state = createHarness({ completeRunReturnsNull: true });
    const result = await state.service.materializeQuestionGenerationRun({
      questionGenerationRunId: runId,
      workbookSnapshotIds: [snapshotId],
      lineage,
    });

    assert.equal(result.status, "skipped");
    assert.equal(result.reason, "terminal");
    assert.equal(state.createdQuestions.length, 0);
    assert.equal(state.memberships.length, 0);
    assert.deepEqual(
      state.outboxEvents.map((event) => event.type),
      ["question_generation.run_materializing.v1"],
    );
  });

  it("skips missing runs", async () => {
    const state = createHarness({ run: null });
    const result = await state.service.orchestrateQuestionGenerationRun({
      questionGenerationRunId: runId,
      lineage,
    });

    assert.equal(result.status, "skipped");
    assert.equal(result.reason, "not_found");
    assert.equal(state.events.length, 0);
  });

  it("marks permanent materialization failures", async () => {
    const state = createHarness({
      resolveReferenceError: new WorkbookQuestionSourceError("missing value"),
    });
    const result = await state.service.materializeQuestionGenerationRun({
      questionGenerationRunId: runId,
      workbookSnapshotIds: [snapshotId],
      lineage,
    });

    assert.equal(result.status, "failed");
    assert.equal(result.questionGenerationRun.status, "failed");
    assert.equal(result.questionGenerationRun.errorMessage, "missing value");
    assert.equal(
      state.outboxEvents.at(-1)?.type,
      "question_generation.run_failed.v1",
    );
    assert.equal(state.createdQuestions.length, 0);
  });

  it("reconciles exhausted queue failures into a failed run event", async () => {
    const state = createHarness();
    const result = await state.service.reconcileFailedGenerationJob({
      questionGenerationRunId: runId,
      errorMessage: "LibreOffice unavailable.",
      lineage,
    });

    assert.equal(result.status, "failed");
    assert.equal(result.questionGenerationRun.status, "failed");
    assert.equal(
      result.questionGenerationRun.errorMessage,
      "Question generation job failed after queue retries: LibreOffice unavailable.",
    );
    assert.equal(
      state.outboxEvents.at(-1)?.type,
      "question_generation.run_failed.v1",
    );
    assert.equal(state.createdQuestions.length, 0);
  });

  it("skips queue failure reconciliation with an invalid run id", async () => {
    const state = createHarness();
    const result = await state.service.reconcileFailedGenerationJob({
      questionGenerationRunId: "not-a-run-id",
      errorMessage: "boom",
      lineage,
    });

    assert.equal(result.status, "skipped");
    assert.equal(result.reason, "invalid_payload");
    assert.equal(state.outboxEvents.length, 0);
  });
});

function createHarness(
  input: {
    run?: QuestionGenerationRun | null;
    resolveReferenceError?: Error;
    completeRunReturnsNull?: boolean;
  } = {},
) {
  const events: string[] = [];
  const outboxEvents: DomainEventEnvelope[] = [];
  const createdQuestions: Question[] = [];
  const memberships: QuestionSetQuestion[] = [];
  const runs = input.run === null ? [] : [input.run ?? createQueuedRun()];
  const version = createBlueprintVersion();
  let eventIndex = 0;

  const questionsRepository = createQuestionsRepository({
    runs,
    version,
    events,
    createdQuestions,
    memberships,
    completeRunReturnsNull: input.completeRunReturnsNull,
  });
  const outboxRepository = createOutboxRepository(outboxEvents, events);
  const service = new QuestionGenerationWorkerService({
    questionsRepository,
    questionValueResolverPort: {
      async resolveReference() {
        events.push("resolve");
        if (input.resolveReferenceError) {
          throw input.resolveReferenceError;
        }
        return 1200;
      },
    } satisfies QuestionValueResolverPort,
    workbookCalculationPort: {
      async requestCalculation() {
        events.push("request");
        return { workbookCalculationId: calculationId };
      },
    } satisfies WorkbookCalculationPort,
    questionGenerationTransaction: {
      async transaction(fn) {
        events.push("transaction");
        return fn({ questionsRepository, outboxRepository });
      },
    } satisfies QuestionGenerationTransactionPort,
    idGenerator: {
      questionSetId: () => targetQuestionSetId,
      questionBlueprintId: () => blueprintId,
      questionBlueprintVersionId: () => versionId,
      questionId: () => generatedQuestionId,
      questionGenerationRunId: () => runId,
      eventId: () => {
        const nextEventId = eventIds[eventIndex++] ?? eventIds.at(-1);
        assert.ok(nextEventId);
        return nextEventId;
      },
    } satisfies IdGenerator,
    clock: { now: () => at },
  });

  return {
    service,
    events,
    outboxEvents,
    createdQuestions,
    memberships,
  };
}

function createQueuedRun() {
  return createQuestionGenerationRun(
    {
      id: runId,
      ownerUserId,
      createdByUserId: ownerUserId,
      blueprintId,
      blueprintVersionId: versionId,
      targetQuestionSetId,
      requestedCount: 1,
      source: {
        type: "workbook_snapshot",
        workbookId: workbookIdValue,
        workbookVersionId: null,
        workbookCalculationId: null,
        workbookSnapshotId: null,
      },
    },
    at,
  );
}

function createBlueprintVersion() {
  return createQuestionBlueprintVersion(
    {
      id: versionId,
      questionBlueprintId: blueprintId,
      versionNumber: 1,
      document: questionBlueprintDocument({
        schemaVersion: 1,
        references: [
          {
            id: "revenue",
            source: {
              schemaVersion: 1,
              type: "workbook_cell",
              sourceId: "source_1",
              ref: "Sheet1!A1",
            },
          },
        ],
        responseFields: [{ id: "answer", type: "number" }],
        blocks: [
          {
            id: "prompt",
            type: "text",
            content: [
              { type: "text", text: "Revenue: " },
              { type: "reference", referenceId: "revenue" },
            ],
          },
        ],
      }),
      createdByUserId: ownerUserId,
      sources: blueprintSources,
    },
    at,
  );
}

function createQuestionsRepository(input: {
  runs: QuestionGenerationRun[];
  version: QuestionBlueprintVersion;
  events: string[];
  createdQuestions: Question[];
  memberships: QuestionSetQuestion[];
  completeRunReturnsNull?: boolean;
}): QuestionsRepository {
  const targetSet = createQuestionSet(
    {
      id: targetQuestionSetId,
      ownerUserId,
      createdByUserId: ownerUserId,
      name: questionSetName("Target"),
      description: questionSetDescription(null),
    },
    at,
  );
  const blueprint = {
    id: blueprintId,
    ownerUserId,
    createdByUserId: ownerUserId,
    name: questionBlueprintName("Blueprint"),
    description: questionBlueprintDescription(null),
    status: "active",
    visibility: questionBlueprintVisibility("private"),
    currentVersionId: versionId,
    sources: blueprintSources,
    archivedAt: null,
    createdAt: at,
    updatedAt: at,
  } satisfies QuestionBlueprint;

  function updateRun(run: QuestionGenerationRun) {
    const index = input.runs.findIndex((candidate) => candidate.id === run.id);
    if (index < 0) {
      return null;
    }
    input.runs[index] = run;
    return run;
  }

  return {
    async findQuestionSetById() {
      return targetSet;
    },
    async listQuestionSetsByOwnerUserId() {
      return [targetSet];
    },
    async createQuestionSet(set: QuestionSet) {
      return set;
    },
    async updateQuestionSet(set: QuestionSet) {
      return set;
    },
    async removeQuestionFromSet() {},
    async listQuestionsBySetId() {
      return [];
    },
    async findQuestionBlueprintById() {
      return blueprint;
    },
    async findQuestionBlueprintVersionById() {
      return input.version;
    },
    async findCurrentQuestionBlueprintVersion() {
      return input.version;
    },
    async listQuestionBlueprintVersions() {
      return [input.version];
    },
    async listQuestionBlueprintVersionAssets() {
      return [];
    },
    async listQuestionBlueprintVersionAssetsByVersionIds() {
      return [];
    },
    async listQuestionBlueprintsByOwnerUserId() {
      return [blueprint];
    },
    async createQuestionBlueprint(nextBlueprint: QuestionBlueprint) {
      return nextBlueprint;
    },
    async createQuestionBlueprintVersion(version: QuestionBlueprintVersion) {
      return version;
    },
    async createQuestionBlueprintWithVersion(next: {
      blueprint: QuestionBlueprint;
      version: QuestionBlueprintVersion;
      assets: readonly QuestionBlueprintVersionAsset[];
    }) {
      return next.blueprint;
    },
    async updateQuestionBlueprint(nextBlueprint: QuestionBlueprint) {
      return nextBlueprint;
    },
    async updateQuestionBlueprintCurrentVersion() {
      return blueprint;
    },
    async updateQuestionBlueprintWithNewVersion(next: {
      blueprint: QuestionBlueprint;
      version: QuestionBlueprintVersion;
      assets: readonly QuestionBlueprintVersionAsset[];
    }) {
      return next.blueprint;
    },
    async findQuestionById() {
      return null;
    },
    async listQuestionsByOwnerUserId() {
      return [];
    },
    async deleteQuestion() {
      return null;
    },
    async findQuestionGenerationRunById(id) {
      return input.runs.find((run) => run.id === id) ?? null;
    },
    async findQuestionGenerationRunByWorkbookCalculationId(
      id: WorkbookCalculationId,
    ) {
      return (
        input.runs.find((run) => run.source?.workbookCalculationId === id) ??
        null
      );
    },
    async listQuestionGenerationRunsByOwnerUserId() {
      return input.runs;
    },
    async createQuestionGenerationRun(run: QuestionGenerationRun) {
      input.runs.push(run);
      return run;
    },
    async updateQuestionGenerationRun(run: QuestionGenerationRun) {
      input.events.push(`update:${run.status}`);
      return updateRun(run);
    },
    async completeQuestionGenerationRun(next) {
      input.events.push("complete");
      if (input.completeRunReturnsNull) {
        updateRun(next.run);
        return null;
      }
      input.createdQuestions.push(...next.questions);
      input.memberships.push(...next.memberships);
      return updateRun(next.run);
    },
  } satisfies QuestionsRepository;
}

function createOutboxRepository(
  outboxEvents: DomainEventEnvelope[],
  events: string[],
): OutboxRepository {
  return {
    async appendEvents(nextEvents: readonly DomainEventEnvelope[]) {
      events.push("append-events");
      outboxEvents.push(...nextEvents);
    },
    async claimPendingEvents(): Promise<OutboxEvent[]> {
      return [];
    },
    async markEventPublished() {},
    async markEventFailed() {},
    async findEventById(id: EventId): Promise<OutboxEvent | null> {
      const event = outboxEvents.find((candidate) => candidate.id === id);
      return event
        ? {
            id: event.id,
            eventType: event.type,
            schemaVersion: event.schemaVersion,
            aggregateType: event.aggregate.type,
            aggregateId: event.aggregate.id,
            ownerUserId: event.ownerUserId ?? null,
            lineage: event.lineage,
            payload: event.payload,
            status: "pending",
            availableAt: event.occurredAt,
            attempts: 0,
            lockedBy: null,
            lockedAt: null,
            publishedAt: null,
            lastError: null,
            createdAt: event.occurredAt,
            updatedAt: event.occurredAt,
          }
        : null;
    },
    async listFailedEvents(): Promise<OutboxEvent[]> {
      return [];
    },
    async deletePublishedEventsBefore(): Promise<number> {
      return 0;
    },
    async hasProcessedEvent() {
      return false;
    },
    async recordProcessedEvent() {
      return true;
    },
  };
}
