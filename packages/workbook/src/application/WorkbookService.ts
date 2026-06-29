import { FileAliasUnavailableError } from "@lemma/files/application";
import { instrumentService } from "@lemma/observability";
import {
  assertWorkbookFileMetadata,
  deleteWorkbook as deleteWorkbookDomain,
  markWorkbookInvalid,
  markWorkbookValid,
  promoteWorkbookToStandalone,
  requestWorkbookValidation,
  fileId as toFileId,
  workbookId as toWorkbookId,
  updateWorkbook as updateWorkbookDomain,
  type Workbook,
  type WorkbookEngineName,
  workbookStatus,
} from "../domain/index.js";
import type {
  CreateWorkbookCommand,
  ListCommand,
  UpdateWorkbookCommand,
  ValidateWorkbookCommand,
  WorkbookByIdCommand,
} from "./commands.js";
import { createWorkbookForFile } from "./createWorkbookForFile.js";
import type { WorkbookResult, WorkbooksResult } from "./dto.js";
import {
  ForbiddenWorkbookActionError,
  WorkbookFileUnavailableError,
  WorkbookNotFoundError,
} from "./errors.js";
import {
  decodeListCursor,
  encodeListCursor,
  normalizeListLimit,
} from "./mappers.js";
import {
  canCreateWorkbook,
  canListWorkbooks,
  canManageWorkbook,
  canValidateWorkbook,
  canViewWorkbook,
} from "./policies.js";
import type {
  Clock,
  IdGenerator,
  WorkbookCalculator,
  WorkbookFileProviderPort,
  WorkbookRepository,
  WorkbookTransactionPort,
} from "./ports.js";
import {
  workbookValidationFinishedEvent,
  workbookValidationRequestedEvent,
} from "./workbook-events.js";
import { withWorkbookTempFile } from "./workbook-temp-file.js";

const instrumentation = instrumentService("workbook", "service");

export class WorkbookService {
  constructor(
    private readonly deps: {
      workbookRepository: WorkbookRepository;
      workbookTransaction: WorkbookTransactionPort;
      workbookFileProvider: WorkbookFileProviderPort;
      workbookCalculator: WorkbookCalculator;
      workbookEngine: WorkbookEngineName;
      idGenerator: IdGenerator;
      clock: Clock;
    },
  ) {}

  async listWorkbooks(
    command: ListCommand & { status?: string },
  ): Promise<WorkbooksResult> {
    return this.operation("list_workbooks", null, async () => {
      this.assertAuthorized(
        canListWorkbooks(command.currentUser),
        "You cannot list workbooks.",
      );
      const limit = normalizeListLimit(command.limit);
      const workbooks =
        await this.deps.workbookRepository.listWorkbooksByOwnerUserId({
          cursor: decodeListCursor(command.cursor),
          limit: limit + 1,
          ownerUserId: command.currentUser.user.id,
          statuses: command.status
            ? [workbookStatus(command.status)]
            : undefined,
        });
      return {
        nextCursor:
          workbooks.length > limit
            ? encodeListCursor(workbooks[limit - 1]?.createdAt)
            : null,
        workbooks: workbooks.slice(0, limit),
      };
    });
  }

