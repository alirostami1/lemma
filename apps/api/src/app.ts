import type { DatabasePort } from "@lemma/db";
import { createFilesModule } from "@lemma/files/module";
import { createNotificationsModule } from "@lemma/notifications/module";
import { createOpsModule } from "@lemma/ops/module";
import {
  DraftSourceFileInvalidError,
  type DraftSourceWorkbookFileInspection,
  WORKBOOK_EDITOR_OUTPUT_FILE_METADATA_TYPE,
  WORKBOOK_EDITOR_OUTPUT_FILE_METADATA_VERSION,
} from "@lemma/questions/application";
import { workbookId as toQuestionWorkbookId } from "@lemma/questions/domain";
import { KyselyQuestionsRepository } from "@lemma/questions/infrastructure";
import { createQuestionsModule } from "@lemma/questions/module";
import {
  userId as toWorkbookUserId,
  type WorkbookSourceFileInspection,
  workbookSourceFileInspection,
} from "@lemma/workbook/domain";
import { createWorkbookModule } from "@lemma/workbook/module";
import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { trimTrailingSlash } from "hono/trailing-slash";
import { createClock } from "./composition/clock.js";
import { isExpectedDraftSourceFileUnavailableError } from "./composition/draft-source-file-error-mapping.js";
import { mapDraftSourceFilePortError } from "./composition/draft-source-file-port-errors.js";
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

function toQuestionDraftSourceWorkbookFileInspection(
  inspection: WorkbookSourceFileInspection,
): DraftSourceWorkbookFileInspection {
  return {
    byteSize: inspection.byteSize,
    checksumSha256: inspection.checksumSha256,
    contentType: inspection.contentType,
    fileId: inspection.fileId,
    referenceTargetAvailability: toQuestionReferenceTargetAvailability(
      inspection.referenceTargetAvailability,
    ),
    referenceTargets:
      inspection.referenceTargets === null
        ? null
        : toQuestionReferenceTargets(inspection.referenceTargets),
    schemaVersion: inspection.schemaVersion,
    validation: toQuestionInspectionValidation(inspection.validation),
  };
}

function toQuestionReferenceTargetAvailability(
  availability: WorkbookSourceFileInspection["referenceTargetAvailability"],
): DraftSourceWorkbookFileInspection["referenceTargetAvailability"] {
  if (availability.status === "available") {
    return {
      status: "available",
      targets: toQuestionReferenceTargets(availability.targets),
    };
  }
  return {
    reason: availability.reason,
    status: "unavailable",
  };
}

function toQuestionReferenceTargets(
  targets: NonNullable<WorkbookSourceFileInspection["referenceTargets"]>,
): NonNullable<DraftSourceWorkbookFileInspection["referenceTargets"]> {
  return {
    schemaVersion: targets.schemaVersion,
    sheets: targets.sheets.map((sheet) => ({
      dimensions: {
        columnCount: sheet.dimensions.columnCount,
        rowCount: sheet.dimensions.rowCount,
      },
      name: sheet.name,
      ...(sheet.valueCells === undefined
        ? {}
        : { valueCells: [...sheet.valueCells] }),
    })),
  };
}

function toQuestionInspectionValidation(
  validation: WorkbookSourceFileInspection["validation"],
): DraftSourceWorkbookFileInspection["validation"] {
  if (validation.status === "invalid") {
    return {
      status: "invalid",
      validationError: validation.validationError,
    };
  }
  return { status: validation.status };
}

