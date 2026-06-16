import type { Brand } from "@lemma/domain";
import { assertUuidV7 } from "@lemma/domain";
import { assertNonEmptyString } from "./primitives.js";

export type EventId = Brand<string, "EventId">;
export type EventType = Brand<string, "EventType">;
export type AggregateType = Brand<string, "AggregateType">;
export type AggregateId = Brand<string, "AggregateId">;
export type OutboxConsumerName = Brand<string, "OutboxConsumerName">;

export function eventId(value: unknown): EventId {
  if (typeof value !== "string") {
    throw new TypeError("eventId must be a string.");
  }
  return assertUuidV7(value, "eventId") as EventId;
}

export function eventType(value: unknown): EventType {
  return assertNonEmptyString(value, "eventType") as EventType;
}

export function aggregateType(value: unknown): AggregateType {
  return assertNonEmptyString(value, "aggregateType") as AggregateType;
}

export function aggregateId(value: unknown): AggregateId {
  return assertNonEmptyString(value, "aggregateId") as AggregateId;
}

export function outboxConsumerName(value: unknown): OutboxConsumerName {
  return assertNonEmptyString(value, "outboxConsumerName") as OutboxConsumerName;
}
