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
      LEMMA_WORKER_ID: z.string().min(1).default(`worker-${randomUUID()}`),
      LEMMA_WORKER_OUTBOX_BATCH_SIZE: z.coerce
        .number()
        .int()
        .positive()
        .default(25),
      LEMMA_WORKER_OUTBOX_POLL_INTERVAL_MS: z.coerce
        .number()
        .int()
        .positive()
        .default(1_000),
      LEMMA_WORKER_OUTBOX_LOCK_TIMEOUT_MS: z.coerce
        .number()
        .int()
        .positive()
        .default(60_000),
      LEMMA_WORKER_OUTBOX_RETRY_DELAY_MS: z.coerce
        .number()
        .int()
        .positive()
        .default(5_000),
      LEMMA_WORKER_OUTBOX_MAX_ATTEMPTS: z.coerce
        .number()
        .int()
        .positive()
        .default(10),
      LEMMA_WORKER_OUTBOX_CLEANUP_INTERVAL_MS: z.coerce
        .number()
        .int()
        .positive()
        .default(60 * 60 * 1_000),
      LEMMA_WORKER_OUTBOX_CLEANUP_BATCH_SIZE: z.coerce
        .number()
        .int()
        .positive()
        .default(500),
      LEMMA_WORKER_OUTBOX_PUBLISHED_RETENTION_MS: z.coerce
        .number()
        .int()
        .positive()
        .default(7 * 24 * 60 * 60 * 1_000),
      LEMMA_WORKER_QUESTION_GENERATION_CONCURRENCY: z.coerce
        .number()
        .int()
        .positive()
        .default(1),
      LEMMA_WORKER_WORKBOOK_VALIDATION_CONCURRENCY: z.coerce
        .number()
        .int()
        .positive()
        .default(1),
      LEMMA_WORKER_WORKBOOK_CALCULATION_CONCURRENCY: z.coerce
        .number()
        .int()
        .positive()
        .default(1),
      LEMMA_WORKER_QUEUE_RETRY_LIMIT: z.coerce
        .number()
        .int()
        .nonnegative()
        .default(3),
      LEMMA_WORKER_QUEUE_RETRY_DELAY_SECONDS: z.coerce
        .number()
        .int()
        .nonnegative()
        .default(30),
      LEMMA_WORKER_FAILED_QUEUE_RECONCILE_INTERVAL_MS: z.coerce
        .number()
        .int()
        .positive()
        .default(10_000),
      LEMMA_WORKER_FAILED_QUEUE_RECONCILE_BATCH_SIZE: z.coerce
        .number()
        .int()
        .positive()
        .default(25),
      LEMMA_WORKER_FAILED_QUEUE_RECONCILE_LOCK_TIMEOUT_MS: z.coerce
        .number()
        .int()
        .positive()
        .default(60_000),
    }),
);

