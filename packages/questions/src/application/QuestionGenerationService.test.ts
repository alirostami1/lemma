import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { OutboxRepository } from "@lemma/events/application";
import {
  type DomainEventEnvelope,
  type EventId,
  type OutboxConsumerName,
  type OutboxEvent,
  eventId as toEventId,
} from "@lemma/events/domain";
import { createCurrentUser } from "@lemma/identity/application";
import { createUser } from "@lemma/identity/domain";
import {
  createQuestionBlueprint,
  createQuestionBlueprintVersion,
  createQuestionSet,
  markQuestionGenerationRunFailed,
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
  workbookId as toWorkbookId,
  type WorkbookCalculationId,
} from "../domain/index.js";
import type {
  Clock,
  IdGenerator,
  QuestionGenerationTransactionPort,
  QuestionsRepository,
  WorkbookAccessPort,
} from "./ports.js";
import { QuestionGenerationService } from "./QuestionGenerationService.js";

const ownerUser = createUser(
  {
    id: "019e9315-6a87-715f-9861-8654df070c50",
    identityId: "owner",
    email: "owner@example.com",
    displayName: "Owner",
  },
  new Date("2026-01-01T00:00:00.000Z"),
);

const currentUser = createCurrentUser({ user: ownerUser, roles: [] });

const workbookIdInput = "019e9315-6a87-715f-9861-8654df070c51";
const workbookIdValue = toWorkbookId(workbookIdInput);
const mismatchedWorkbookIdInput = "019e9315-6a87-715f-9861-8654df070c60";
const workbookSource = {
  type: "workbook_snapshot" as const,
  workbookId: workbookIdInput,
};
const runId = questionGenerationRunId("019e9315-6a87-715f-9861-8654df070c53");
const retryRunId = questionGenerationRunId(
  "019e9315-6a87-715f-9861-8654df070c5c",
);
const requestedEventId = toEventId("019e9315-6a87-715f-9861-8654df070c5b");
const retryRequestedEventId = toEventId("019e9315-6a87-715f-9861-8654df070c5d");
const questionIds = [
  questionId("019e9315-6a87-715f-9861-8654df070c54"),
  questionId("019e9315-6a87-715f-9861-8654df070c55"),
] as const;
const lineage = {
  requestId: "019e9315-6a87-715f-9861-8654df070c61",
  correlationId: "019e9315-6a87-715f-9861-8654df070c61",
  causationId: null,
};

