import {
  instrumentService,
  type OperationAttributes,
  type OperationLineageLike,
} from "@lemma/observability";
import type { DomainEventEnvelope } from "../domain/event-envelope.js";
import type { EventId, OutboxConsumerName } from "../domain/ids.js";
import type { OutboxEvent } from "../domain/outbox-event.js";
import type { Clock, OutboxRepository, ProcessedEventResult } from "./ports.js";

const instrumentation = instrumentService("events", "outbox");

export class OutboxService {
  constructor(
    private readonly deps: {
      outboxRepository: OutboxRepository;
      clock: Clock;
    },
  ) {}

  async appendEvent(event: DomainEventEnvelope): Promise<void> {
    await this.appendEvents([event]);
  }

  async appendEvents(events: readonly DomainEventEnvelope[]): Promise<void> {
    return this.operation(
      "append_events",
      {
        "events.count": events.length,
      },
      async () => {
        if (events.length === 0) {
          return;
        }
        await this.deps.outboxRepository.appendEvents(events);
      },
      events[0]?.lineage ?? null,
    );
  }

  async claimPendingEvents(input: {
    eventTypes: readonly string[];
    limit: number;
    lockedBy: string;
    staleBefore?: Date;
  }): Promise<OutboxEvent[]> {
    return this.operation("claim_pending_events", {}, () =>
      this.deps.outboxRepository.claimPendingEvents({
        ...input,
        lockedAt: this.deps.clock.now(),
      }),
    );
  }

  async markEventPublished(eventId: EventId): Promise<void> {
    await this.operation("mark_event_published", {}, () =>
      this.deps.outboxRepository.markEventPublished({
        eventId,
        publishedAt: this.deps.clock.now(),
      }),
    );
  }

  async markEventFailed(input: {
    eventId: EventId;
    errorMessage: string;
    retryAt?: Date;
  }): Promise<void> {
    await this.operation("mark_event_failed", {}, () =>
      this.deps.outboxRepository.markEventFailed({
        ...input,
        failedAt: this.deps.clock.now(),
      }),
    );
  }

  async listFailedEvents(input: {
    limit: number;
    cursor?: Date;
  }): Promise<OutboxEvent[]> {
    return this.operation("list_failed_events", {}, () => {
      if (input.limit <= 0) {
        return Promise.resolve([]);
      }
      return this.deps.outboxRepository.listFailedEvents(input);
    });
  }

  async cleanupPublishedEvents(input: {
    olderThanMs: number;
    limit: number;
  }): Promise<number> {
    return this.operation("cleanup_published_events", {}, () => {
      if (input.olderThanMs <= 0 || input.limit <= 0) {
        return Promise.resolve(0);
      }
      const now = this.deps.clock.now();
      return this.deps.outboxRepository.deletePublishedEventsBefore({
        limit: input.limit,
        publishedBefore: new Date(now.getTime() - input.olderThanMs),
      });
    });
  }

  async hasProcessedEvent(input: {
    eventId: EventId;
    consumer: OutboxConsumerName;
  }): Promise<boolean> {
    return this.operation("has_processed_event", {}, () =>
      this.deps.outboxRepository.hasProcessedEvent(input),
    );
  }

  async recordProcessedEvent(input: {
    eventId: EventId;
    consumer: OutboxConsumerName;
  }): Promise<ProcessedEventResult> {
    return this.operation("record_processed_event", {}, async () => {
      const processedAt = this.deps.clock.now();
      const inserted = await this.deps.outboxRepository.recordProcessedEvent({
        ...input,
        processedAt,
      });
      if (!inserted) {
        return { status: "already_processed" };
      }
      return {
        processedEvent: {
          ...input,
          processedAt,
        },
        status: "recorded",
      };
    });
  }

  private async operation<T>(
    operation: string,
    attributes: OperationAttributes,
    fn: () => Promise<T>,
    lineage: OperationLineageLike | null = null,
  ): Promise<T> {
    return instrumentation.run(operation, { attributes, lineage }, fn);
  }
}
