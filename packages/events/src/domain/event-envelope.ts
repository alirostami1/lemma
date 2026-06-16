import {
  operationLineage,
  type JsonObject,
  type OperationLineage,
} from "@lemma/domain";
import {
  aggregateId,
  aggregateType,
  eventId,
  eventType,
  type AggregateId,
  type AggregateType,
  type EventId,
  type EventType,
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
    id: eventId(input.id),
    type: eventType(input.type),
    schemaVersion: assertPositiveInteger(
      input.schemaVersion,
      "schemaVersion",
    ),
    aggregate: {
      type: aggregateType(input.aggregate.type),
      id: aggregateId(input.aggregate.id),
    },
    ownerUserId: input.ownerUserId ?? null,
    lineage: operationLineage(input.lineage),
    occurredAt: assertDate(input.occurredAt, "occurredAt"),
    payload: input.payload,
  };
}