describe("QuestionGenerationService workbook orchestration", () => {
  it("queues a run and appends a requested event without starting workbook work", async () => {
    const state = createHarness();

    const service = new QuestionGenerationService(state.deps);
    const result = await service.createQuestionGenerationRun({
      currentUser,
      count: 2,
      blueprintId: state.blueprint.id,
      targetQuestionSetId: state.targetQuestionSet.id,
      source: workbookSource,
      lineage,
    });

    assert.equal(result.questionGenerationRun.status, "queued");
    assert.deepEqual(state.events, [
      "transaction",
      "create-run",
      "append-events",
    ]);
    assert.equal(state.createdQuestions.length, 0);
    assert.equal(state.memberships.length, 0);
    assert.equal(state.outboxEvents.length, 1);
    assert.equal(
      state.outboxEvents[0]?.type,
      "question_generation.run_requested.v1",
    );
    assert.equal(state.outboxEvents[0]?.payload.questionGenerationRunId, runId);
  });

  it("derives the saved workbook source when omitted", async () => {
    const state = createHarness();

    const service = new QuestionGenerationService(state.deps);
    const result = await service.createQuestionGenerationRun({
      currentUser,
      count: 1,
      blueprintId: state.blueprint.id,
      targetQuestionSetId: state.targetQuestionSet.id,
      lineage,
    });

    assert.equal(result.questionGenerationRun.status, "queued");
    assert.equal(
      result.questionGenerationRun.source?.workbookId,
      workbookIdValue,
    );
    assert.equal(
      result.questionGenerationRun.source?.workbookCalculationId,
      null,
    );
  });

  it("stores the target question set when provided", async () => {
    const targetQuestionSet = createQuestionSet(
      {
        id: questionSetId("019e9315-6a87-715f-9861-8654df070c58"),
        ownerUserId: ownerUser.id,
        createdByUserId: ownerUser.id,
        name: questionSetName("Target set"),
        description: questionSetDescription(null),
      },
      new Date("2026-01-01T00:00:00.000Z"),
    );
    const state = createHarness({
      targetQuestionSet,
    });

    const service = new QuestionGenerationService(state.deps);
    const result = await service.createQuestionGenerationRun({
      currentUser,
      count: 2,
      blueprintId: state.blueprint.id,
      targetQuestionSetId: targetQuestionSet.id,
      lineage,
    });

    assert.equal(result.questionGenerationRun.status, "queued");
    assert.equal(
      result.questionGenerationRun.targetQuestionSetId,
      targetQuestionSet.id,
    );
    assert.equal(state.memberships.length, 0);
  });

  it("rejects mismatched explicit workbook source", async () => {
    const state = createHarness();

    const service = new QuestionGenerationService(state.deps);
    await assert.rejects(
      service.createQuestionGenerationRun({
        currentUser,
        count: 1,
        blueprintId: state.blueprint.id,
        targetQuestionSetId: state.targetQuestionSet.id,
        source: {
          type: "workbook_snapshot",
          workbookId: mismatchedWorkbookIdInput,
        },
        lineage,
      }),
      /explicit workbook source must match blueprint workbook/,
    );
  });

  it("retries by creating a new queued run and requested event", async () => {
    const state = createHarness();

    const service = new QuestionGenerationService(state.deps);
    const created = await service.createQuestionGenerationRun({
      currentUser,
      count: 1,
      blueprintId: state.blueprint.id,
      targetQuestionSetId: state.targetQuestionSet.id,
      source: workbookSource,
      lineage,
    });
    const failed = markQuestionGenerationRunFailed(
      created.questionGenerationRun,
      "boom",
      new Date("2026-01-01T00:00:00.000Z"),
    );
    state.runs[0] = failed;
    state.events.length = 0;
    state.outboxEvents.length = 0;

    const retry = await service.retryQuestionGenerationRun({
      currentUser,
      questionGenerationRunId: failed.id,
      lineage,
    });

    assert.equal(retry.questionGenerationRun.id, retryRunId);
    assert.equal(retry.questionGenerationRun.status, "queued");
    assert.deepEqual(state.events, [
      "transaction",
      "create-run",
      "append-events",
    ]);
    assert.equal(state.outboxEvents.length, 1);
    assert.equal(state.outboxEvents[0]?.id, retryRequestedEventId);
    assert.equal(
      state.outboxEvents[0]?.payload.questionGenerationRunId,
      retryRunId,
    );
  });

  it("cancels a run with a cancelled event", async () => {
    const state = createHarness();
    const service = new QuestionGenerationService(state.deps);
    const created = await service.createQuestionGenerationRun({
      currentUser,
      count: 1,
      blueprintId: state.blueprint.id,
      targetQuestionSetId: state.targetQuestionSet.id,
      source: workbookSource,
      lineage,
    });
    state.events.length = 0;
    state.outboxEvents.length = 0;

    await service.cancelQuestionGenerationRun({
      currentUser,
      questionGenerationRunId: created.questionGenerationRun.id,
      lineage,
    });

    assert.equal(state.runs[0]?.status, "cancelled");
    assert.deepEqual(state.events, [
      "transaction",
      "update:cancelled",
      "append-events",
    ]);
    assert.equal(
      state.outboxEvents[0]?.type,
      "question_generation.run_cancelled.v1",
    );
  });

  it("does not start workbook processing in the request path", async () => {
    const state = createHarness({});

    const service = new QuestionGenerationService(state.deps);
    const result = await service.createQuestionGenerationRun({
      currentUser,
      count: 1,
      blueprintId: state.blueprint.id,
      targetQuestionSetId: state.targetQuestionSet.id,
      source: workbookSource,
      lineage,
    });

    assert.equal(result.questionGenerationRun.status, "queued");
    assert.equal(result.questionGenerationRun.errorMessage, null);
    assert.equal(state.createdQuestions.length, 0);
    assert.equal(state.events.includes("request"), false);
    assert.equal(state.events.includes("process"), false);
    assert.equal(state.events.includes("resolve"), false);
  });
});

