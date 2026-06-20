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
import { WORKBOOK_CALCULATION_REQUESTED_EVENT } from "@lemma/workbook/domain";
import { OutboxPollingDispatcher } from "./outbox-dispatcher.js";

const at = new Date("2026-06-20T00:00:00.000Z");
const lineage = {
  requestId: "019e9315-6a87-715f-9861-8654df090001",
  correlationId: "019e9315-6a87-715f-9861-8654df090002",
  causationId: null,
};

describe("OutboxPollingDispatcher", () => {
  it("marks workbook calculation requested events with missing workbookSources as failed", async () => {
    const outboxService = new FakeOutboxService([
      createWorkbookCalculationRequestedEventWithoutSources(),
    ]);
    const jobDispatcher = new FakeJobDispatcher();
    const notificationProjector = new FakeNotificationProjector();
    const dispatcher = new OutboxPollingDispatcher({
      outboxService: outboxService as unknown as OutboxService,
      jobDispatcher: jobDispatcher as unknown as JobDispatcher,
      notificationProjector:
        notificationProjector as unknown as NotificationProjector,
      clock: { now: () => at },
      config: {
        workerId: "worker-1",
        batchSize: 1,
        pollIntervalMs: 1_000,
        lockTimeoutMs: 10_000,
        retryDelayMs: 30_000,
        maxAttempts: 3,
        queueRetryLimit: 10,
        queueRetryDelaySeconds: 15,
      },
    });

    assert.equal(await dispatcher.runOnce(), 1);
    assert.equal(jobDispatcher.workbookCalculationEnqueueCalls.length, 0);
    assert.equal(outboxService.failedCalls.length, 1);
    assert.equal(
      outboxService.failedCalls[0]?.errorMessage.includes(
        "workbook_calculation.requested.v1 payload is missing workbookSources.",
      ),
      true,
    );
    assert.equal(notificationProjector.projectEventCalls, 0);
    assert.equal(notificationProjector.publishCalls, 0);
    assert.equal(outboxService.publishedCalls.length, 0);
  });
});

function createWorkbookCalculationRequestedEventWithoutSources(): OutboxEvent {
  const envelope = domainEventEnvelope({
    id: eventId("019e9315-6a87-715f-9861-8654df090003"),
    type: WORKBOOK_CALCULATION_REQUESTED_EVENT,
    schemaVersion: 1,
    aggregate: {
      type: aggregateType("workbook_calculation"),
      id: aggregateId("019e9315-6a87-715f-9861-8654df090004"),
    },
    lineage,
    occurredAt: at,
    payload: {
      workbookCalculationId: "019e9315-6a87-715f-9861-8654df090005",
      // workbookSources intentionally omitted
    },
  });
  return outboxEventFromEnvelope(envelope);
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
      eventId: input.eventId,
      errorMessage: input.errorMessage,
      retryAt: input.retryAt,
    });
  }

  async hasProcessedEvent(_input: { eventId: string; consumer: string }) {
    return false;
  }

  async recordProcessedEvent(_input: { eventId: string; consumer: string }) {
    return {
      status: "recorded",
      processedEvent: {
        eventId: _input.eventId,
        consumer: _input.consumer,
        processedAt: at,
      },
    };
  }
}

class FakeJobDispatcher {
  readonly workbookCalculationEnqueueCalls: Array<{
    jobId: string;
    workbookCalculationId: string;
  }> = [];

  async enqueueQuestionGenerationOrchestration(_input: {
    jobId: string;
    questionGenerationRunId: string;
    lineage: unknown;
    retryLimit?: number;
    retryDelaySeconds?: number;
    [key: string]: unknown;
  }) {
    throw new Error("Unexpected call.");
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
    jobId: string;
    workbookCalculationId: string;
    workbookSources: {
      sourceId: string;
      workbookId: string;
    }[];
    lineage: unknown;
    retryLimit?: number;
    retryDelaySeconds?: number;
    [key: string]: unknown;
  }) {
    this.workbookCalculationEnqueueCalls.push({
      jobId: input.jobId,
      workbookCalculationId: input.workbookCalculationId,
    });
    return input.jobId;
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