  async createWorkbook(
    command: CreateWorkbookCommand,
  ): Promise<WorkbookResult> {
    return this.operation("create_workbook", command.lineage, async () => {
      this.assertAuthorized(
        canCreateWorkbook(command.currentUser),
        "You cannot create workbooks.",
      );
      const file = await this.deps.workbookFileProvider.getWorkbookFileMetadata(
        {
          currentUser: command.currentUser,
          fileId: toFileId(command.fileId),
        },
      );
      assertWorkbookFileMetadata(file);
      const workbook = createWorkbookForFile({
        at: this.deps.clock.now(),
        byteSize: file.byteSize,
        checksumSha256: file.checksumSha256,
        contentType: file.contentType,
        createdByUserId: command.currentUser.user.id,
        engine: this.deps.workbookEngine,
        fileId: file.fileId,
        id: this.deps.idGenerator.workbookId(),
        name: command.name,
        originalName: file.originalName,
        ownerUserId: command.currentUser.user.id,
      });
      const created = await this.deps.workbookTransaction.transaction(
        async ({
          fileReferenceGuard,
          workbookRepository,
          outboxRepository,
        }) => {
          try {
            await fileReferenceGuard.assertFileAliasReferenceableForUpdate(
              file.fileId,
            );
          } catch (error) {
            if (error instanceof FileAliasUnavailableError) {
              throw new WorkbookFileUnavailableError();
            }
            throw error;
          }
          const existing =
            await workbookRepository.findWorkbookByOwnerUserIdAndFileIdForUpdate(
              {
                fileId: file.fileId,
                ownerUserId: command.currentUser.user.id,
              },
            );
          if (existing?.status === "deleted") {
            throw new WorkbookFileUnavailableError(
              "workbook file is unavailable because its existing workbook is deleted",
            );
          }
          if (existing?.origin === "standalone") {
            return existing;
          }
          if (existing?.origin === "source_artifact") {
            const promoted =
              await workbookRepository.promoteWorkbookToStandalone(
                promoteWorkbookToStandalone(existing, this.deps.clock.now()),
              );
            if (!promoted) {
              throw new WorkbookFileUnavailableError(
                "workbook could not be promoted to standalone",
              );
            }
            return promoted;
          }
          const persisted = await workbookRepository.createWorkbook(workbook);
          await outboxRepository.appendEvents([
            workbookValidationRequestedEvent({
              id: this.deps.idGenerator.eventId(),
              lineage: command.lineage,
              occurredAt: persisted.createdAt,
              workbook: persisted,
            }),
          ]);
          return persisted;
        },
      );

      return { workbook: created };
    });
  }

  async getWorkbook(input: WorkbookByIdCommand): Promise<WorkbookResult> {
    return this.operation("get_workbook", null, async () => {
      const workbook = await this.findWorkbookByIdOrThrow(input.workbookId);
      this.assertAuthorized(
        canViewWorkbook(input.currentUser, workbook),
        "You cannot view this workbook.",
      );
      return { workbook };
    });
  }

  async updateWorkbook(input: UpdateWorkbookCommand): Promise<WorkbookResult> {
    return this.operation("update_workbook", null, async () => {
      const workbook = await this.findWorkbookByIdOrThrow(input.workbookId);
      this.assertAuthorized(
        canManageWorkbook(input.currentUser, workbook),
        "You cannot update this workbook.",
      );
      const updated = updateWorkbookDomain(
        workbook,
        {
          name: input.patch.name,
          status: input.patch.status
            ? workbookStatus(input.patch.status)
            : undefined,
        },
        this.deps.clock.now(),
      );
      const persisted =
        await this.deps.workbookRepository.updateWorkbook(updated);
      if (!persisted) {
        throw new WorkbookNotFoundError();
      }
      return { workbook: persisted };
    });
  }

  async deleteWorkbook(input: WorkbookByIdCommand): Promise<void> {
    await this.operation("delete_workbook", null, async () => {
      const workbook = await this.findWorkbookByIdOrThrow(input.workbookId);
      this.assertAuthorized(
        canManageWorkbook(input.currentUser, workbook),
        "You cannot delete this workbook.",
      );
      await this.deps.workbookRepository.updateWorkbook(
        deleteWorkbookDomain(workbook, this.deps.clock.now()),
      );
    });
  }

  async validateWorkbook(
    input: ValidateWorkbookCommand,
  ): Promise<WorkbookResult> {
    return this.operation("validate_workbook", input.lineage, async () => {
      const workbook = await this.findWorkbookByIdOrThrow(input.workbookId);
      this.assertAuthorized(
        canValidateWorkbook(input.currentUser, workbook),
        "You cannot validate this workbook.",
      );
      return this.requestAndPersistWorkbookValidation(workbook, input.lineage);
    });
  }

