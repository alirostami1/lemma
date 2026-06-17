import {
  observabilityEnvSchema,
  oidcEnvSchema,
  parseEnv,
  postgresUrlSchema,
  realtimeEnvSchema,
  s3EnvSchema,
  sharedEnvSchema,
  workbookEnvSchema,
} from "@lemma/config";
import { z } from "zod";

const parsed = parseEnv(
  "api",
  sharedEnvSchema
    .extend(oidcEnvSchema.shape)
    .extend(s3EnvSchema.shape)
    .extend(workbookEnvSchema.shape)
    .extend(realtimeEnvSchema.shape)
    .extend(observabilityEnvSchema.shape)
    .extend({
      LEMMA_API_DATABASE_URL: postgresUrlSchema,
      LEMMA_API_PORT: z.coerce.number().int().positive().default(3001),
      LEMMA_API_WEB_ORIGINS: z
        .string()
        .min(1)
        .transform((origins) => origins.split(","))
        .pipe(z.url().array()),
    }),
);

export const config = Object.freeze({
  nodeEnv: parsed.NODE_ENV,
  port: parsed.LEMMA_API_PORT,
  databaseUrl: parsed.LEMMA_API_DATABASE_URL,
  oidc: {
    issuerUrl: parsed.LEMMA_OIDC_ISSUER_URL,
    jwksUrl: parsed.LEMMA_OIDC_JWKS_URL,
    audience: parsed.LEMMA_OIDC_AUDIENCE,
  },
  web: {
    origins: parsed.LEMMA_API_WEB_ORIGINS,
  },
  s3: {
    region: parsed.LEMMA_S3_REGION,
    bucket: parsed.LEMMA_S3_BUCKET,
    accessKeyId: parsed.LEMMA_S3_ACCESS_KEY_ID,
    secretAccessKey: parsed.LEMMA_S3_SECRET_ACCESS_KEY,
    endpoint: parsed.LEMMA_S3_ENDPOINT,
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
});

export type Config = typeof config;