export const config = Object.freeze({
  nodeEnv: parsed.NODE_ENV,
  databaseUrl: parsed.LEMMA_WORKER_DATABASE_URL,
  workerId: parsed.LEMMA_WORKER_ID,
  s3: {
    region: parsed.LEMMA_S3_REGION,
    bucket: parsed.LEMMA_S3_BUCKET,
    accessKeyId: parsed.LEMMA_S3_ACCESS_KEY_ID,
    secretAccessKey: parsed.LEMMA_S3_SECRET_ACCESS_KEY,
    endpoint: parsed.LEMMA_S3_ENDPOINT,
    publicEndpoint: parsed.LEMMA_S3_PUBLIC_ENDPOINT,
    forcePathStyle: parsed.LEMMA_S3_FORCE_PATH_STYLE,
    uploadUrlExpiresInSeconds: parsed.LEMMA_S3_UPLOAD_URL_EXPIRES_IN_SECONDS,
    downloadUrlExpiresInSeconds:
      parsed.LEMMA_S3_DOWNLOAD_URL_EXPIRES_IN_SECONDS,
  },
  workbook: {
    engine: parsed.LEMMA_WORKBOOK_ENGINE,
    libreOfficeServiceUrl: parsed.LEMMA_WORKBOOK_LIBREOFFICE_SERVICE_URL,
    engineTimeoutMs: parsed.LEMMA_WORKBOOK_ENGINE_TIMEOUT_MS,
    validationTimeoutMs: parsed.LEMMA_WORKBOOK_VALIDATION_TIMEOUT_MS,
    maxFileBytes: parsed.LEMMA_WORKBOOK_MAX_FILE_BYTES,
    maxSheets: parsed.LEMMA_WORKBOOK_MAX_SHEETS,
    maxCells: parsed.LEMMA_WORKBOOK_MAX_CELLS,
    maxFormulas: parsed.LEMMA_WORKBOOK_MAX_FORMULAS,
    maxResponseBytes: parsed.LEMMA_WORKBOOK_MAX_RESPONSE_BYTES,
  },
  realtime: {
    publicUrl: parsed.LEMMA_CENTRIFUGO_PUBLIC_URL,
    httpApiUrl: parsed.LEMMA_CENTRIFUGO_HTTP_API_URL,
    httpApiKey: parsed.LEMMA_CENTRIFUGO_HTTP_API_KEY,
    tokenHmacSecretKey: parsed.LEMMA_CENTRIFUGO_TOKEN_HMAC_SECRET_KEY,
    tokenTtlSeconds: parsed.LEMMA_CENTRIFUGO_TOKEN_TTL_SECONDS,
  },
  observability: {
    enabled: parsed.LEMMA_OTEL_ENABLED,
    otlpEndpoint: parsed.LEMMA_OTEL_EXPORTER_OTLP_ENDPOINT,
    metricExportIntervalMs: parsed.LEMMA_OTEL_METRIC_EXPORT_INTERVAL_MS,
  },
  outbox: {
    batchSize: parsed.LEMMA_WORKER_OUTBOX_BATCH_SIZE,
    pollIntervalMs: parsed.LEMMA_WORKER_OUTBOX_POLL_INTERVAL_MS,
    lockTimeoutMs: parsed.LEMMA_WORKER_OUTBOX_LOCK_TIMEOUT_MS,
    retryDelayMs: parsed.LEMMA_WORKER_OUTBOX_RETRY_DELAY_MS,
    maxAttempts: parsed.LEMMA_WORKER_OUTBOX_MAX_ATTEMPTS,
  },
  outboxCleanup: {
    intervalMs: parsed.LEMMA_WORKER_OUTBOX_CLEANUP_INTERVAL_MS,
    batchSize: parsed.LEMMA_WORKER_OUTBOX_CLEANUP_BATCH_SIZE,
    publishedRetentionMs: parsed.LEMMA_WORKER_OUTBOX_PUBLISHED_RETENTION_MS,
  },
  queue: {
    questionGenerationConcurrency:
      parsed.LEMMA_WORKER_QUESTION_GENERATION_CONCURRENCY,
    workbookValidationConcurrency:
      parsed.LEMMA_WORKER_WORKBOOK_VALIDATION_CONCURRENCY,
    workbookCalculationConcurrency:
      parsed.LEMMA_WORKER_WORKBOOK_CALCULATION_CONCURRENCY,
    retryLimit: parsed.LEMMA_WORKER_QUEUE_RETRY_LIMIT,
    retryDelaySeconds: parsed.LEMMA_WORKER_QUEUE_RETRY_DELAY_SECONDS,
    failedJobReconcileIntervalMs:
      parsed.LEMMA_WORKER_FAILED_QUEUE_RECONCILE_INTERVAL_MS,
    failedJobReconcileBatchSize:
      parsed.LEMMA_WORKER_FAILED_QUEUE_RECONCILE_BATCH_SIZE,
    failedJobReconcileLockTimeoutMs:
      parsed.LEMMA_WORKER_FAILED_QUEUE_RECONCILE_LOCK_TIMEOUT_MS,
  },
});

export type Config = typeof config;
