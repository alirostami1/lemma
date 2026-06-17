import type { JsonObject } from "@lemma/domain";
import {
  createPinoStructuredLogger,
  errorLogFields,
  instrumentExternal,
} from "@lemma/observability";
import { type ConstructorOptions, type Job, PgBoss } from "pg-boss";
import type {
  EnqueueJobInput,
  JobQueuePort,
  QueueJob,
  QueueWorkerRegistration,
  RegisterJobHandlerInput,
} from "../application/index.js";

export type PgBossJobQueueConfig = {
  connectionString: string;
  applicationName: string;
  schema?: string;
};

const instrumentation = instrumentExternal("jobs", "pg_boss");
const logger = createPinoStructuredLogger("jobs.pg_boss");

export class PgBossJobQueue implements JobQueuePort {
  private readonly boss: PgBoss;

  constructor(config: PgBossJobQueueConfig) {
    const options: ConstructorOptions = {
      connectionString: config.connectionString,
      application_name: config.applicationName,
      schema: config.schema,
    };
    this.boss = new PgBoss(options);
  }

  async start(): Promise<void> {
    await this.pgBossOperation("start", {}, async () => {
      this.boss.on("error", (error) => {
        logger.error("pg-boss runtime error", errorLogFields(error));
      });
      await this.boss.start();
    });
  }

  async stop(): Promise<void> {
    await this.pgBossOperation("stop", {}, () =>
      this.boss.stop({ graceful: true }),
    );
  }

  async enqueueJob<TData extends JsonObject>(
    input: EnqueueJobInput<TData>,
  ): Promise<string> {
    return this.pgBossOperation(
      "enqueue_job",
      { "job.name": input.name },
      async () => {
        try {
          return (
            (await this.boss.send(input.name, input.data, {
              id: input.id,
              singletonKey: input.id,
              retryLimit: input.retryLimit,
              retryDelay: input.retryDelaySeconds,
            })) ?? input.id
          );
        } catch (error) {
          if (isUniqueViolation(error)) {
            return input.id;
          }
          throw error;
        }
      },
    );
  }

  async registerHandler<TData extends JsonObject>(
    input: RegisterJobHandlerInput<TData>,
  ): Promise<QueueWorkerRegistration> {
    return this.pgBossOperation(
      "register_handler",
      { "job.name": input.name },
      async () => {
        await this.boss.createQueue(input.name);
        await this.boss.work<TData>(
          input.name,
          {
            batchSize: input.batchSize ?? 1,
            localConcurrency: input.concurrency ?? 1,
          },
          (jobs) =>
            this.pgBossOperation(
              "handle_job_batch",
              {
                "job.name": input.name,
                "job.batch_size": jobs.length,
              },
              () => input.handler(jobs.map(mapPgBossJob)),
            ),
        );
        return {
          unregister: () =>
            this.pgBossOperation(
              "unregister_handler",
              { "job.name": input.name },
              () => this.boss.offWork(input.name, { wait: true }),
            ),
        };
      },
    );
  }

  private async pgBossOperation<T>(
    operation: string,
    attributes: Record<string, string | number | boolean>,
    fn: () => Promise<T>,
  ): Promise<T> {
    return instrumentation.run(operation, { attributes }, fn);
  }
}

function mapPgBossJob<TData extends JsonObject>(
  job: Job<TData>,
): QueueJob<TData> {
  return {
    id: job.id,
    name: job.name,
    data: job.data,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}
