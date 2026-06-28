import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { OutboxService } from "@lemma/events/application";
import {
  aggregateId,
  aggregateType,
  type DomainEventEnvelope,
  domainEventEnvelope,
  eventId,
  type OutboxEvent,
  outboxEventFromEnvelope,
} from "@lemma/events/domain";
import type { JobDispatcher } from "@lemma/jobs/application";
import type { NotificationProjector } from "@lemma/notifications/application";
import {
  WORKBOOK_CALCULATION_REQUESTED_EVENT,
  WORKBOOK_CALCULATION_SUCCEEDED_EVENT,
  WORKBOOK_VALIDATION_FAILED_EVENT,
  WORKBOOK_VALIDATION_SUCCEEDED_EVENT,
} from "@lemma/workbook/domain";
import { OutboxPollingDispatcher } from "./outbox-dispatcher.js";

const at = new Date("2026-06-20T00:00:00.000Z");
const lineage = {
  causationId: null,
  correlationId: "019e9315-6a87-715f-9861-8654df090002",
  requestId: "019e9315-6a87-715f-9861-8654df090001",
};

describe("OutboxPollingDispatcher", () => {
  it("enqueues workbook calculation requested events without source diagnostics", async () => {
    const outboxService = new FakeOutboxService([
      createWorkbookCalculationRequestedEventWithoutSources(),
    ]);
    const jobDispatcher = new FakeJobDispatcher();
    const notificationProjector = new FakeNotificationProjector();
    const sourceArtifactValidationService =
      new FakeSourceArtifactValidationService();
    const dispatcher = new OutboxPollingDispatcher({
      clock: { now: () => at },
      config: {
        batchSize: 1,
        lockTimeoutMs: 10_000,
        maxAttempts: 3,
        pollIntervalMs: 1_000,
        queueRetryDelaySeconds: 15,
        queueRetryLimit: 10,
        retryDelayMs: 30_000,
        workerId: "worker-1",
      },
      jobDispatcher: jobDispatcher as unknown as JobDispatcher,
      notificationProjector:
        notificationProjector as unknown as NotificationProjector,
      outboxService: outboxService as unknown as OutboxService,
      sourceArtifactValidationService,
    });

    assert.equal(await dispatcher.runOnce(), 1);
    assert.deepEqual(jobDispatcher.workbookCalculationEnqueueCalls, [
      {
        workbookCalculationId: "019e9315-6a87-715f-9861-8654df090005",
      },
    ]);
    assert.equal(outboxService.failedCalls.length, 0);
    assert.equal(notificationProjector.projectEventCalls, 0);
    assert.equal(notificationProjector.publishCalls, 0);
    assert.equal(outboxService.publishedCalls.length, 1);
  });

  it("routes finished calculation without source summaries", async () => {
    const outboxService = new FakeOutboxService([
      createWorkbookCalculationSucceededEventWithoutSources(),
    ]);
    const jobDispatcher = new FakeJobDispatcher();
    const sourceArtifactValidationService =
      new FakeSourceArtifactValidationService();
    const dispatcher = new OutboxPollingDispatcher({
      clock: { now: () => at },
      config: {
        batchSize: 1,
        lockTimeoutMs: 10_000,
        maxAttempts: 3,
        pollIntervalMs: 1_000,
        queueRetryDelaySeconds: 15,
        queueRetryLimit: 10,
        retryDelayMs: 30_000,
        workerId: "worker-1",
      },
      jobDispatcher: jobDispatcher as unknown as JobDispatcher,
      notificationProjector:
        new FakeNotificationProjector() as unknown as NotificationProjector,
      outboxService: outboxService as unknown as OutboxService,
      sourceArtifactValidationService,
    });

    assert.equal(await dispatcher.runOnce(), 1);
    assert.deepEqual(jobDispatcher.questionGenerationEnqueueCalls, [
      {
        eventWorkbookSnapshotIds: ["019e9315-6a87-715f-9861-8654df090007"],
        questionGenerationRunId: "019e9315-6a87-715f-9861-8654df090006",
        workbookCalculationId: "019e9315-6a87-715f-9861-8654df090005",
      },
    ]);
    assert.equal(outboxService.failedCalls.length, 0);
  });

  it("applies workbook validation succeeded events to source artifacts", async () => {
    const outboxService = new FakeOutboxService([
      {
        ...createWorkbookValidationSucceededEvent(),
        createdAt: new Date("2026-06-21T00:00:00.000Z"),
      },
    ]);
    const sourceArtifactValidationService =
      new FakeSourceArtifactValidationService();
    const dispatcher = new OutboxPollingDispatcher({
      clock: { now: () => at },
      config: {
        batchSize: 1,
        lockTimeoutMs: 10_000,
        maxAttempts: 3,
        pollIntervalMs: 1_000,
        queueRetryDelaySeconds: 15,
        queueRetryLimit: 10,
        retryDelayMs: 30_000,
        workerId: "worker-1",
      },
      jobDispatcher: new FakeJobDispatcher() as unknown as JobDispatcher,
      notificationProjector:
        new FakeNotificationProjector() as unknown as NotificationProjector,
      outboxService: outboxService as unknown as OutboxService,
      sourceArtifactValidationService,
    });

    assert.equal(await dispatcher.runOnce(), 1);
    assert.deepEqual(sourceArtifactValidationService.calls, [
      {
        occurredAt: new Date("2026-06-21T00:00:00.000Z"),
        ownerUserId: "019e9315-6a87-715f-9861-8654df090009",
        status: "valid",
        validationError: null,
        workbookId: "019e9315-6a87-715f-9861-8654df090005",
      },
    ]);
  });

  it("applies workbook validation failed events to source artifacts", async () => {
    const outboxService = new FakeOutboxService([
      {
        ...createWorkbookValidationFailedEvent(),
        createdAt: new Date("2026-06-22T00:00:00.000Z"),
      },
    ]);
    const sourceArtifactValidationService =
      new FakeSourceArtifactValidationService();
    const dispatcher = new OutboxPollingDispatcher({
      clock: { now: () => at },
      config: {
        batchSize: 1,
        lockTimeoutMs: 10_000,
        maxAttempts: 3,
        pollIntervalMs: 1_000,
        queueRetryDelaySeconds: 15,
        queueRetryLimit: 10,
        retryDelayMs: 30_000,
        workerId: "worker-1",
      },
      jobDispatcher: new FakeJobDispatcher() as unknown as JobDispatcher,
      notificationProjector:
        new FakeNotificationProjector() as unknown as NotificationProjector,
      outboxService: outboxService as unknown as OutboxService,
      sourceArtifactValidationService,
    });

    assert.equal(await dispatcher.runOnce(), 1);
    assert.deepEqual(sourceArtifactValidationService.calls, [
      {
        occurredAt: new Date("2026-06-22T00:00:00.000Z"),
        ownerUserId: "019e9315-6a87-715f-9861-8654df090009",
        status: "invalid",
        validationError: "bad workbook",
        workbookId: "019e9315-6a87-715f-9861-8654df090005",
      },
    ]);
  });

  it("records no-op workbook validation projections as processed", async () => {
    const outboxService = new FakeOutboxService([
      createWorkbookValidationSucceededEvent(),
    ]);
    const sourceArtifactValidationService =
      new FakeSourceArtifactValidationService({
        finalizedArtifactCount: 0,
        updatedDraftSourceCount: 0,
      });
    const dispatcher = new OutboxPollingDispatcher({
      clock: { now: () => at },
      config: {
        batchSize: 1,
        lockTimeoutMs: 10_000,
        maxAttempts: 3,
        pollIntervalMs: 1_000,
        queueRetryDelaySeconds: 15,
        queueRetryLimit: 10,
        retryDelayMs: 30_000,
        workerId: "worker-1",
      },
      jobDispatcher: new FakeJobDispatcher() as unknown as JobDispatcher,
      notificationProjector:
        new FakeNotificationProjector() as unknown as NotificationProjector,
      outboxService: outboxService as unknown as OutboxService,
      sourceArtifactValidationService,
    });

    assert.equal(await dispatcher.runOnce(), 1);
    assert.deepEqual(outboxService.recordProcessedEventCalls, [
      {
        consumer: "apply-workbook-validation-result",
        eventId: "019e9315-6a87-715f-9861-8654df090010",
      },
    ]);
  });
});

