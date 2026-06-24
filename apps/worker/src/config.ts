import { randomUUID } from "node:crypto";
import {
  observabilityEnvSchema,
  parseEnv,
  postgresUrlSchema,
  realtimeEnvSchema,
  s3EnvSchema,
  sharedEnvSchema,
  workbookEnvSchema,
} from "@lemma/config";
import { z } from "zod";

const parsed = parseEnv(
  "worker",
  sharedEnvSchema
    .extend(s3EnvSchema.shape)
    .extend(workbookEnvSchema.shape)
    .extend(realtimeEnvSchema.shape)
    .extend(observabilityEnvSchema.shape)
    .extend({
      LEMMA_WORKER_DATABASE_URL: postgresUrlSchema,
      LEMMA_WORKER_FAILED_QUEUE_RECONCILE_BATCH_SIZE: z.coerce
        .number()
        .int()
        .positive()
        .default(25),
      LEMMA_WORKER_FAILED_QUEUE_RECONCILE_INTERVAL_MS: z.coerce
        .number()
        .int()
        .positive()
        .default(10_000),
      LEMMA_WORKER_FAILED_QUEUE_RECONCILE_LOCK_TIMEOUT_MS: z.coerce
        .number()
        .int()
        .positive()
        .default(60_000),
      LEMMA_WORKER_ID: z.string().min(1).default(`worker-${randomUUID()}`),
      LEMMA_WORKER_OUTBOX_BATCH_SIZE: z.coerce
        .number()
        .int()
        .positive()
        .default(25),
      LEMMA_WORKER_OUTBOX_CLEANUP_BATCH_SIZE: z.coerce
        .number()
        .int()
        .positive()
        .default(500),
      LEMMA_WORKER_OUTBOX_CLEANUP_INTERVAL_MS: z.coerce
        .number()
        .int()
        .positive()
        .default(60 * 60 * 1_000),
      LEMMA_WORKER_OUTBOX_LOCK_TIMEOUT_MS: z.coerce
        .number()
        .int()
        .positive()
        .default(60_000),
      LEMMA_WORKER_OUTBOX_MAX_ATTEMPTS: z.coerce
        .number()
        .int()
        .positive()
        .default(10),
      LEMMA_WORKER_OUTBOX_POLL_INTERVAL_MS: z.coerce
        .number()
        .int()
        .positive()
        .default(1_000),
      LEMMA_WORKER_OUTBOX_PUBLISHED_RETENTION_MS: z.coerce
        .number()
        .int()
        .positive()
        .default(7 * 24 * 60 * 60 * 1_000),
      LEMMA_WORKER_OUTBOX_RETRY_DELAY_MS: z.coerce
        .number()
        .int()
        .positive()
        .default(5_000),
      LEMMA_WORKER_QUESTION_GENERATION_CONCURRENCY: z.coerce
        .number()
        .int()
        .positive()
        .default(1),
      LEMMA_WORKER_QUEUE_RETRY_DELAY_SECONDS: z.coerce
        .number()
        .int()
        .nonnegative()
        .default(30),
      LEMMA_WORKER_QUEUE_RETRY_LIMIT: z.coerce
        .number()
        .int()
        .nonnegative()
        .default(3),
      LEMMA_WORKER_WORKBOOK_CALCULATION_CONCURRENCY: z.coerce
        .number()
        .int()
        .positive()
        .default(1),
      LEMMA_WORKER_WORKBOOK_VALIDATION_CONCURRENCY: z.coerce
        .number()
        .int()
        .positive()
        .default(1),
    }),
);