  async processWorkbookValidation(input: {
    workbookId: string;
    lineage: CreateWorkbookCommand["lineage"];
  }): Promise<WorkbookResult | null> {
    return this.operation(
      "process_workbook_validation",
      input.lineage,
      async () => {
        const workbook = await this.findWorkbookValidationTarget(
          input.workbookId,
        );
        if (!workbook) {
          return null;
        }
        return this.validateAndPersistWorkbook(workbook, input.lineage);
      },
    );
  }

  async findWorkbookByIdOrThrow(workbookId: string) {
    const workbook = await this.deps.workbookRepository.findWorkbookById(
      toWorkbookId(workbookId),
    );
    if (!workbook) {
      throw new WorkbookNotFoundError();
    }
    return workbook;
  }

  private async validateAndPersistWorkbook(
    workbook: Workbook,
    lineage: CreateWorkbookCommand["lineage"],
  ): Promise<WorkbookResult> {
    const result = await this.inspectWorkbook(workbook, lineage);
    const persisted = await this.deps.workbookTransaction.transaction(
      async ({ workbookRepository, outboxRepository }) => {
        const updated = await workbookRepository.updateWorkbook(result);
        if (!updated) {
          throw new WorkbookNotFoundError();
        }
        await outboxRepository.appendEvents([
          workbookValidationFinishedEvent({
            id: this.deps.idGenerator.eventId(),
            lineage,
            occurredAt: updated.updatedAt,
            workbook: updated,
          }),
        ]);
        return updated;
      },
    );

    return { workbook: persisted };
  }

  private async requestAndPersistWorkbookValidation(
    workbook: Workbook,
    lineage: CreateWorkbookCommand["lineage"],
  ): Promise<WorkbookResult> {
    const requested = requestWorkbookValidation(
      workbook,
      this.deps.clock.now(),
    );
    const persisted = await this.deps.workbookTransaction.transaction(
      async ({ workbookRepository, outboxRepository }) => {
        const updated = await workbookRepository.updateWorkbook(requested);
        if (!updated) {
          throw new WorkbookNotFoundError();
        }
        await outboxRepository.appendEvents([
          workbookValidationRequestedEvent({
            id: this.deps.idGenerator.eventId(),
            lineage,
            occurredAt: updated.updatedAt,
            workbook: updated,
          }),
        ]);
        return updated;
      },
    );

    return { workbook: persisted };
  }

  private async findWorkbookValidationTarget(
    workbookId: string,
  ): Promise<Workbook | null> {
    const workbook = await this.deps.workbookRepository.findWorkbookById(
      toWorkbookId(workbookId),
    );
    if (!workbook || workbook.status === "deleted") {
      return null;
    }
    return workbook;
  }

  private async inspectWorkbook(
    workbook: Workbook,
    lineage: CreateWorkbookCommand["lineage"],
  ): Promise<Workbook> {
    const file =
      await this.deps.workbookFileProvider.readWorkbookFileContentForOwnerUserId(
        {
          fileId: workbook.fileId,
          ownerUserId: workbook.ownerUserId,
        },
      );
    return withWorkbookTempFile(file, async (path) => {
      try {
        const inspection = await this.deps.workbookCalculator.inspect(path, {
          lineage,
        });
        return markWorkbookValid(
          workbook,
          inspection,
          inspection.libreOfficeVersion,
          this.deps.clock.now(),
        );
      } catch (error) {
        return markWorkbookInvalid(
          workbook,
          error instanceof Error
            ? error.message
            : "Workbook validation failed.",
          null,
          this.deps.clock.now(),
        );
      }
    });
  }

  private assertAuthorized(value: boolean, message: string): void {
    if (!value) {
      throw new ForbiddenWorkbookActionError(message);
    }
  }

  private async operation<T>(
    operation: string,
    lineage: CreateWorkbookCommand["lineage"] | null,
    fn: () => Promise<T>,
  ): Promise<T> {
    return instrumentation.run(operation, { lineage }, fn);
  }
}