function createHarness(input: { targetQuestionSet?: QuestionSet | null } = {}) {
  const events: string[] = [];
  const createdQuestions: Question[] = [];
  const memberships: QuestionSetQuestion[] = [];
  const runs: QuestionGenerationRun[] = [];
  const outboxEvents: DomainEventEnvelope[] = [];
  let questionIndex = 0;
  let runIndex = 0;
  let eventIndex = 0;
  const document = questionBlueprintDocument({
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
      {
        id: "answer",
        type: "response",
        responseFieldId: "answer",
        correctValueSource: {
          schemaVersion: 1,
          type: "reference",
          referenceId: "revenue",
        },
        points: 1,
        grading: { mode: "exact" },
      },
    ],
  });
  const at = new Date("2026-01-01T00:00:00.000Z");
  const baseBlueprint = createQuestionBlueprint(
    {
      id: questionBlueprintId("019e9315-6a87-715f-9861-8654df070c59"),
      ownerUserId: ownerUser.id,
      createdByUserId: ownerUser.id,
      name: questionBlueprintName("Saved blueprint"),
      description: questionBlueprintDescription(null),
      visibility: questionBlueprintVisibility("private"),
      workbookId: workbookIdValue,
    },
    at,
  );
  const targetQuestionSet =
    input.targetQuestionSet ??
    createQuestionSet(
      {
        id: questionSetId("019e9315-6a87-715f-9861-8654df070c58"),
        ownerUserId: ownerUser.id,
        createdByUserId: ownerUser.id,
        name: questionSetName("Target set"),
        description: questionSetDescription(null),
      },
      at,
    );
  const blueprintVersion = createQuestionBlueprintVersion(
    {
      id: questionBlueprintVersionId("019e9315-6a87-715f-9861-8654df070c5a"),
      questionBlueprintId: baseBlueprint.id,
      versionNumber: 1,
      document,
      workbookId: workbookIdValue,
      createdByUserId: ownerUser.id,
    },
    at,
  );
  const blueprint = {
    ...baseBlueprint,
    currentVersionId: blueprintVersion.id,
    workbookId: blueprintVersion.workbookId,
  } satisfies QuestionBlueprint;

  const questionsRepository = createQuestionsRepository(
    runs,
    createdQuestions,
    memberships,
    events,
    blueprint,
    blueprintVersion,
    targetQuestionSet,
  );
  const outboxRepository = createOutboxRepository(outboxEvents, events);
  const deps = {
    questionsRepository,
    questionGenerationTransaction: {
      async transaction(fn) {
        events.push("transaction");
        return fn({ questionsRepository, outboxRepository });
      },
    } satisfies QuestionGenerationTransactionPort,
    workbookAccessPort: {
      async canUserAccessWorkbook() {
        return true;
      },
    } satisfies WorkbookAccessPort,
    idGenerator: {
      questionGenerationRunId: () =>
        [runId, retryRunId][runIndex++] ?? retryRunId,
      questionId: () => {
        const nextQuestionId =
          questionIds[questionIndex++] ?? questionIds.at(-1);
        assert.ok(nextQuestionId);
        return nextQuestionId;
      },
      questionSetId: () =>
        questionSetId("019e9315-6a87-715f-9861-8654df070c58"),
      questionBlueprintId: () =>
        questionBlueprintId("019e9315-6a87-715f-9861-8654df070c59"),
      questionBlueprintVersionId: () =>
        questionBlueprintVersionId("019e9315-6a87-715f-9861-8654df070c5a"),
      eventId: () =>
        [requestedEventId, retryRequestedEventId][eventIndex++] ??
        retryRequestedEventId,
    } satisfies IdGenerator,
    clock: {
      now: () => new Date("2026-01-01T00:00:00.000Z"),
    } satisfies Clock,
  };

  return {
    deps,
    document,
    blueprint,
    blueprintVersion,
    events,
    createdQuestions,
    memberships,
    runs,
    outboxEvents,
    targetQuestionSet,
  };
}

