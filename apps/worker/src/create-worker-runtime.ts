import { createDatabase, type DatabasePort } from "@lemma/db";
import { OutboxService } from "@lemma/events/application";
import { eventId as toEventId } from "@lemma/events/domain";
import { createKyselyOutboxRepository } from "@lemma/events/infrastructure";
import {
  fileId as toFileId,
  fileUploadId as toFileUploadId,
} from "@lemma/files/domain";
import { createFilesModule } from "@lemma/files/module";
import { JobDispatcher } from "@lemma/jobs/application";
import { PgBossJobQueue } from "@lemma/jobs/infrastructure";
import { NotificationProjector } from "@lemma/notifications/application";
import { CentrifugoRealtimePublisher } from "@lemma/notifications/infrastructure";
import {
  QuestionGenerationWorkerService,
  WorkbookQuestionValueResolverAdapter,
} from "@lemma/questions/application";
import {
  questionBlueprintId as toQuestionBlueprintId,
  questionBlueprintVersionId as toQuestionBlueprintVersionId,
  questionGenerationRunId as toQuestionGenerationRunId,
  questionId as toQuestionId,
  questionSetId as toQuestionSetId,
} from "@lemma/questions/domain";
import { KyselyQuestionsRepository } from "@lemma/questions/infrastructure";
import {
  workbookCalculationId as toWorkbookCalculationId,
  workbookId as toWorkbookId,
  workbookSnapshotId as toWorkbookSnapshotId,
} from "@lemma/workbook/domain";
import { createWorkbookModule } from "@lemma/workbook/module";
import { v7 as uuidv7 } from "uuid";
import type { Config } from "./config.js";
import { config as defaultConfig } from "./config.js";
import {
  FailedQueueJobReconciler,
  KyselyFailedQueueJobReconciliationRepository,
} from "./failed-queue-job-reconciler.js";
import { WorkerOperationalMetrics } from "./operational-metrics.js";
import { OutboxCleanupScheduler } from "./outbox-cleanup.js";
import { OutboxPollingDispatcher } from "./outbox-dispatcher.js";
import { registerQuestionGenerationWorker } from "./question-generation-worker.js";
import {
  registerWorkbookCalculationWorker,
  registerWorkbookValidationWorker,
} from "./workbook-worker.js";

export type WorkerRuntime = {
  start(): Promise<void>;
  stop(): Promise<void>;
};

