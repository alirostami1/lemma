import type { JsonObject, OperationLineage } from "@lemma/domain";
import type { DomainEventEnvelope } from "./event-envelope.js";
import type {
  AggregateId,
  AggregateType,
  EventId,
  EventType,
  OutboxConsumerName,
} from "./ids.js";
import { assertDate, assertPositiveInteger } from "./primitives.js";

export const OUTBOX_EVENT_STATUSES = [
  "pending",
  "publishing",
  "published",
  "failed",
] as const;

export type OutboxEventStatus = (typeof OUTBOX_EVENT_STATUSES)[number];

export type OutboxEvent<TPayload extends JsonObject = JsonObject> = {
  id: EventId;
  eventType: EventType;
  schemaVersion: number;
  aggregateType: AggregateType;
  aggregateId: AggregateId;
  ownerUserId: string | null;
  lineage: OperationLineage;
  payload: TPayload;
  status: OutboxEventStatus;
  availableAt: Date;
  attempts: number;
  lockedBy: string | null;
  lockedAt: Date | null;
  publishedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ProcessedEvent = {
  eventId: EventId;
  consumer: OutboxConsumerName;
  processedAt: Date;
};

export function outboxEventStatus(value: unknown): OutboxEventStatus {
  if (typeof value !== "string" || !isOutboxEventStatus(value)) {
    throw new TypeError("outbox event status is invalid.");
  }
  return value;
}

export function outboxEventFromEnvelope<TPayload extends JsonObject>(
  envelope: DomainEventEnvelope<TPayload>,
): OutboxEvent<TPayload> {
  return {
    aggregateId: envelope.aggregate.id,
    aggregateType: envelope.aggregate.type,
    attempts: 0,
    availableAt: envelope.occurredAt,
    createdAt: envelope.occurredAt,
    eventType: envelope.type,
    id: envelope.id,
    lastError: null,
    lineage: envelope.lineage,
    lockedAt: null,
    lockedBy: null,
    ownerUserId: envelope.ownerUserId ?? null,
    payload: envelope.payload,
    publishedAt: null,
    schemaVersion: envelope.schemaVersion,
    status: "pending",
    updatedAt: envelope.occurredAt,
  };
}

export function assertOutboxEventAttempts(value: unknown): number {
  if (value === 0) {
    return 0;
  }
  return assertPositiveInteger(value, "attempts");
}

export function assertOutboxEventDate(value: unknown, fieldName: string): Date {
  return assertDate(value, fieldName);
}

function isOutboxEventStatus(value: string): value is OutboxEventStatus {
  return OUTBOX_EVENT_STATUSES.includes(value as OutboxEventStatus);
}
