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
  start(): Promise<void>;
  stop(): Promise<void>;
  enqueueJob<TData extends JsonObject>(
    input: EnqueueJobInput<TData>,
  ): Promise<string>;
  registerHandler<TData extends JsonObject>(
    input: RegisterJobHandlerInput<TData>,
  ): Promise<QueueWorkerRegistration>;
}
