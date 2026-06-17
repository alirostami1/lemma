import { z } from "zod";

export const postgresUrlSchema = z
  .url("LEMMA_DATABASE_URL must be a valid URL")
  .refine(
    (value) =>
      value.startsWith("postgres://") || value.startsWith("postgresql://"),
    {
      message:
        "LEMMA_DATABASE_URL must use the postgres:// or postgresql:// scheme",
    },
  );

export const sharedEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

export const oidcEnvSchema = z.object({
  LEMMA_OIDC_ISSUER_URL: z.url(),
  LEMMA_OIDC_JWKS_URL: z.url(),
  LEMMA_OIDC_AUDIENCE: z.string().min(1),
});

export const s3EnvSchema = z.object({
  LEMMA_S3_REGION: z.string().min(1),
  LEMMA_S3_BUCKET: z.string().min(1),
  LEMMA_S3_ACCESS_KEY_ID: z.string().min(1),
  LEMMA_S3_SECRET_ACCESS_KEY: z.string().min(1),
  LEMMA_S3_ENDPOINT: z.url().optional(),
  LEMMA_S3_FORCE_PATH_STYLE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  LEMMA_S3_UPLOAD_URL_EXPIRES_IN_SECONDS: z.coerce.number().positive(),
  LEMMA_S3_DOWNLOAD_URL_EXPIRES_IN_SECONDS: z.coerce.number().positive(),
});

export const workbookEnvSchema = z
  .object({
    LEMMA_WORKBOOK_ENGINE: z.enum(["cached", "libreoffice"]).default("cached"),
    LEMMA_WORKBOOK_LIBREOFFICE_SERVICE_URL: z.url().optional(),
    LEMMA_WORKBOOK_ENGINE_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(30_000),
    LEMMA_WORKBOOK_VALIDATION_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(30_000),
    LEMMA_WORKBOOK_MAX_FILE_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .default(20 * 1024 * 1024),
    LEMMA_WORKBOOK_MAX_SHEETS: z.coerce.number().int().positive().default(50),
    LEMMA_WORKBOOK_MAX_CELLS: z.coerce
      .number()
      .int()
      .positive()
      .default(500_000),
    LEMMA_WORKBOOK_MAX_FORMULAS: z.coerce
      .number()
      .int()
      .nonnegative()
      .default(50_000),
    LEMMA_WORKBOOK_MAX_RESPONSE_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .default(10 * 1024 * 1024),
  })
  .superRefine((data, ctx) => {
    if (
      data.LEMMA_WORKBOOK_ENGINE === "libreoffice" &&
      !data.LEMMA_WORKBOOK_LIBREOFFICE_SERVICE_URL
    ) {
      ctx.addIssue({
        code: "custom",
        message: "engine is libreoffice but libreoffice-service-url is not set",
        path: ["LEMMA_WORKBOOK_LIBREOFFICE_SERVICE_URL"],
      });
    }
  });

export const realtimeEnvSchema = z.object({
  LEMMA_CENTRIFUGO_PUBLIC_URL: z.url(),
  LEMMA_CENTRIFUGO_HTTP_API_URL: z.url(),
  LEMMA_CENTRIFUGO_HTTP_API_KEY: z.string().min(1),
  LEMMA_CENTRIFUGO_TOKEN_HMAC_SECRET_KEY: z.string().min(32),
  LEMMA_CENTRIFUGO_TOKEN_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(3600),
});

export const observabilityEnvSchema = z.object({
  LEMMA_OTEL_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  LEMMA_OTEL_EXPORTER_OTLP_ENDPOINT: z.url().default("http://localhost:4318"),
  LEMMA_OTEL_METRIC_EXPORT_INTERVAL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(30_000),
});

export type Env = NodeJS.ProcessEnv;

export function createWorkbookWorkerConfig(env: Env = process.env) {
  const parsed = sharedEnvSchema
    .extend(s3EnvSchema.shape)
    .extend(workbookEnvSchema.shape)
    .extend({
      LEMMA_WORKBOOK_WORKER_DATABASE_URL: postgresUrlSchema,
    })
    .parse(env);
  return Object.freeze({
    nodeEnv: parsed.NODE_ENV,
    databaseUrl: parsed.LEMMA_WORKBOOK_WORKER_DATABASE_URL,
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
  });
}

export type S3Config = z.infer<typeof s3EnvSchema>;
export type WorkbookConfig = z.infer<typeof workbookEnvSchema>;
export type OIDCConfig = z.infer<typeof oidcEnvSchema>;
export type RealtimeConfig = z.infer<typeof realtimeEnvSchema>;
export type ObservabilityConfig = z.infer<typeof observabilityEnvSchema>;