function createWorkbookCalculationRequestedEventWithoutSources(): OutboxEvent {
  const envelope = domainEventEnvelope({
    aggregate: {
      id: aggregateId("019e9315-6a87-715f-9861-8654df090004"),
      type: aggregateType("workbook_calculation"),
    },
    id: eventId("019e9315-6a87-715f-9861-8654df090003"),
    lineage,
    occurredAt: at,
    payload: {
      workbookCalculationId: "019e9315-6a87-715f-9861-8654df090005",
      // sources intentionally omitted
    },
    schemaVersion: 1,
    type: WORKBOOK_CALCULATION_REQUESTED_EVENT,
  });
  return outboxEventFromEnvelope(envelope);
}

function createWorkbookCalculationSucceededEventWithoutSources(): OutboxEvent {
  return outboxEventFromEnvelope(
    domainEventEnvelope({
      aggregate: {
        id: aggregateId("019e9315-6a87-715f-9861-8654df090005"),
        type: aggregateType("workbook_calculation"),
      },
      id: eventId("019e9315-6a87-715f-9861-8654df090008"),
      lineage,
      occurredAt: at,
      payload: {
        correlationId: "019e9315-6a87-715f-9861-8654df090006",
        errorMessage: null,
        snapshotIds: ["019e9315-6a87-715f-9861-8654df090007"],
        status: "succeeded",
        workbookCalculationId: "019e9315-6a87-715f-9861-8654df090005",
      },
      schemaVersion: 1,
      type: WORKBOOK_CALCULATION_SUCCEEDED_EVENT,
    }),
  );
}

