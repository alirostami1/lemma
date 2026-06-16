import type { JsonObject, OperationLineage } from "@lemma/domain";

export type RealtimeNotificationMessage = JsonObject & {
  schemaVersion: 1;
  eventId: string;
  eventType: string;
  lineage: OperationLineage;
  aggregate: JsonObject & {
    type: string;
    id: string;
  };
  payload: JsonObject;
  occurredAt: string;
};
