import type { OutboxRepository } from "@lemma/events/application";
import {
  fileId,
  InvalidWorkbookFieldError,
  type WorkbookEngineName,
  type WorkbookSourceFileInspection,
  type WorkbookStatus,
  workbookSourceFileInspection,
} from "../domain/index.js";
import { createWorkbookForFile } from "./createWorkbookForFile.js";
import type {
  Clock,
  DraftSourceInspectedWorkbookRegistrationCommand,
  DraftSourceWorkbookRegistrationPort,
  DraftSourceWorkbookRegistrationResult,
  IdGenerator,
  WorkbookCalculator,
  WorkbookFileProviderPort,
  WorkbookRepository,
  WorkbookSourceFileInspectionCommand,
} from "./ports.js";
import { workbookValidationRequestedEvent } from "./workbook-events.js";
import { withWorkbookTempFile } from "./workbook-temp-file.js";

type DraftSourceWorkbookRepository = Pick<
  WorkbookRepository,
  "createWorkbookIfAbsentByOwnerAndFile" | "findWorkbookByOwnerUserIdAndFileId"
>;

export class DraftSourceWorkbookRegistrationService
  implements DraftSourceWorkbookRegistrationPort
{
  constructor(
    private readonly deps: {
      clock: Clock;
      eventId: IdGenerator["eventId"];
      workbookCalculator: WorkbookCalculator;
      workbookEngine: WorkbookEngineName;
      workbookFileProvider: WorkbookFileProviderPort;
      workbookId: IdGenerator["workbookId"];
      workbookRepository: DraftSourceWorkbookRepository;
      outboxRepository: OutboxRepository;
    },
  ) {}

  async inspectWorkbookSourceFile(
    input: WorkbookSourceFileInspectionCommand,
  ): Promise<WorkbookSourceFileInspection> {
    const normalizedFileId = fileId(input.fileId);
    const metadata =
      await this.deps.workbookFileProvider.getWorkbookFileMetadataForOwnerUserId(
        {
          fileId: normalizedFileId,
          ownerUserId: input.ownerUserId,
        },
      );
    const existing =
      await this.deps.workbookRepository.findWorkbookByOwnerUserIdAndFileId({
        fileId: normalizedFileId,
        ownerUserId: input.ownerUserId,
      });

    if (existing?.status === "invalid") {
      return workbookSourceFileInspection({
        byteSize: metadata.byteSize,
        checksumSha256: metadata.checksumSha256,
        contentType: metadata.contentType,
        fileId: metadata.fileId,
        referenceTargetAvailability: {
          reason: "invalid_workbook",
          status: "unavailable",
        },
        validation: {
          status: "invalid",
          validationError: existing.validationError ?? "Workbook is invalid.",
        },
      });
    }
    if (existing?.status === "archived" || existing?.status === "deleted") {
      return workbookSourceFileInspection({
        byteSize: metadata.byteSize,
        checksumSha256: metadata.checksumSha256,
        contentType: metadata.contentType,
        fileId: metadata.fileId,
        referenceTargetAvailability: {
          reason: "invalid_workbook",
          status: "unavailable",
        },
        validation: {
          status: "invalid",
          validationError: "Workbook is unavailable.",
        },
      });
    }

    const file =
      await this.deps.workbookFileProvider.readWorkbookFileContentForOwnerUserId(
        {
          fileId: normalizedFileId,
          ownerUserId: input.ownerUserId,
        },
      );
    const referenceTargetAvailability = await withWorkbookTempFile(
      file,
      async (path) => {
        try {
          return await this.deps.workbookCalculator.referenceTargets(path, {
            lineage: input.lineage,
          });
        } catch {
          return {
            reason: "inspection_unavailable",
            status: "unavailable",
          } as const;
        }
      },
    );

    return workbookSourceFileInspection({
      byteSize: file.byteSize,
      checksumSha256: file.checksumSha256,
      contentType: file.contentType,
      fileId: file.fileId,
      referenceTargetAvailability,
    });
  }

  async registerInspectedWorkbookFromFile(
    input: DraftSourceInspectedWorkbookRegistrationCommand,
  ): Promise<DraftSourceWorkbookRegistrationResult> {
    const workbook = createWorkbookForFile({
      at: this.deps.clock.now(),
      byteSize: input.byteSize,
      checksumSha256: input.checksumSha256,
      contentType: input.contentType,
      createdByUserId: input.createdByUserId,
      engine: this.deps.workbookEngine,
      fileId: input.fileId,
      id: this.deps.workbookId(),
      name: input.name,
      originalName: input.originalName,
      origin: "source_artifact",
      ownerUserId: input.ownerUserId,
    });
    assertInspectionMatchesRegistration(input);

    const persisted =
      await this.deps.workbookRepository.createWorkbookIfAbsentByOwnerAndFile({
        workbook,
      });

    if (persisted.created) {
      await this.deps.outboxRepository.appendEvents([
        workbookValidationRequestedEvent({
          id: this.deps.eventId(),
          lineage: input.lineage,
          occurredAt: persisted.workbook.createdAt,
          workbook: persisted.workbook,
        }),
      ]);
    }

    return {
      inspection: input.inspection,
      status: registrationStatus({
        inspection: input.inspection,
        persistedStatus: persisted.workbook.status,
      }),
      validationError:
        input.inspection.validation.status === "invalid"
          ? input.inspection.validation.validationError
          : persisted.workbook.validationError,
      workbookId: persisted.workbook.id,
    };
  }
}

function assertInspectionMatchesRegistration(
  input: DraftSourceInspectedWorkbookRegistrationCommand,
): void {
  if (
    input.inspection.fileId !== input.fileId ||
    input.inspection.checksumSha256 !== input.checksumSha256 ||
    input.inspection.byteSize !== input.byteSize ||
    input.inspection.contentType !== input.contentType
  ) {
    throw new InvalidWorkbookFieldError(
      "workbook source file inspection does not match the registered file.",
    );
  }
}

function registrationStatus(input: {
  inspection: WorkbookSourceFileInspection;
  persistedStatus: WorkbookStatus;
}): WorkbookStatus {
  if (
    input.persistedStatus === "archived" ||
    input.persistedStatus === "deleted"
  ) {
    return input.persistedStatus;
  }
  if (input.inspection.validation.status === "invalid") {
    return "invalid";
  }
  return input.persistedStatus;
}