function createWorkbookValidationSucceededEvent(): OutboxEvent {
  return outboxEventFromEnvelope(
    domainEventEnvelope({
      aggregate: {
        id: aggregateId("019e9315-6a87-715f-9861-8654df090005"),
        type: aggregateType("workbook"),
      },
      id: eventId("019e9315-6a87-715f-9861-8654df090010"),
      lineage,
      occurredAt: at,
      ownerUserId: "019e9315-6a87-715f-9861-8654df090009",
      payload: {
        engineVersion: "1.0.0",
        status: "valid",
        validationError: null,
        workbookId: "019e9315-6a87-715f-9861-8654df090005",
      },
      schemaVersion: 1,
      type: WORKBOOK_VALIDATION_SUCCEEDED_EVENT,
    }),
  );
}

function createWorkbookValidationFailedEvent(): OutboxEvent {
  return outboxEventFromEnvelope(
    domainEventEnvelope({
      aggregate: {
        id: aggregateId("019e9315-6a87-715f-9861-8654df090005"),
        type: aggregateType("workbook"),
      },
      id: eventId("019e9315-6a87-715f-9861-8654df090011"),
      lineage,
      occurredAt: at,
      ownerUserId: "019e9315-6a87-715f-9861-8654df090009",
      payload: {
        engineVersion: "1.0.0",
        status: "invalid",
        validationError: "bad workbook",
        workbookId: "019e9315-6a87-715f-9861-8654df090005",
      },
      schemaVersion: 1,
      type: WORKBOOK_VALIDATION_FAILED_EVENT,
    }),
  );
}

class FakeOutboxService {
  readonly failedCalls: Array<{
    eventId: string;
    errorMessage: string;
    retryAt: Date | undefined;
  }> = [];
  readonly publishedCalls: string[] = [];
  readonly recordProcessedEventCalls: Array<{
    consumer: string;
    eventId: string;
  }> = [];

  constructor(private readonly events: OutboxEvent[]) {}

  async appendEvent(event: DomainEventEnvelope): Promise<void> {
    await this.appendEvents([event]);
  }

  async appendEvents(_: readonly DomainEventEnvelope[]): Promise<void> {}

  async claimPendingEvents(input: {
    eventTypes: readonly string[];
    limit: number;
    lockedBy: string;
    staleBefore?: Date;
  }) {
    return this.events.slice(0, input.limit);
  }

