import { instrumentService } from "@lemma/observability";
import {
  assertWorkbookFileMetadata,
  createWorkbook as createWorkbookDomain,
  deleteWorkbook as deleteWorkbookDomain,
  fileId as toFileId,
  markWorkbookInvalid,
  markWorkbookValid,
  requestWorkbookValidation,
  type Workbook,
  updateWorkbook as updateWorkbookDomain,
  workbookId as toWorkbookId,
  workbookStatus,
} from "../domain/index.js";
import type {
  CreateWorkbookCommand,
  ListCommand,
  UpdateWorkbookCommand,
  ValidateWorkbookCommand,
  WorkbookByIdCommand,
} from "./commands.js";
import type { WorkbookResult, WorkbooksResult } from "./dto.js";
import {
  ForbiddenWorkbookActionError,
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
import { withWorkbookTempFile } from "./workbook-temp-file.js";
import {
  workbookValidationFinishedEvent,
  workbookValidationRequestedEvent,
} from "./workbook-events.js";

const instrumentation = instrumentService("workbook", "service");

export class WorkbookService {
  constructor(
    private readonly deps: {
      workbookRepository: WorkbookRepository;
      workbookTransaction: WorkbookTransactionPort;
      workbookFileProvider: WorkbookFileProviderPort;
      workbookCalculator: WorkbookCalculator;
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
          ownerUserId: command.currentUser.user.id,
          statuses: command.status
            ? [workbookStatus(command.status)]
            : undefined,
          limit: limit + 1,
          cursor: decodeListCursor(command.cursor),
        });
      return {
        workbooks: workbooks.slice(0, limit),
        nextCursor:
          workbooks.length > limit
            ? encodeListCursor(workbooks[limit - 1]?.createdAt)
            : null,
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
      const workbook = createWorkbookDomain(
        {
          id: this.deps.idGenerator.workbookId(),
          ownerUserId: command.currentUser.user.id,
          createdByUserId: command.currentUser.user.id,
          name: command.name,
          fileId: file.fileId,
          checksumSha256: file.checksumSha256,
          originalName: file.originalName,
          engine: "libreoffice",
        },
        this.deps.clock.now(),
      );
      const created = await this.deps.workbookTransaction.transaction(
        async ({ workbookRepository, outboxRepository }) => {
          const persisted = await workbookRepository.createWorkbook(workbook);
          await outboxRepository.appendEvents([
            workbookValidationRequestedEvent({
              id: this.deps.idGenerator.eventId(),
              workbook: persisted,
              lineage: command.lineage,
              occurredAt: persisted.createdAt,
            }),
          ]);
          return persisted;
        },
      );

      return { workbook: created };
    });
  }

  async getWorkbook(command: WorkbookByIdCommand): Promise<WorkbookResult> {
    return this.operation("get_workbook", null, async () => {
      const workbook = await this.findWorkbookByIdOrThrow(command.workbookId);
      this.assertAuthorized(
        canViewWorkbook(command.currentUser, workbook),
        "You cannot view this workbook.",
      );
      return { workbook };
    });
  }

  async updateWorkbook(
    command: UpdateWorkbookCommand,
  ): Promise<WorkbookResult> {
    return this.operation("update_workbook", null, async () => {
      const workbook = await this.findWorkbookByIdOrThrow(command.workbookId);
      this.assertAuthorized(
        canManageWorkbook(command.currentUser, workbook),
        "You cannot update this workbook.",
      );
      const updated = updateWorkbookDomain(
        workbook,
        {
          name: command.patch.name,
          status: command.patch.status
            ? workbookStatus(command.patch.status)
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

  async deleteWorkbook(command: WorkbookByIdCommand): Promise<void> {
    await this.operation("delete_workbook", null, async () => {
      const workbook = await this.findWorkbookByIdOrThrow(command.workbookId);
      this.assertAuthorized(
        canManageWorkbook(command.currentUser, workbook),
        "You cannot delete this workbook.",
      );
      await this.deps.workbookRepository.updateWorkbook(
        deleteWorkbookDomain(workbook, this.deps.clock.now()),
      );
    });
  }

  async validateWorkbook(
    command: ValidateWorkbookCommand,
  ): Promise<WorkbookResult> {
    return this.operation("validate_workbook", command.lineage, async () => {
      const workbook = await this.findWorkbookByIdOrThrow(command.workbookId);
      this.assertAuthorized(
        canValidateWorkbook(command.currentUser, workbook),
        "You cannot validate this workbook.",
      );
      return this.requestAndPersistWorkbookValidation(
        workbook,
        command.lineage,
      );
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
            workbook: updated,
            lineage,
            occurredAt: updated.updatedAt,
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
            workbook: updated,
            lineage,
            occurredAt: updated.updatedAt,
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
          ownerUserId: workbook.ownerUserId,
          fileId: workbook.fileId,
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
