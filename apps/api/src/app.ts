import type { DatabasePort } from "@lemma/db";
import { createFilesModule } from "@lemma/files/module";
import { createNotificationsModule } from "@lemma/notifications/module";
import { createOpsModule } from "@lemma/ops/module";
import { createQuestionsModule } from "@lemma/questions/module";
import { createWorkbookModule } from "@lemma/workbook/module";
import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { trimTrailingSlash } from "hono/trailing-slash";
import { createClock } from "./composition/clock.js";
import { createIdGenerators } from "./composition/id-generators.js";
import { createIdentityAuth } from "./composition/identity-auth.js";
import { createRealtimeChannelAccess } from "./composition/realtime-channel-access.js";
import {
  requestIdMiddleware,
  requestSpanMiddleware,
} from "./composition/request-context.js";
import { createWorkbookFileProvider } from "./composition/workbook-file-provider.js";
import { type Config, config as defaultConfig } from "./config.js";
import { cors } from "./cors.js";
import { errorHandler, notFoundHandler } from "./errors.js";
import { healthRoutes } from "./health.js";
import { apiRequestLoggerMiddleware } from "./logging.js";

export type NewAppDeps = {
  database: DatabasePort;
  config?: Config;
};

export function newApp({ database, config = defaultConfig }: NewAppDeps) {
  const clock = createClock();
  const idGenerators = createIdGenerators();
  const { identityModule, requireIdentity } = createIdentityAuth({
    db: database.executor,
    config,
    idGenerator: idGenerators.identity,
    clock,
  });

  const filesModule = createFilesModule({
    db: database.executor,
    requireIdentity,
    idGenerator: idGenerators.files,
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
    requireIdentity,
    fileProvider: createWorkbookFileProvider(filesModule.fileContentReaderPort),
    workbookConfig: config.workbook,
    idGenerator: idGenerators.workbook,
    clock,
  });

  const questionsModule = createQuestionsModule({
    db: database,
    requireIdentity,
    idGenerator: idGenerators.questions,
    clock,
    workbookAccessPort: workbookModule.workbookAccessPort,
  });
  const notificationsModule = createNotificationsModule({
    requireIdentity,
    channelAccessPort: createRealtimeChannelAccess({
      questionGenerationService: questionsModule.questionGenerationService,
      questionSetService: questionsModule.questionSetService,
      workbookCalculationService: workbookModule.workbookCalculationService,
    }),
    tokenSecret: config.realtime.tokenHmacSecretKey,
    tokenTtlSeconds: config.realtime.tokenTtlSeconds,
    clock,
  });
  const opsModule = createOpsModule({
    db: database,
    requireIdentity,
  });

  const app = new Hono().basePath("/api");

  app.use("*", trimTrailingSlash());
  app.use("*", requestIdMiddleware);
  app.use("*", requestSpanMiddleware);
  app.use("*", secureHeaders());
  app.use("*", apiRequestLoggerMiddleware);
  app.use("*", cors(config.web.origins));

  app.notFound(notFoundHandler);
  app.onError(errorHandler);

  app.route("/", healthRoutes({ database: database.executor }));

  const v1 = new Hono()
    .route("/", identityModule.routes)
    .route("/", filesModule.routes)
    .route("/", workbookModule.routes)
    .route("/", notificationsModule.routes)
    .route("/", opsModule.routes)
    .route("/", questionsModule.routes);

  return app.route("/v1", v1);
}
