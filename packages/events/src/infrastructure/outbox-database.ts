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
  aggregateId: string;
  aggregateType: string;
  attempts: Generated<number>;
  availableAt: TimestampColumn;
  causationId: string | null;
  correlationId: string;
  createdAt: TimestampColumn;
  eventType: string;
  id: string;
  lastError: string | null;
  lockedAt: NullableTimestampColumn;
  lockedBy: string | null;
  ownerUserId: string | null;
  payload: JsonObject;
  publishedAt: NullableTimestampColumn;
  requestId: string;
  schemaVersion: number;
  status: Generated<string>;
  updatedAt: TimestampColumn;
}

export interface ProcessedEventsTable {
  consumer: string;
  eventId: string;
  processedAt: TimestampColumn;
}