export function createWorkerRuntime(
  config: Config = defaultConfig,
): WorkerRuntime {
  const { db } = createDatabase(config.databaseUrl);
  const database: DatabasePort = {
    executor: db,
    transaction: (fn) => db.transaction().execute((tx) => fn(tx)),
  };
  const clock = {
    now: () => new Date(),
  };
  const jobQueue = new PgBossJobQueue({
    connectionString: config.databaseUrl,
    applicationName: config.workerId,
  });
  const notificationProjector = new NotificationProjector({
    realtimePublisher: new CentrifugoRealtimePublisher({
      apiUrl: config.realtime.httpApiUrl,
      apiKey: config.realtime.httpApiKey,
    }),
  });
  const outboxService = new OutboxService({
    outboxRepository: createKyselyOutboxRepository(database.executor),
    clock,
  });
  const jobDispatcher = new JobDispatcher({ jobQueue });
  const filesModule = createFilesModule({
    db: database.executor,
    requireIdentity: unsupportedRequireIdentity,
    idGenerator: {
      fileId: () => toFileId(uuidv7()),
      fileUploadId: () => toFileUploadId(uuidv7()),
    },
    clock,
    config: {
      bucket: config.s3.bucket,
      uploadUrlExpiresInSeconds: config.s3.uploadUrlExpiresInSeconds,
      downloadUrlExpiresInSeconds: config.s3.downloadUrlExpiresInSeconds,
    },
    storageConfig: config.s3,
  });
  const workbookModule = createWorkbookModule({
    db: database,
    requireIdentity: unsupportedRequireIdentity,
    fileProvider: {
      getWorkbookFileMetadata: async (input) => {
        const file =
          await filesModule.fileContentReaderPort.getFileContentMetadata(input);
        return {
          fileId: file.fileId,
          originalName: file.originalName,
          contentType: file.contentType,
          byteSize: file.byteSize,
          checksumSha256: file.checksumSha256,
        };
      },
      getWorkbookFileMetadataForOwnerUserId: async (input) => {
        const file =
          await filesModule.fileContentReaderPort.getFileContentMetadataForOwnerUserId(
            input,
          );
        return {
          fileId: file.fileId,
          originalName: file.originalName,
          contentType: file.contentType,
          byteSize: file.byteSize,
          checksumSha256: file.checksumSha256,
        };
      },
      readWorkbookFileContent: async (input) => {
        const file =
          await filesModule.fileContentReaderPort.readFileContent(input);
        return {
          fileId: file.fileId,
          originalName: file.originalName,
          contentType: file.contentType,
          byteSize: file.byteSize,
          checksumSha256: file.checksumSha256,
          bytes: file.bytes,
        };
      },
      readWorkbookFileContentForOwnerUserId: async (input) => {
        const file =
          await filesModule.fileContentReaderPort.readFileContentForOwnerUserId(
            input,
          );
        return {
          fileId: file.fileId,
          originalName: file.originalName,
          contentType: file.contentType,
          byteSize: file.byteSize,
          checksumSha256: file.checksumSha256,
          bytes: file.bytes,
        };
      },
    },
    workbookConfig: config.workbook,
    idGenerator: {
      eventId: () => toEventId(uuidv7()),
      workbookId: () => toWorkbookId(uuidv7()),
      workbookCalculationId: () => toWorkbookCalculationId(uuidv7()),
      workbookSnapshotId: () => toWorkbookSnapshotId(uuidv7()),
    },
    clock,
  });
  const questionsRepository = new KyselyQuestionsRepository(database.executor);
  const questionGenerationWorkerService = new QuestionGenerationWorkerService({
    questionsRepository,
    questionValueResolverPort: new WorkbookQuestionValueResolverAdapter({
      workbookSnapshotResolverPort: workbookModule.workbookSnapshotResolverPort,
      workbookInternalSnapshotResolverPort:
        workbookModule.workbookInternalSnapshotResolverPort,
    }),
    workbookCalculationPort: workbookModule.workbookCalculationPort,
    questionGenerationTransaction: {
      transaction: (fn) =>
        database.transaction((tx) =>
          fn({
            questionsRepository: new KyselyQuestionsRepository(tx),
            outboxRepository: createKyselyOutboxRepository(tx),
          }),
        ),
    },
    idGenerator: {
      questionSetId: () => toQuestionSetId(uuidv7()),
      questionBlueprintId: () => toQuestionBlueprintId(uuidv7()),
      questionBlueprintVersionId: () =>
        toQuestionBlueprintVersionId(uuidv7()),
      questionId: () => toQuestionId(uuidv7()),
      questionGenerationRunId: () => toQuestionGenerationRunId(uuidv7()),
      eventId: () => toEventId(uuidv7()),
    },
    clock,
  });
  const outboxDispatcher = new OutboxPollingDispatcher({
    outboxService,
    jobDispatcher,
    notificationProjector,
    clock,
    config: {
      workerId: config.workerId,
      batchSize: config.outbox.batchSize,
      pollIntervalMs: config.outbox.pollIntervalMs,
      lockTimeoutMs: config.outbox.lockTimeoutMs,
      retryDelayMs: config.outbox.retryDelayMs,
      maxAttempts: config.outbox.maxAttempts,
      queueRetryLimit: config.queue.retryLimit,
      queueRetryDelaySeconds: config.queue.retryDelaySeconds,
    },
  });
  const outboxCleanupScheduler = new OutboxCleanupScheduler({
    outboxService,
    config: config.outboxCleanup,
  });
  const failedQueueJobReconciler = new FailedQueueJobReconciler({
    repository: new KyselyFailedQueueJobReconciliationRepository(database),
    questionGenerationWorkerService,
    clock,
    config: {
      workerId: config.workerId,
      batchSize: config.queue.failedJobReconcileBatchSize,
      intervalMs: config.queue.failedJobReconcileIntervalMs,
      lockTimeoutMs: config.queue.failedJobReconcileLockTimeoutMs,
    },
  });
  const operationalMetrics = new WorkerOperationalMetrics({
    db: database,
    clock,
  });
  let unregisterQuestionGenerationWorker: (() => Promise<void>) | undefined;
  let unregisterWorkbookValidationWorker: (() => Promise<void>) | undefined;
  let unregisterWorkbookCalculationWorker: (() => Promise<void>) | undefined;

  return {
    async start() {
      await jobQueue.start();
      const questionGenerationRegistration =
        await registerQuestionGenerationWorker({
          jobQueue,
          jobDispatcher,
          questionGenerationWorkerService,
          concurrency: config.queue.questionGenerationConcurrency,
          retryLimit: config.queue.retryLimit,
          retryDelaySeconds: config.queue.retryDelaySeconds,
        });
      const workbookValidationRegistration =
        await registerWorkbookValidationWorker({
          jobQueue,
          workbookService: workbookModule.workbookService,
          concurrency: config.queue.workbookValidationConcurrency,
        });
      const workbookCalculationRegistration =
        await registerWorkbookCalculationWorker({
          jobQueue,
          workbookCalculationService:
            workbookModule.workbookCalculationService,
          concurrency: config.queue.workbookCalculationConcurrency,
        });
      unregisterQuestionGenerationWorker =
        questionGenerationRegistration.unregister;
      unregisterWorkbookValidationWorker =
        workbookValidationRegistration.unregister;
      unregisterWorkbookCalculationWorker =
        workbookCalculationRegistration.unregister;
      outboxDispatcher.start();
      outboxCleanupScheduler.start();
      failedQueueJobReconciler.start();
      operationalMetrics.start();
    },
    async stop() {
      operationalMetrics.stop();
      failedQueueJobReconciler.stop();
      outboxCleanupScheduler.stop();
      outboxDispatcher.stop();
      if (unregisterQuestionGenerationWorker) {
        await unregisterQuestionGenerationWorker();
      }
      if (unregisterWorkbookValidationWorker) {
        await unregisterWorkbookValidationWorker();
      }
      if (unregisterWorkbookCalculationWorker) {
        await unregisterWorkbookCalculationWorker();
      }
      await jobQueue.stop();
      await db.destroy();
    },
  };
}

function unsupportedRequireIdentity(): never {
  throw new Error("Worker runtime does not expose HTTP routes.");
}