function toWorkbookSourceFileInspection(
  inspection: DraftSourceWorkbookFileInspection,
): WorkbookSourceFileInspection {
  return workbookSourceFileInspection({
    byteSize: inspection.byteSize,
    checksumSha256: inspection.checksumSha256,
    contentType: inspection.contentType,
    fileId: inspection.fileId,
    referenceTargetAvailability: inspection.referenceTargetAvailability,
    validation: inspection.validation,
  });
}

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
    db: database,
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
    clock,
    createFileReferenceGuardForTransaction:
      filesModule.createFileReferenceGuardForTransaction,
    db: database,
    fileProvider: createWorkbookFileProvider(filesModule.fileContentReaderPort),
    idGenerator: idGenerators.workbook,
    requireIdentity,
    workbookConfig: config.workbook,
  });

  const questionsModule = createQuestionsModule({
    db: database,
    requireIdentity,
    idGenerator: idGenerators.questions,
    clock,
    workbookAccessPort: workbookModule.workbookAccessPort,
    draftSourceWorkbookInspectionPort: {
      async inspectWorkbookSourceFile(input) {
        const workbookInspectionPort =
          workbookModule.createDraftSourceWorkbookInspectionPort();
        return toQuestionDraftSourceWorkbookFileInspection(
          await workbookInspectionPort.inspectWorkbookSourceFile({
            fileId: input.fileId,
            lineage: input.lineage,
            ownerUserId: toWorkbookUserId(input.ownerUserId),
          }),
        );
      },
    },
    draftSourceFilePort: {
      createEditorOutputUpload: async ({
        byteSize,
        checksumSha256,
        contentType,
        currentUser,
        draftId,
        draftRevision,
        originalName,
        sourceArtifactId,
        sourceDocumentId,
        sourceId,
        sourceRevisionId,
      }) => {
        try {
          return await filesModule.filesService.createInternalFileUpload({
            byteSize,
            checksumSha256,
            contentType,
            currentUser,
            metadata: {
              draftId,
              draftRevision,
              ownerUserId: currentUser.user.id,
              sourceArtifactId,
              sourceDocumentId,
              sourceId,
              sourceRevisionId,
              type: WORKBOOK_EDITOR_OUTPUT_FILE_METADATA_TYPE,
              version: WORKBOOK_EDITOR_OUTPUT_FILE_METADATA_VERSION,
            },
            originalName,
            purpose: "workbook_editor_output",
          });
        } catch (error) {
          throw mapDraftSourceFilePortError(error, "editorUploadCreation");
        }
      },
      completeEditorOutputUpload: async ({ currentUser, uploadId }) => {
        try {
          const { file } =
            await filesModule.filesService.completeInternalFileUpload({
              currentUser,
              purpose: "workbook_editor_output",
              uploadId,
            });
          return {
            file: {
              byteSize: file.byteSize,
              checksumSha256: file.checksumSha256,
              contentType: file.contentType,
              id: file.id,
              metadata: file.metadata,
              originalName: file.originalName,
              ownerUserId: file.ownerUserId,
              purpose: file.purpose,
            },
          };
        } catch (error) {
          throw mapDraftSourceFilePortError(error, "editorUploadCompletion");
        }
      },
      getFileMetadata: async ({ currentUser, fileId }) => {
        try {
          const { file } =
            await filesModule.filesService.getInternalFileForOwnerUserId({
              allowedPurposes: ["workbook", "workbook_editor_output"],
              ownerUserId: currentUser.user.id,
              fileId,
            });
          return {
            fileId: file.id,
            ownerUserId: file.ownerUserId,
            originalName: file.originalName,
            contentType: file.contentType,
            byteSize: file.byteSize,
            checksumSha256: file.checksumSha256,
            metadata: file.metadata,
            purpose: file.purpose,
          };
        } catch (error) {
          throw mapDraftSourceFilePortError(error, "editorFileLookup");
        }
      },
      getUploadMetadata: async ({ currentUser, uploadId }) => {
        try {
          const { upload } =
            await filesModule.filesService.getFileUploadForOwnerUserId({
              ownerUserId: currentUser.user.id,
              purpose: "workbook_editor_output",
              uploadId,
            });
          return {
            metadata: upload.metadata,
            ownerUserId: upload.createdByUserId,
            purpose: upload.purpose,
            uploadId: upload.id,
          };
        } catch (error) {
          throw mapDraftSourceFilePortError(error, "editorUploadLookup");
        }
      },
    },
    questionBlueprintDraftTransaction: {
      transaction: (fn) =>
        database.transaction(async (tx) => {
          const workbookRegistrationPort =
            workbookModule.createDraftSourceWorkbookRegistrationPortForTransaction(
              tx,
            );
          const fileReferenceGuard =
            filesModule.createFileReferenceGuardForTransaction(tx);
          return fn({
            fileReferenceGuard: {
              async assertFileAliasReferenceableForUpdate(fileId) {
                try {
                  await fileReferenceGuard.assertFileAliasReferenceableForUpdate(
                    fileId,
                  );
                } catch (error) {
                  if (isExpectedDraftSourceFileUnavailableError(error)) {
                    throw new DraftSourceFileInvalidError(
                      "Draft source file is unavailable.",
                    );
                  }
                  throw error;
                }
              },
            },
            questionsRepository: new KyselyQuestionsRepository(tx),
            workbookRegistrationPort: {
              async registerInspectedWorkbookFromFile(input) {
                const result =
                  await workbookRegistrationPort.registerInspectedWorkbookFromFile(
                    {
                      byteSize: input.byteSize,
                      checksumSha256: input.checksumSha256,
                      contentType: input.contentType,
                      createdByUserId: toWorkbookUserId(input.createdByUserId),
                      fileId: input.fileId,
                      inspection: toWorkbookSourceFileInspection(
                        input.inspection,
                      ),
                      lineage: input.lineage,
                      name: input.name,
                      originalName: input.originalName,
                      ownerUserId: toWorkbookUserId(input.ownerUserId),
                    },
                  );
                return {
                  inspection: toQuestionDraftSourceWorkbookFileInspection(
                    result.inspection,
                  ),
                  status: result.status,
                  validationError: result.validationError,
                  workbookId: toQuestionWorkbookId(result.workbookId),
                };
              },
            },
          });
        }),
    },
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
