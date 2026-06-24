import {
  type JsonObject,
  type OperationLineage,
  operationLineage,
} from "@lemma/domain";
import {
  type AggregateId,
  type AggregateType,
  aggregateId,
  aggregateType,
  type EventId,
  type EventType,
  eventId,
  eventType,
} from "./ids.js";
import {
  assertDate,
  assertJsonObject,
  assertPositiveInteger,
} from "./primitives.js";

export type DomainEventEnvelope<TPayload extends JsonObject = JsonObject> = {
  id: EventId;
  type: EventType;
  schemaVersion: number;
  aggregate: {
    type: AggregateType;
    id: AggregateId;
  };
  ownerUserId?: string | null;
  lineage: OperationLineage;
  occurredAt: Date;
  payload: TPayload;
};

export type CreateDomainEventEnvelopeInput<
  TPayload extends JsonObject = JsonObject,
> = {
  id: string;
  type: string;
  schemaVersion: number;
  aggregate: {
    type: string;
    id: string;
  };
  ownerUserId?: string | null;
  lineage: OperationLineage;
  occurredAt: Date;
  payload: TPayload;
};

export function domainEventEnvelope<TPayload extends JsonObject>(
  input: CreateDomainEventEnvelopeInput<TPayload>,
): DomainEventEnvelope<TPayload> {
  assertJsonObject(input.payload, "payload");
  return {
    aggregate: {
      id: aggregateId(input.aggregate.id),
      type: aggregateType(input.aggregate.type),
    },
    id: eventId(input.id),
    lineage: operationLineage(input.lineage),
    occurredAt: assertDate(input.occurredAt, "occurredAt"),
    ownerUserId: input.ownerUserId ?? null,
    payload: input.payload,
    schemaVersion: assertPositiveInteger(input.schemaVersion, "schemaVersion"),
    type: eventType(input.type),
  };
}
