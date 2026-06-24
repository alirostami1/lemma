import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { JsonObject, OperationLineage } from "@lemma/domain";
import {
  aggregateId,
  aggregateType,
  eventId,
  eventType,
  type OutboxConsumerName,
  type OutboxEvent,
  outboxConsumerName,
} from "@lemma/events/domain";
import {
  type IdempotencyStore,
  nextRetryAt,
  runEventConsumer,
  workflowJobConsumer,
} from "./pipeline.js";

const at = new Date("2026-06-14T00:00:00.000Z");
const consumer = outboxConsumerName("test-consumer");
const event = createOutboxEvent();

describe("pipeline", () => {
  it("runs event consumers once and records processed events", async () => {
    const store = new InMemoryIdempotencyStore();
    let calls = 0;

    assert.deepEqual(
      await runEventConsumer({
        consumer: {
          eventTypes: [event.eventType],
          async handle() {
            calls += 1;
            return { status: "processed" };
          },
          name: consumer,
        },
        event,
        idempotencyStore: store,
      }),
      { status: "processed" },
    );
    assert.deepEqual(
      await runEventConsumer({
        consumer: {
          eventTypes: [event.eventType],
          async handle() {
            calls += 1;
            return { status: "processed" };
          },
          name: consumer,
        },
        event,
        idempotencyStore: store,
      }),
      { status: "already_processed" },
    );

    assert.equal(calls, 1);
    assert.deepEqual(store.processedKeys, [`${event.id}:${consumer}`]);
  });

  it("does not record skipped event consumers as processed", async () => {
    const store = new InMemoryIdempotencyStore();

    assert.deepEqual(
      await runEventConsumer({
        consumer: {
          eventTypes: [event.eventType],
          async handle() {
            return { reason: "no_work", status: "skipped" };
          },
          name: consumer,
        },
        event,
        idempotencyStore: store,
      }),
      { reason: "no_work", status: "skipped" },
    );

    assert.deepEqual(store.processedKeys, []);
  });

  it("calculates retry delay until attempts are exhausted", () => {
    assert.deepEqual(
      nextRetryAt({
        attempts: 2,
        failedAt: at,
        policy: { maxAttempts: 3, retryDelayMs: 5000 },
      }),
      new Date("2026-06-14T00:00:05.000Z"),
    );
    assert.equal(
      nextRetryAt({
        attempts: 3,
        failedAt: at,
        policy: { maxAttempts: 3, retryDelayMs: 5000 },
      }),
      undefined,
    );
  });

  it("creates workflow job consumers with workflow metadata", async () => {
    const data: TestWorkflowData = {
      lineage: event.lineage,
      resourceId: "resource-1",
    };
    let handled: TestWorkflowData | undefined;

    const consumer = workflowJobConsumer<TestWorkflowData>({
      attributes: (job) => ({ "test.resource_id": job.data.resourceId }),
      jobName: "test.step",
      lineage: (payload) => payload.lineage,
      parsePayload(payload) {
        return { ...payload, parsed: true };
      },
      async run(job) {
        handled = job.data;
      },
      stepName: "step",
      workflowName: "test",
    });
    const parsedData = consumer.parse(data);
    const job = { data: parsedData, id: "job-1", name: "test.step" };

    assert.equal(consumer.name, "test.step");
    assert.equal(consumer.spanName, "test.step_job");
    assert.deepEqual(consumer.attributes(job), {
      "operation.correlation_id": event.lineage.correlationId,
      "operation.request_id": event.lineage.requestId,
      "test.resource_id": "resource-1",
      "workflow.name": "test",
      "workflow.step": "step",
    });

    await consumer.handle(job);

    assert.equal(handled?.parsed, true);
  });
});

type TestWorkflowData = JsonObject & {
  resourceId: string;
  parsed?: boolean;
  lineage: OperationLineage;
};

class InMemoryIdempotencyStore implements IdempotencyStore {
  readonly processedKeys: string[] = [];

  async hasProcessedEvent(input: {
    eventId: OutboxEvent["id"];
    consumer: OutboxConsumerName;
  }): Promise<boolean> {
    return this.processedKeys.includes(key(input.eventId, input.consumer));
  }

  async recordProcessedEvent(input: {
    eventId: OutboxEvent["id"];
    consumer: OutboxConsumerName;
  }): Promise<void> {
    this.processedKeys.push(key(input.eventId, input.consumer));
  }
}

function key(eventId: OutboxEvent["id"], consumerName: OutboxConsumerName) {
  return `${eventId}:${consumerName}`;
}

function createOutboxEvent(): OutboxEvent {
  return {
    aggregateId: aggregateId("aggregate-1"),
    aggregateType: aggregateType("test"),
    attempts: 0,
    availableAt: at,
    createdAt: at,
    eventType: eventType("test.event"),
    id: eventId("019e9315-6a87-715f-9861-8654df070d10"),
    lastError: null,
    lineage: {
      causationId: null,
      correlationId: "019e9315-6a87-715f-9861-8654df070d10",
      requestId: "019e9315-6a87-715f-9861-8654df070d10",
    },
    lockedAt: null,
    lockedBy: null,
    ownerUserId: null,
    payload: {},
    publishedAt: null,
    schemaVersion: 1,
    status: "pending",
    updatedAt: at,
  };
}
