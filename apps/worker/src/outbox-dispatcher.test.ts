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

class FakeOutboxService {
  readonly failedCalls: Array<{
    eventId: string;
    errorMessage: string;
    retryAt: Date | undefined;
  }> = [];
  readonly publishedCalls: string[] = [];

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
