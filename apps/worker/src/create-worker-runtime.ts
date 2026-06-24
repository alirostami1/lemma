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
  questionBlueprintDraftId as toQuestionBlueprintDraftId,
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
    applicationName: config.workerId,
    connectionString: config.databaseUrl,
  });
  const notificationProjector = new NotificationProjector({
    realtimePublisher: new CentrifugoRealtimePublisher({
      apiKey: config.realtime.httpApiKey,
      apiUrl: config.realtime.httpApiUrl,
    }),
  });
  const outboxService = new OutboxService({
    clock,
    outboxRepository: createKyselyOutboxRepository(database.executor),
  });
  const jobDispatcher = new JobDispatcher({ jobQueue });
  const filesModule = createFilesModule({
    clock,
    config: {
      bucket: config.s3.bucket,
      downloadUrlExpiresInSeconds: config.s3.downloadUrlExpiresInSeconds,
      uploadUrlExpiresInSeconds: config.s3.uploadUrlExpiresInSeconds,
    },
    db: database.executor,
    idGenerator: {
      fileId: () => toFileId(uuidv7()),
      fileUploadId: () => toFileUploadId(uuidv7()),
    },
    requireIdentity: unsupportedRequireIdentity,
    storageConfig: config.s3,
  });
  const workbookModule = createWorkbookModule({
    clock,
    db: database,
    fileProvider: {
      getWorkbookFileMetadata: async (input) => {
        const file =
          await filesModule.fileContentReaderPort.getFileContentMetadata(input);
        return {
          byteSize: file.byteSize,
          checksumSha256: file.checksumSha256,
          contentType: file.contentType,
          fileId: file.fileId,
          originalName: file.originalName,
        };
      },
      getWorkbookFileMetadataForOwnerUserId: async (input) => {
        const file =
          await filesModule.fileContentReaderPort.getFileContentMetadataForOwnerUserId(
            input,
          );
        return {
          byteSize: file.byteSize,
          checksumSha256: file.checksumSha256,
          contentType: file.contentType,
          fileId: file.fileId,
          originalName: file.originalName,
        };
      },
      readWorkbookFileContent: async (input) => {
        const file =
          await filesModule.fileContentReaderPort.readFileContent(input);
        return {
          byteSize: file.byteSize,
          bytes: file.bytes,
          checksumSha256: file.checksumSha256,
          contentType: file.contentType,
          fileId: file.fileId,
          originalName: file.originalName,
        };
      },
      readWorkbookFileContentForOwnerUserId: async (input) => {
        const file =
          await filesModule.fileContentReaderPort.readFileContentForOwnerUserId(
            input,
          );
        return {
          byteSize: file.byteSize,
          bytes: file.bytes,
          checksumSha256: file.checksumSha256,
          contentType: file.contentType,
          fileId: file.fileId,
          originalName: file.originalName,
        };
      },
    },
    idGenerator: {
      eventId: () => toEventId(uuidv7()),
      workbookCalculationId: () => toWorkbookCalculationId(uuidv7()),
      workbookId: () => toWorkbookId(uuidv7()),
      workbookSnapshotId: () => toWorkbookSnapshotId(uuidv7()),
    },
    requireIdentity: unsupportedRequireIdentity,
    workbookConfig: config.workbook,
  });
  const questionsRepository = new KyselyQuestionsRepository(database.executor);
  const questionGenerationWorkerService = new QuestionGenerationWorkerService({
    clock,
    idGenerator: {
      eventId: () => toEventId(uuidv7()),
      questionBlueprintDraftId: () => toQuestionBlueprintDraftId(uuidv7()),
      questionBlueprintId: () => toQuestionBlueprintId(uuidv7()),
      questionBlueprintVersionId: () => toQuestionBlueprintVersionId(uuidv7()),
      questionGenerationRunId: () => toQuestionGenerationRunId(uuidv7()),
      questionId: () => toQuestionId(uuidv7()),
      questionSetId: () => toQuestionSetId(uuidv7()),
    },
    questionGenerationTransaction: {
      transaction: (fn) =>
        database.transaction((tx) =>
          fn({
            outboxRepository: createKyselyOutboxRepository(tx),
            questionsRepository: new KyselyQuestionsRepository(tx),
          }),
        ),
    },
    questionsRepository,
    questionValueResolverPort: new WorkbookQuestionValueResolverAdapter({
      workbookInternalSnapshotResolverPort:
        workbookModule.workbookInternalSnapshotResolverPort,
      workbookSnapshotResolverPort: workbookModule.workbookSnapshotResolverPort,
    }),
    workbookCalculationPort: workbookModule.workbookCalculationPort,
    workbookSnapshotReadPort: workbookModule.workbookSnapshotReadPort,
  });
  const outboxDispatcher = new OutboxPollingDispatcher({
    clock,
    config: {
      batchSize: config.outbox.batchSize,
      lockTimeoutMs: config.outbox.lockTimeoutMs,
      maxAttempts: config.outbox.maxAttempts,
      pollIntervalMs: config.outbox.pollIntervalMs,
      queueRetryDelaySeconds: config.queue.retryDelaySeconds,
      queueRetryLimit: config.queue.retryLimit,
      retryDelayMs: config.outbox.retryDelayMs,
      workerId: config.workerId,
    },
    jobDispatcher,
    notificationProjector,
    outboxService,
  });
  const outboxCleanupScheduler = new OutboxCleanupScheduler({
    config: config.outboxCleanup,
    outboxService,
  });
  const failedQueueJobReconciler = new FailedQueueJobReconciler({
    clock,
    config: {
      batchSize: config.queue.failedJobReconcileBatchSize,
      intervalMs: config.queue.failedJobReconcileIntervalMs,
      lockTimeoutMs: config.queue.failedJobReconcileLockTimeoutMs,
      workerId: config.workerId,
    },
    questionGenerationWorkerService,
    repository: new KyselyFailedQueueJobReconciliationRepository(database),
  });
  const operationalMetrics = new WorkerOperationalMetrics({
    clock,
    db: database,
  });
  let unregisterQuestionGenerationWorker: (() => Promise<void>) | undefined;
  let unregisterWorkbookValidationWorker: (() => Promise<void>) | undefined;
  let unregisterWorkbookCalculationWorker: (() => Promise<void>) | undefined;

  return {
    async start() {
      await jobQueue.start();
      const questionGenerationRegistration =
        await registerQuestionGenerationWorker({
          concurrency: config.queue.questionGenerationConcurrency,
          jobDispatcher,
          jobQueue,
          questionGenerationWorkerService,
          retryDelaySeconds: config.queue.retryDelaySeconds,
          retryLimit: config.queue.retryLimit,
        });
      const workbookValidationRegistration =
        await registerWorkbookValidationWorker({
          concurrency: config.queue.workbookValidationConcurrency,
          jobQueue,
          workbookService: workbookModule.workbookService,
        });
      const workbookCalculationRegistration =
        await registerWorkbookCalculationWorker({
          concurrency: config.queue.workbookCalculationConcurrency,
          jobQueue,
          workbookCalculationService: workbookModule.workbookCalculationService,
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
