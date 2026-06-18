import type { OperationLineage } from "@lemma/domain";
import { instrumentService } from "@lemma/observability";
import {
  assertWorkbookIsUsable,
  cancelWorkbookCalculation,
  createWorkbookCalculation,
  workbookCalculationId as toWorkbookCalculationId,
  workbookId as toWorkbookId,
} from "../domain/index.js";
import type {
  CreateWorkbookCalculationCommand,
  ListWorkbookCalculationsCommand,
  ListWorkbookSnapshotSheetsCommand,
  ListWorkbookSnapshotsCommand,
  ProcessWorkbookCalculationCommand,
  ResolveWorkbookSnapshotValueCommand,
  RetryWorkbookCalculationCommand,
  WorkbookCalculationByIdCommand,
  WorkbookSnapshotByIdCommand,
  WorkbookSnapshotCellsCommand,
  WorkbookSnapshotMetadataCommand,
  WorkbookSnapshotRangeCommand,
} from "./commands.js";
import type {
  WorkbookCalculationDto,
  WorkbookCalculationsResult,
  WorkbookEngineHealthResult,
  WorkbookSnapshotCellsResult,
  WorkbookSnapshotMetadataResult,
  WorkbookSnapshotRangeResult,
  WorkbookSnapshotResult,
  WorkbookSnapshotSheetsResult,
  WorkbookSnapshotsResult,
  WorkbookSnapshotValueResult,
} from "./dto.js";
import {
  ForbiddenWorkbookActionError,
  WorkbookCalculationNotFoundError,
  WorkbookNotFoundError,
} from "./errors.js";
import {
  canManageWorkbookCalculation,
  canRequestWorkbookCalculation,
  canViewWorkbookCalculation,
} from "./policies.js";
import type {
  Clock,
  IdGenerator,
  WorkbookCalculator,
  WorkbookFileProviderPort,
  WorkbookRepository,
  WorkbookTransactionPort,
} from "./ports.js";
import { WorkbookCalculationListService } from "./WorkbookCalculationListService.js";
import { WorkbookCalculationProcessorService } from "./WorkbookCalculationProcessorService.js";
import { WorkbookSnapshotService } from "./WorkbookSnapshotService.js";
import { workbookCalculationRequestedEvent } from "./workbook-events.js";

const instrumentation = instrumentService("workbook", "calculation_service");

export class WorkbookCalculationService {
  private readonly listService: WorkbookCalculationListService;
  private readonly processorService: WorkbookCalculationProcessorService;
  private readonly snapshotService: WorkbookSnapshotService;

  constructor(
    private readonly deps: {
      workbookRepository: WorkbookRepository;
      workbookTransaction: WorkbookTransactionPort;
      workbookFileProvider: WorkbookFileProviderPort;
      workbookCalculator: WorkbookCalculator;
      idGenerator: IdGenerator;
      clock: Clock;
    },
  ) {
    this.listService = new WorkbookCalculationListService({
      workbookRepository: deps.workbookRepository,
    });
    this.processorService = new WorkbookCalculationProcessorService(deps);
    this.snapshotService = new WorkbookSnapshotService({
      workbookRepository: deps.workbookRepository,
    });
  }

  async listWorkbookCalculations(
    command: ListWorkbookCalculationsCommand,
  ): Promise<WorkbookCalculationsResult> {
    return this.listService.listWorkbookCalculations(command);
  }

  async requestWorkbookCalculation(
    command: CreateWorkbookCalculationCommand,
  ): Promise<WorkbookCalculationDto> {
    return this.operation(
      "request_workbook_calculation",
      command.lineage,
      async () => {
        const workbook = await this.deps.workbookRepository.findWorkbookById(
          toWorkbookId(command.workbookId),
        );
        if (!workbook) {
          throw new WorkbookNotFoundError();
        }
        this.assertAuthorized(
          canRequestWorkbookCalculation(command.currentUser, workbook),
          "You cannot calculate this workbook.",
        );
        assertWorkbookIsUsable(workbook);
        const at = this.deps.clock.now();
        const calculation = createWorkbookCalculation(
          {
            id: this.deps.idGenerator.workbookCalculationId(),
            ownerUserId: workbook.ownerUserId,
            createdByUserId: command.currentUser.user.id,
            workbookId: workbook.id,
            requestedCount: command.requestedCount,
            correlationId: command.correlationId,
          },
          at,
        );
        const created = await this.deps.workbookTransaction.transaction(
          async ({ workbookRepository, outboxRepository }) => {
            const persisted =
              await workbookRepository.createWorkbookCalculation(calculation);
            await outboxRepository.appendEvents([
              workbookCalculationRequestedEvent({
                id: this.deps.idGenerator.eventId(),
                calculation: persisted,
                lineage: command.lineage,
                occurredAt: persisted.createdAt,
              }),
            ]);
            return persisted;
          },
        );

        return {
          workbookCalculation: created,
        };
      },
    );
  }

