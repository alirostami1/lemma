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
        event,
        consumer: {
          name: consumer,
          eventTypes: [event.eventType],
          async handle() {
            calls += 1;
            return { status: "processed" };
          },
        },
        idempotencyStore: store,
      }),
      { status: "processed" },
    );
    assert.deepEqual(
      await runEventConsumer({
        event,
        consumer: {
          name: consumer,
          eventTypes: [event.eventType],
          async handle() {
            calls += 1;
            return { status: "processed" };
          },
        },
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
        event,
        consumer: {
          name: consumer,
          eventTypes: [event.eventType],
          async handle() {
            return { status: "skipped", reason: "no_work" };
          },
        },
        idempotencyStore: store,
      }),
      { status: "skipped", reason: "no_work" },
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
      resourceId: "resource-1",
      lineage: event.lineage,
    };
    let handled: TestWorkflowData | undefined;

    const consumer = workflowJobConsumer<TestWorkflowData>({
      workflowName: "test",
      stepName: "step",
      jobName: "test.step",
      parsePayload(payload) {
        return { ...payload, parsed: true };
      },
      lineage: (payload) => payload.lineage,
      attributes: (job) => ({ "test.resource_id": job.data.resourceId }),
      async run(job) {
        handled = job.data;
      },
    });
    const parsedData = consumer.parse(data);
    const job = { id: "job-1", name: "test.step", data: parsedData };

    assert.equal(consumer.name, "test.step");
    assert.equal(consumer.spanName, "test.step_job");
    assert.deepEqual(consumer.attributes(job), {
      "workflow.name": "test",
      "workflow.step": "step",
      "operation.request_id": event.lineage.requestId,
      "operation.correlation_id": event.lineage.correlationId,
      "test.resource_id": "resource-1",
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
    id: eventId("019e9315-6a87-715f-9861-8654df070d10"),
    eventType: eventType("test.event"),
    schemaVersion: 1,
    aggregateType: aggregateType("test"),
    aggregateId: aggregateId("aggregate-1"),
    ownerUserId: null,
    lineage: {
      requestId: "019e9315-6a87-715f-9861-8654df070d10",
      correlationId: "019e9315-6a87-715f-9861-8654df070d10",
      causationId: null,
    },
    payload: {},
    status: "pending",
    availableAt: at,
    attempts: 0,
    lockedBy: null,
    lockedAt: null,
    publishedAt: null,
    lastError: null,
    createdAt: at,
    updatedAt: at,
  };
}