  async listFailedEvents(input: { limit: number; cursor?: Date }) {
    void input;
    return [];
  }

  async cleanupPublishedEvents(input: { olderThanMs: number; limit: number }) {
    void input;
    return 0;
  }

  async markEventPublished(input: { eventId: string }) {
    this.publishedCalls.push(input.eventId);
  }

  async markEventFailed(input: {
    eventId: string;
    errorMessage: string;
    retryAt?: Date;
  }) {
    this.failedCalls.push({
      errorMessage: input.errorMessage,
      eventId: input.eventId,
      retryAt: input.retryAt,
    });
  }

  async hasProcessedEvent(_input: { eventId: string; consumer: string }) {
    return false;
  }

  async recordProcessedEvent(_input: { eventId: string; consumer: string }) {
    this.recordProcessedEventCalls.push(_input);
    return {
      processedEvent: {
        consumer: _input.consumer,
        eventId: _input.eventId,
        processedAt: at,
      },
      status: "recorded",
    };
  }
}

class FakeJobDispatcher {
  readonly questionGenerationEnqueueCalls: Array<{
    questionGenerationRunId: string;
    workbookCalculationId: string | null;
    eventWorkbookSnapshotIds: readonly string[];
  }> = [];
  readonly workbookCalculationEnqueueCalls: Array<{
    workbookCalculationId: string;
  }> = [];

  async enqueueQuestionGenerationOrchestration(input: {
    jobId: string;
    questionGenerationRunId: string;
    workbookCalculationId?: string | null;
    eventWorkbookSnapshotIds?: readonly string[];
    lineage: unknown;
    retryLimit?: number;
    retryDelaySeconds?: number;
    [key: string]: unknown;
  }) {
    this.questionGenerationEnqueueCalls.push({
      eventWorkbookSnapshotIds: input.eventWorkbookSnapshotIds ?? [],
      questionGenerationRunId: input.questionGenerationRunId,
      workbookCalculationId: input.workbookCalculationId ?? null,
    });
    return input.jobId;
  }

  async enqueueQuestionGenerationMaterialization(_input: {
    questionGenerationRunId: string;
    lineage: unknown;
    retryLimit?: number;
    retryDelaySeconds?: number;
    [key: string]: unknown;
  }) {
    throw new Error("Unexpected call.");
  }

  async enqueueWorkbookValidation(_input: {
    jobId: string;
    workbookId: string;
    lineage: unknown;
    retryLimit?: number;
    retryDelaySeconds?: number;
    [key: string]: unknown;
  }) {
    throw new Error("Unexpected call.");
  }

  async enqueueWorkbookCalculation(input: {
    workbookCalculationId: string;
    lineage: unknown;
    retryLimit?: number;
    retryDelaySeconds?: number;
    [key: string]: unknown;
  }) {
    this.workbookCalculationEnqueueCalls.push({
      workbookCalculationId: input.workbookCalculationId,
    });
    return input.workbookCalculationId;
  }
}

class FakeNotificationProjector {
  projectEventCalls = 0;
  publishCalls = 0;

  projectEvent(_event: OutboxEvent) {
    this.projectEventCalls += 1;
    return [];
  }

  async publishOutboxEvent(_event: OutboxEvent): Promise<number> {
    this.publishCalls += 1;
    return 0;
  }
}

class FakeSourceArtifactValidationService {
  readonly calls: Array<{
    workbookId: string;
    ownerUserId: string;
    status: "valid" | "invalid";
    validationError: string | null;
    occurredAt: Date;
  }> = [];

  constructor(
    private readonly result: {
      finalizedArtifactCount: number;
      updatedDraftSourceCount: number;
    } = {
      finalizedArtifactCount: 1,
      updatedDraftSourceCount: 1,
    },
  ) {}

  async applyWorkbookValidationResult(input: {
    workbookId: string;
    ownerUserId: string;
    status: "valid" | "invalid";
    validationError: string | null;
    occurredAt: Date;
  }) {
    this.calls.push(input);
    return this.result;
  }
}