function createQuestionsRepository(
  runs: QuestionGenerationRun[],
  createdQuestions: Question[],
  memberships: QuestionSetQuestion[],
  events: string[],
  blueprint: QuestionBlueprint,
  blueprintVersion: QuestionBlueprintVersion,
  targetQuestionSet: QuestionSet,
): QuestionsRepository {
  const updateRun = (run: QuestionGenerationRun) => {
    const index = runs.findIndex((candidate) => candidate.id === run.id);
    if (index >= 0) {
      runs[index] = run;
    } else {
      runs.push(run);
    }
    return run;
  };

  return {
    async findQuestionSetById(
      _id: QuestionSet["id"],
    ): Promise<QuestionSet | null> {
      return _id === targetQuestionSet.id ? targetQuestionSet : null;
    },
    async listQuestionSetsByOwnerUserId(): Promise<QuestionSet[]> {
      return [];
    },
    async createQuestionSet(set: QuestionSet): Promise<QuestionSet> {
      return set;
    },
    async updateQuestionSet(set: QuestionSet): Promise<QuestionSet | null> {
      return set;
    },
    async removeQuestionFromSet(): Promise<void> {},
    async listQuestionsBySetId(): Promise<Question[]> {
      return [];
    },
    async findQuestionBlueprintById(
      _id: QuestionBlueprint["id"],
    ): Promise<QuestionBlueprint | null> {
      return blueprint;
    },
    async findQuestionBlueprintVersionById(
      _id: QuestionBlueprintVersion["id"],
    ): Promise<QuestionBlueprintVersion | null> {
      return blueprintVersion;
    },
    async findCurrentQuestionBlueprintVersion(
      _blueprintId: QuestionBlueprint["id"],
    ): Promise<QuestionBlueprintVersion | null> {
      return blueprintVersion;
    },
    async listQuestionBlueprintVersions(input: {
      blueprintId: QuestionBlueprint["id"];
    }): Promise<QuestionBlueprintVersion[]> {
      void input;
      return [blueprintVersion];
    },
    async listQuestionBlueprintVersionAssets() {
      return [];
    },
    async listQuestionBlueprintVersionAssetsByVersionIds() {
      return [];
    },
    async listQuestionBlueprintsByOwnerUserId(): Promise<QuestionBlueprint[]> {
      return [blueprint];
    },
    async createQuestionBlueprint(
      blueprint: QuestionBlueprint,
    ): Promise<QuestionBlueprint> {
      return blueprint;
    },
    async createQuestionBlueprintVersion(
      version: QuestionBlueprintVersion,
    ): Promise<QuestionBlueprintVersion> {
      return version;
    },
    async updateQuestionBlueprint(
      blueprint: QuestionBlueprint,
    ): Promise<QuestionBlueprint | null> {
      return blueprint;
    },
    async updateQuestionBlueprintCurrentVersion(input: {
      blueprintId: QuestionBlueprint["id"];
      currentVersionId: QuestionBlueprintVersion["id"];
      workbookId: QuestionBlueprint["workbookId"];
      updatedAt: Date;
    }): Promise<QuestionBlueprint | null> {
      return {
        ...blueprint,
        currentVersionId: input.currentVersionId,
        workbookId: input.workbookId,
        updatedAt: input.updatedAt,
      };
    },
    async createQuestionBlueprintWithVersion(input: {
      blueprint: QuestionBlueprint;
      version: QuestionBlueprintVersion;
      assets: readonly QuestionBlueprintVersionAsset[];
    }): Promise<QuestionBlueprint> {
      return {
        ...input.blueprint,
        currentVersionId: input.version.id,
        workbookId: input.version.workbookId,
      };
    },
    async updateQuestionBlueprintWithNewVersion(input: {
      blueprint: QuestionBlueprint;
      version: QuestionBlueprintVersion;
      assets: readonly QuestionBlueprintVersionAsset[];
    }): Promise<QuestionBlueprint | null> {
      return {
        ...input.blueprint,
        currentVersionId: input.version.id,
        workbookId: input.version.workbookId,
      };
    },
    async findQuestionById(_id: Question["id"]): Promise<Question | null> {
      return null;
    },
    async listQuestionsByOwnerUserId(): Promise<Question[]> {
      return [];
    },
    async deleteQuestion(question: Question): Promise<Question | null> {
      return question;
    },
    async findQuestionGenerationRunById(
      id: QuestionGenerationRun["id"],
    ): Promise<QuestionGenerationRun | null> {
      return runs.find((run) => run.id === id) ?? null;
    },
    async findQuestionGenerationRunByWorkbookCalculationId(
      id: WorkbookCalculationId,
    ): Promise<QuestionGenerationRun | null> {
      return (
        runs.find((run) => run.source?.workbookCalculationId === id) ?? null
      );
    },
    async listQuestionGenerationRunsByOwnerUserId(): Promise<
      QuestionGenerationRun[]
    > {
      return [];
    },
    async createQuestionGenerationRun(
      run: QuestionGenerationRun,
    ): Promise<QuestionGenerationRun> {
      events.push("create-run");
      return updateRun(run);
    },
    async updateQuestionGenerationRun(
      run: QuestionGenerationRun,
    ): Promise<QuestionGenerationRun | null> {
      events.push(`update:${run.status}`);
      return updateRun(run);
    },
    async completeQuestionGenerationRun(input: {
      run: QuestionGenerationRun;
      questions: readonly Question[];
      memberships: readonly QuestionSetQuestion[];
    }): Promise<QuestionGenerationRun | null> {
      events.push("complete");
      createdQuestions.push(...input.questions);
      memberships.push(...input.memberships);
      return updateRun(input.run);
    },
  } satisfies QuestionsRepository;
}

