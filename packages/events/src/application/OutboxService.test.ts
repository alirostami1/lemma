import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  type DomainEventEnvelope,
  domainEventEnvelope,
} from "../domain/event-envelope.js";
import type { EventId, OutboxConsumerName } from "../domain/ids.js";
import { eventId, outboxConsumerName } from "../domain/ids.js";
import type { OutboxEvent } from "../domain/outbox-event.js";
import { outboxEventFromEnvelope } from "../domain/outbox-event.js";
import { OutboxService } from "./OutboxService.js";
import type {
  DeletePublishedEventsBeforeInput,
  ListFailedEventsInput,
  OutboxRepository,
  RecordProcessedEventInput,
} from "./ports.js";

const now = new Date("2026-06-14T00:00:00.000Z");
const lineage = {
  requestId: "019e9315-6a87-715f-9861-8654df070c74",
  correlationId: "019e9315-6a87-715f-9861-8654df070c74",
  causationId: null,
};
const event = domainEventEnvelope({
  id: "019e9315-6a87-715f-9861-8654df070c70",
  type: "question_generation.run_requested.v1",
  schemaVersion: 1,
  aggregate: {
    type: "question_generation_run",
    id: "019e9315-6a87-715f-9861-8654df070c71",
  },
  ownerUserId: "019e9315-6a87-715f-9861-8654df070c72",
  lineage,
  occurredAt: now,
  payload: {
    questionGenerationRunId: "019e9315-6a87-715f-9861-8654df070c71",
  },
});

describe("OutboxService", () => {
  it("appends events through the repository", async () => {
    const repository = new InMemoryOutboxRepository();
    const service = new OutboxService({
      outboxRepository: repository,
      clock: { now: () => now },
    });

    await service.appendEvent(event);

    assert.deepEqual(
      repository.events.map((item) => item.id),
      [event.id],
    );
  });

  it("records processed events once per consumer", async () => {
    const repository = new InMemoryOutboxRepository();
    const service = new OutboxService({
      outboxRepository: repository,
      clock: { now: () => now },
    });
    const input = {
      eventId: eventId("019e9315-6a87-715f-9861-8654df070c70"),
      consumer: outboxConsumerName("queue-question-generation"),
    };

    assert.equal(
      (await service.recordProcessedEvent(input)).status,
      "recorded",
    );
    assert.equal(
      (await service.recordProcessedEvent(input)).status,
      "already_processed",
    );
    assert.equal(await service.hasProcessedEvent(input), true);
  });

  it("lists failed events for review", async () => {
    const repository = new InMemoryOutboxRepository();
    const service = new OutboxService({
      outboxRepository: repository,
      clock: { now: () => now },
    });
    const failedEvent = {
      ...outboxEventFromEnvelope(event),
      id: eventId("019e9315-6a87-715f-9861-8654df070c73"),
      status: "failed" as const,
      updatedAt: new Date("2026-06-13T00:00:00.000Z"),
    };
    repository.events.push(outboxEventFromEnvelope(event), failedEvent);

    assert.deepEqual(
      (await service.listFailedEvents({ limit: 10 })).map((item) => item.id),
      [failedEvent.id],
    );
  });

  it("cleans up old published events", async () => {
    const repository = new InMemoryOutboxRepository();
    const service = new OutboxService({
      outboxRepository: repository,
      clock: { now: () => now },
    });
    const oldPublishedEvent = {
      ...outboxEventFromEnvelope(event),
      id: eventId("019e9315-6a87-715f-9861-8654df070c74"),
      status: "published" as const,
      publishedAt: new Date("2026-06-06T00:00:00.000Z"),
    };
    const recentPublishedEvent = {
      ...outboxEventFromEnvelope(event),
      id: eventId("019e9315-6a87-715f-9861-8654df070c75"),
      status: "published" as const,
      publishedAt: new Date("2026-06-13T00:00:00.000Z"),
    };
    repository.events.push(oldPublishedEvent, recentPublishedEvent);

    assert.equal(
      await service.cleanupPublishedEvents({
        olderThanMs: 7 * 24 * 60 * 60 * 1_000,
        limit: 10,
      }),
      1,
    );
    assert.deepEqual(
      repository.events.map((item) => item.id),
      [recentPublishedEvent.id],
    );
  });
});

class InMemoryOutboxRepository implements OutboxRepository {
  readonly events: OutboxEvent[] = [];
  private readonly processed = new Set<string>();

  async appendEvents(events: readonly DomainEventEnvelope[]): Promise<void> {
    this.events.push(...events.map(outboxEventFromEnvelope));
  }

  async claimPendingEvents(): Promise<OutboxEvent[]> {
    return [];
  }

  async markEventPublished(): Promise<void> {}

  async markEventFailed(): Promise<void> {}

  async findEventById(id: EventId): Promise<OutboxEvent | null> {
    return this.events.find((event) => event.id === id) ?? null;
  }

  async listFailedEvents(input: ListFailedEventsInput): Promise<OutboxEvent[]> {
    return this.events
      .filter(
        (event) =>
          event.status === "failed" &&
          (!input.cursor || event.updatedAt < input.cursor),
      )
      .sort(
        (left, right) => right.updatedAt.getTime() - left.updatedAt.getTime(),
      )
      .slice(0, input.limit);
  }

  async deletePublishedEventsBefore(
    input: DeletePublishedEventsBeforeInput,
  ): Promise<number> {
    let deleted = 0;
    const remaining: OutboxEvent[] = [];
    for (const event of this.events) {
      const shouldDelete =
        deleted < input.limit &&
        event.status === "published" &&
        event.publishedAt !== null &&
        event.publishedAt < input.publishedBefore;
      if (shouldDelete) {
        deleted += 1;
        continue;
      }
      remaining.push(event);
    }
    this.events.splice(0, this.events.length, ...remaining);
    return deleted;
  }

  async hasProcessedEvent(input: {
    eventId: EventId;
    consumer: OutboxConsumerName;
  }): Promise<boolean> {
    return this.processed.has(processedKey(input));
  }

  async recordProcessedEvent(
    input: RecordProcessedEventInput,
  ): Promise<boolean> {
    const key = processedKey(input);
    if (this.processed.has(key)) {
      return false;
    }
    this.processed.add(key);
    return true;
  }
}

function processedKey(input: {
  eventId: EventId;
  consumer: OutboxConsumerName;
}) {
  return `${input.consumer}:${input.eventId}`;
}
