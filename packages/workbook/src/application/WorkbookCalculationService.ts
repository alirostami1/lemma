import type { OperationLineage } from "@lemma/domain";
import { instrumentService } from "@lemma/observability";
import {
  assertWorkbookIsUsable,
  cancelWorkbookCalculation,
  createRetryWorkbookCalculation,
  InvalidWorkbookFieldError,
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
  WorkbookSnapshotRangeBatchCommand,
  WorkbookSnapshotRangeCommand,
} from "./commands.js";
import type {
  WorkbookCalculationDto,
  WorkbookCalculationsResult,
  WorkbookEngineHealthResult,
  WorkbookSnapshotCellsResult,
  WorkbookSnapshotMetadataResult,
  WorkbookSnapshotRangeBatchResult,
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
import { WorkbookCalculationRequestAdapter } from "./WorkbookCalculationRequestAdapter.js";
import { WorkbookSnapshotService } from "./WorkbookSnapshotService.js";
import { normalizeWorkbookCalculationSources } from "./workbook-calculation-sources.js";
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
        const sources = normalizeWorkbookCalculationSources(
          command.sources,
          "sources",
        );
        const workbooks = await Promise.all(
          sources.map((source) =>
            this.deps.workbookRepository.findWorkbookById(
              toWorkbookId(source.workbookId),
            ),
          ),
        );
        const workbook = workbooks[0];
        if (!workbook || workbooks.some((item) => item === null)) {
          throw new WorkbookNotFoundError();
        }
        for (const sourceWorkbook of workbooks) {
          if (!sourceWorkbook) {
            throw new WorkbookNotFoundError();
          }
          assertWorkbookIsUsable(sourceWorkbook);
          if (sourceWorkbook.ownerUserId !== workbook.ownerUserId) {
            throw new InvalidWorkbookFieldError(
              "All calculation source workbooks must belong to the same owner.",
            );
          }
          this.assertAuthorized(
            canRequestWorkbookCalculation(command.currentUser, sourceWorkbook),
            "You cannot calculate this workbook.",
          );
        }
        const requested = await new WorkbookCalculationRequestAdapter(
          this.deps,
        ).requestCalculation({
          correlationId: command.correlationId ?? null,
          createdByUserId: command.currentUser.user.id,
          lineage: command.lineage,
          ownerUserId: workbook.ownerUserId,
          requestedCount: command.requestedCount,
          sources,
        });
        const created = await this.findCalculationByIdOrThrow(
          requested.workbookCalculationId,
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
        const retry = createRetryWorkbookCalculation(
          {
            createdByUserId: command.currentUser.user.id,
            id: this.deps.idGenerator.workbookCalculationId(),
            original: calculation,
          },
          this.deps.clock.now(),
        );
        const sources =
          await this.deps.workbookRepository.listWorkbookCalculationSources(
            calculation.id,
          );
        if (sources.length === 0) {
          throw new InvalidWorkbookFieldError(
            "Workbook calculation has no persisted sources to retry.",
          );
        }
        const retrySources = sources.map((source) => ({
          sourceId: source.sourceId,
          workbookId: source.workbookId,
        }));
        const created = await this.deps.workbookTransaction.transaction(
          async ({ workbookRepository, outboxRepository }) => {
            const persisted =
              await workbookRepository.createWorkbookCalculationWithSources({
                calculation: retry,
                sources: retrySources,
              });
            await outboxRepository.appendEvents([
              workbookCalculationRequestedEvent({
                calculation: persisted,
                id: this.deps.idGenerator.eventId(),
                lineage: command.lineage,
                occurredAt: persisted.createdAt,
                sources: retrySources,
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

  async getWorkbookSnapshotRangeBatch(
    command: WorkbookSnapshotRangeBatchCommand,
  ): Promise<WorkbookSnapshotRangeBatchResult> {
    return this.snapshotService.getWorkbookSnapshotRangeBatch(command);
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