function createOutboxRepository(
  outboxEvents: DomainEventEnvelope[],
  events: string[],
): OutboxRepository {
  const processed = new Set<string>();
  return {
    async appendEvents(
      nextEvents: readonly DomainEventEnvelope[],
    ): Promise<void> {
      events.push("append-events");
      outboxEvents.push(...nextEvents);
    },
    async claimPendingEvents(): Promise<OutboxEvent[]> {
      return [];
    },
    async markEventPublished(): Promise<void> {},
    async markEventFailed(): Promise<void> {},
    async findEventById(id: EventId): Promise<OutboxEvent | null> {
      const event = outboxEvents.find((candidate) => candidate.id === id);
      if (!event) {
        return null;
      }
      return {
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
      };
    },
    async listFailedEvents(): Promise<OutboxEvent[]> {
      return [];
    },
    async deletePublishedEventsBefore(): Promise<number> {
      return 0;
    },
    async hasProcessedEvent(input: {
      eventId: EventId;
      consumer: OutboxConsumerName;
    }): Promise<boolean> {
      return processed.has(processedEventKey(input));
    },
    async recordProcessedEvent(input: {
      eventId: EventId;
      consumer: OutboxConsumerName;
    }): Promise<boolean> {
      const key = processedEventKey(input);
      if (processed.has(key)) {
        return false;
      }
      processed.add(key);
      return true;
    },
  };
}

function processedEventKey(input: {
  eventId: EventId;
  consumer: OutboxConsumerName;
}) {
  return `${input.consumer}:${input.eventId}`;
}
