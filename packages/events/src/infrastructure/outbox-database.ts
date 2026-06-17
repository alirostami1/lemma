import type { JsonObject } from "@lemma/domain";
import type { ColumnType, Generated, Kysely, Transaction } from "kysely";

export type OutboxDatabaseExecutor =
  | Kysely<OutboxDatabase>
  | Transaction<OutboxDatabase>;

export interface OutboxDatabase {
  outboxEvents: OutboxEventsTable;
  processedEvents: ProcessedEventsTable;
}

export type TimestampColumn = ColumnType<Date, Date | string, Date | string>;
export type NullableTimestampColumn = ColumnType<
  Date | null,
  Date | string | null | undefined,
  Date | string | null
>;

export interface OutboxEventsTable {
  id: string;
  eventType: string;
  schemaVersion: number;
  aggregateType: string;
  aggregateId: string;
  ownerUserId: string | null;
  requestId: string;
  correlationId: string;
  causationId: string | null;
  payload: JsonObject;
  status: Generated<string>;
  availableAt: TimestampColumn;
  attempts: Generated<number>;
  lockedBy: string | null;
  lockedAt: NullableTimestampColumn;
  publishedAt: NullableTimestampColumn;
  lastError: string | null;
  createdAt: TimestampColumn;
  updatedAt: TimestampColumn;
}

export interface ProcessedEventsTable {
  eventId: string;
  consumer: string;
  processedAt: TimestampColumn;
}
