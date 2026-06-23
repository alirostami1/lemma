import type { DomainEventEnvelope } from "../domain/event-envelope.js";
import type { EventId, OutboxConsumerName } from "../domain/ids.js";
import type { OutboxEvent, ProcessedEvent } from "../domain/outbox-event.js";

export type Clock = {
  now(): Date;
};

export type RecordProcessedEventInput = {
  eventId: EventId;
  consumer: OutboxConsumerName;
  processedAt: Date;
};

export type ClaimPendingEventsInput = {
  eventTypes: readonly string[];
  limit: number;
  lockedBy: string;
  lockedAt: Date;
  staleBefore?: Date;
};

export type MarkEventPublishedInput = {
  eventId: EventId;
  publishedAt: Date;
};

export type MarkEventFailedInput = {
  eventId: EventId;
  failedAt: Date;
  errorMessage: string;
  retryAt?: Date;
};

export type ListFailedEventsInput = {
  limit: number;
  cursor?: Date;
};

export type DeletePublishedEventsBeforeInput = {
  publishedBefore: Date;
  limit: number;
};

export interface OutboxRepository {
  appendEvents(events: readonly DomainEventEnvelope[]): Promise<void>;
  claimPendingEvents(input: ClaimPendingEventsInput): Promise<OutboxEvent[]>;
  deletePublishedEventsBefore(
    input: DeletePublishedEventsBeforeInput,
  ): Promise<number>;
  findEventById(eventId: EventId): Promise<OutboxEvent | null>;
  hasProcessedEvent(input: {
    eventId: EventId;
    consumer: OutboxConsumerName;
  }): Promise<boolean>;
  listFailedEvents(input: ListFailedEventsInput): Promise<OutboxEvent[]>;
  markEventFailed(input: MarkEventFailedInput): Promise<void>;
  markEventPublished(input: MarkEventPublishedInput): Promise<void>;
  recordProcessedEvent(input: RecordProcessedEventInput): Promise<boolean>;
}

export type ProcessedEventResult =
  | {
      status: "recorded";
      processedEvent: ProcessedEvent;
    }
  | {
      status: "already_processed";
    };