export const config = Object.freeze({
  databaseUrl: parsed.LEMMA_WORKER_DATABASE_URL,
  nodeEnv: parsed.NODE_ENV,
  observability: {
    enabled: parsed.LEMMA_OTEL_ENABLED,
    metricExportIntervalMs: parsed.LEMMA_OTEL_METRIC_EXPORT_INTERVAL_MS,
    otlpEndpoint: parsed.LEMMA_OTEL_EXPORTER_OTLP_ENDPOINT,
  },
  outbox: {
    batchSize: parsed.LEMMA_WORKER_OUTBOX_BATCH_SIZE,
    lockTimeoutMs: parsed.LEMMA_WORKER_OUTBOX_LOCK_TIMEOUT_MS,
    maxAttempts: parsed.LEMMA_WORKER_OUTBOX_MAX_ATTEMPTS,
    pollIntervalMs: parsed.LEMMA_WORKER_OUTBOX_POLL_INTERVAL_MS,
    retryDelayMs: parsed.LEMMA_WORKER_OUTBOX_RETRY_DELAY_MS,
  },
  outboxCleanup: {
    batchSize: parsed.LEMMA_WORKER_OUTBOX_CLEANUP_BATCH_SIZE,
    intervalMs: parsed.LEMMA_WORKER_OUTBOX_CLEANUP_INTERVAL_MS,
    publishedRetentionMs: parsed.LEMMA_WORKER_OUTBOX_PUBLISHED_RETENTION_MS,
  },
  queue: {
    failedJobReconcileBatchSize:
      parsed.LEMMA_WORKER_FAILED_QUEUE_RECONCILE_BATCH_SIZE,
    failedJobReconcileIntervalMs:
      parsed.LEMMA_WORKER_FAILED_QUEUE_RECONCILE_INTERVAL_MS,
    failedJobReconcileLockTimeoutMs:
      parsed.LEMMA_WORKER_FAILED_QUEUE_RECONCILE_LOCK_TIMEOUT_MS,
    questionGenerationConcurrency:
      parsed.LEMMA_WORKER_QUESTION_GENERATION_CONCURRENCY,
    retryDelaySeconds: parsed.LEMMA_WORKER_QUEUE_RETRY_DELAY_SECONDS,
    retryLimit: parsed.LEMMA_WORKER_QUEUE_RETRY_LIMIT,
    workbookCalculationConcurrency:
      parsed.LEMMA_WORKER_WORKBOOK_CALCULATION_CONCURRENCY,
    workbookValidationConcurrency:
      parsed.LEMMA_WORKER_WORKBOOK_VALIDATION_CONCURRENCY,
  },
  realtime: {
    httpApiKey: parsed.LEMMA_CENTRIFUGO_HTTP_API_KEY,
    httpApiUrl: parsed.LEMMA_CENTRIFUGO_HTTP_API_URL,
    publicUrl: parsed.LEMMA_CENTRIFUGO_PUBLIC_URL,
    tokenHmacSecretKey: parsed.LEMMA_CENTRIFUGO_TOKEN_HMAC_SECRET_KEY,
    tokenTtlSeconds: parsed.LEMMA_CENTRIFUGO_TOKEN_TTL_SECONDS,
  },
  s3: {
    accessKeyId: parsed.LEMMA_S3_ACCESS_KEY_ID,
    bucket: parsed.LEMMA_S3_BUCKET,
    downloadUrlExpiresInSeconds:
      parsed.LEMMA_S3_DOWNLOAD_URL_EXPIRES_IN_SECONDS,
    endpoint: parsed.LEMMA_S3_ENDPOINT,
    forcePathStyle: parsed.LEMMA_S3_FORCE_PATH_STYLE,
    publicEndpoint: parsed.LEMMA_S3_PUBLIC_ENDPOINT,
    region: parsed.LEMMA_S3_REGION,
    secretAccessKey: parsed.LEMMA_S3_SECRET_ACCESS_KEY,
    uploadUrlExpiresInSeconds: parsed.LEMMA_S3_UPLOAD_URL_EXPIRES_IN_SECONDS,
  },
  workbook: {
    engine: parsed.LEMMA_WORKBOOK_ENGINE,
    engineTimeoutMs: parsed.LEMMA_WORKBOOK_ENGINE_TIMEOUT_MS,
    libreOfficeServiceUrl: parsed.LEMMA_WORKBOOK_LIBREOFFICE_SERVICE_URL,
    maxCells: parsed.LEMMA_WORKBOOK_MAX_CELLS,
    maxFileBytes: parsed.LEMMA_WORKBOOK_MAX_FILE_BYTES,
    maxFormulas: parsed.LEMMA_WORKBOOK_MAX_FORMULAS,
    maxResponseBytes: parsed.LEMMA_WORKBOOK_MAX_RESPONSE_BYTES,
    maxSheets: parsed.LEMMA_WORKBOOK_MAX_SHEETS,
    validationTimeoutMs: parsed.LEMMA_WORKBOOK_VALIDATION_TIMEOUT_MS,
  },
  workerId: parsed.LEMMA_WORKER_ID,
});

export type Config = typeof config;
