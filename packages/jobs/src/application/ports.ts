import type { JsonObject } from "@lemma/domain";

export type QueueJob<TData extends JsonObject = JsonObject> = {
  id: string;
  name: string;
  data: TData;
};

export type QueueWorkerRegistration = {
  unregister(): Promise<void>;
};

export type EnqueueJobInput<TData extends JsonObject = JsonObject> = {
  /**
   * Deterministic idempotency key for the job. Queue adapters must treat
   * duplicate enqueues with the same id as success and return this id.
   */
  id: string;
  name: string;
  data: TData;
  retryLimit?: number;
  retryDelaySeconds?: number;
};

export type RegisterJobHandlerInput<TData extends JsonObject = JsonObject> = {
  name: string;
  batchSize?: number;
  concurrency?: number;
  handler(jobs: readonly QueueJob<TData>[]): Promise<void>;
};

export interface JobQueuePort {
  enqueueJob<TData extends JsonObject>(
    input: EnqueueJobInput<TData>,
  ): Promise<string>;
  registerHandler<TData extends JsonObject>(
    input: RegisterJobHandlerInput<TData>,
  ): Promise<QueueWorkerRegistration>;
  start(): Promise<void>;
  stop(): Promise<void>;
}