  async getWorkbookCalculation(
    command: WorkbookCalculationByIdCommand,
  ): Promise<WorkbookCalculationDto> {
    const calculation = await this.findCalculationByIdOrThrow(
      command.workbookCalculationId,
    );
    this.assertAuthorized(
      canViewWorkbookCalculation(command.currentUser, calculation),
      "You cannot view this workbook calculation.",
    );
    return { workbookCalculation: calculation };
  }

  async cancelWorkbookCalculation(
    command: WorkbookCalculationByIdCommand,
  ): Promise<void> {
    const calculation = await this.findCalculationByIdOrThrow(
      command.workbookCalculationId,
    );
    this.assertAuthorized(
      canManageWorkbookCalculation(command.currentUser, calculation),
      "You cannot cancel this workbook calculation.",
    );
    await this.deps.workbookRepository.updateWorkbookCalculation(
      cancelWorkbookCalculation(calculation, this.deps.clock.now()),
    );
  }

  async retryWorkbookCalculation(
    command: RetryWorkbookCalculationCommand,
  ): Promise<WorkbookCalculationDto> {
    return this.operation(
      "retry_workbook_calculation",
      command.lineage,
      async () => {
        const calculation = await this.findCalculationByIdOrThrow(
          command.workbookCalculationId,
        );
        this.assertAuthorized(
          canManageWorkbookCalculation(command.currentUser, calculation),
          "You cannot retry this workbook calculation.",
        );
        return this.requestWorkbookCalculation({
          currentUser: command.currentUser,
          workbookId: calculation.workbookId,
          requestedCount: calculation.requestedCount,
          correlationId: calculation.correlationId,
          lineage: command.lineage,
        });
      },
    );
  }

  async processWorkbookCalculation(
    command: ProcessWorkbookCalculationCommand,
  ): Promise<void> {
    await this.processorService.processWorkbookCalculation(command);
  }

  async listWorkbookSnapshots(
    command: ListWorkbookSnapshotsCommand,
  ): Promise<WorkbookSnapshotsResult> {
    return this.snapshotService.listWorkbookSnapshots(command);
  }

  async getWorkbookSnapshot(
    command: WorkbookSnapshotByIdCommand,
  ): Promise<WorkbookSnapshotResult> {
    return this.snapshotService.getWorkbookSnapshot(command);
  }

  async getWorkbookSnapshotMetadata(
    command: WorkbookSnapshotMetadataCommand,
  ): Promise<WorkbookSnapshotMetadataResult> {
    return this.snapshotService.getWorkbookSnapshotMetadata(command);
  }

  async listWorkbookSnapshotSheets(
    command: ListWorkbookSnapshotSheetsCommand,
  ): Promise<WorkbookSnapshotSheetsResult> {
    return this.snapshotService.listWorkbookSnapshotSheets(command);
  }

  async getWorkbookSnapshotCells(
    command: WorkbookSnapshotCellsCommand,
  ): Promise<WorkbookSnapshotCellsResult> {
    return this.snapshotService.getWorkbookSnapshotCells(command);
  }

  async getWorkbookSnapshotRange(
    command: WorkbookSnapshotRangeCommand,
  ): Promise<WorkbookSnapshotRangeResult> {
    return this.snapshotService.getWorkbookSnapshotRange(command);
  }

  async resolveWorkbookSnapshotValue(
    command: ResolveWorkbookSnapshotValueCommand,
  ): Promise<WorkbookSnapshotValueResult> {
    return this.snapshotService.resolveWorkbookSnapshotValue(command);
  }

  async resolveWorkbookSnapshotValueForInternal(
    command: Omit<ResolveWorkbookSnapshotValueCommand, "currentUser">,
  ): Promise<WorkbookSnapshotValueResult> {
    return this.snapshotService.resolveWorkbookSnapshotValueForInternal(
      command,
    );
  }

  async engineHealth(): Promise<WorkbookEngineHealthResult> {
    return this.operation("engine_health", null, async () => ({
      health: await this.deps.workbookCalculator.health(),
    }));
  }

  async findCalculationByIdOrThrow(workbookCalculationId: string) {
    const calculation =
      await this.deps.workbookRepository.findWorkbookCalculationById(
        toWorkbookCalculationId(workbookCalculationId),
      );
    if (!calculation) {
      throw new WorkbookCalculationNotFoundError();
    }
    return calculation;
  }

  private assertAuthorized(value: boolean, message: string): void {
    if (!value) {
      throw new ForbiddenWorkbookActionError(message);
    }
  }

  private async operation<T>(
    operation: string,
    lineage: OperationLineage | null,
    fn: () => Promise<T>,
  ): Promise<T> {
    return instrumentation.run(operation, { lineage }, fn);
  }
}
