import type { OperationLineage } from "@lemma/domain";
import { instrumentService } from "@lemma/observability";
import {
  assertWorkbookIsUsable,
  cancelWorkbookCalculation,
  createWorkbookCalculation,
  workbookCalculationId as toWorkbookCalculationId,
  workbookId as toWorkbookId,
  workbookCalculationStatus,
} from "../domain/index.js";
import type {
  CreateWorkbookCalculationCommand,
  ListWorkbookCalculationsCommand,
  ListWorkbookSnapshotsCommand,
  ProcessWorkbookCalculationCommand,
  ResolveWorkbookSnapshotValueCommand,
  RetryWorkbookCalculationCommand,
  WorkbookCalculationByIdCommand,
  WorkbookSnapshotByIdCommand,
} from "./commands.js";
import type {
  WorkbookCalculationDto,
  WorkbookCalculationsResult,
  WorkbookEngineHealthResult,
  WorkbookSnapshotResult,
  WorkbookSnapshotsResult,
  WorkbookSnapshotValueResult,
} from "./dto.js";
import {
  ForbiddenWorkbookActionError,
  WorkbookCalculationNotFoundError,
  WorkbookNotFoundError,
} from "./errors.js";
import {
  decodeListCursor,
  encodeListCursor,
  normalizeListLimit,
} from "./mappers.js";
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
import { WorkbookCalculationProcessorService } from "./WorkbookCalculationProcessorService.js";
import { WorkbookSnapshotService } from "./WorkbookSnapshotService.js";
import { workbookCalculationRequestedEvent } from "./workbook-events.js";

const instrumentation = instrumentService("workbook", "calculation_service");

export class WorkbookCalculationService {
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
    this.processorService = new WorkbookCalculationProcessorService(deps);
    this.snapshotService = new WorkbookSnapshotService({
      workbookRepository: deps.workbookRepository,
    });
  }

  async listWorkbookCalculations(
    command: ListWorkbookCalculationsCommand,
  ): Promise<WorkbookCalculationsResult> {
    const limit = normalizeListLimit(command.limit);
    const statuses = command.status
      ? [workbookCalculationStatus(command.status)]
      : undefined;
    const workbookId = command.workbookId
      ? toWorkbookId(command.workbookId)
      : undefined;
    if (workbookId) {
      const workbook =
        await this.deps.workbookRepository.findWorkbookById(workbookId);
      if (!workbook) {
        throw new WorkbookNotFoundError();
      }
      this.assertAuthorized(
        canRequestWorkbookCalculation(command.currentUser, workbook),
        "You cannot view workbook calculations.",
      );
      const calculations =
        await this.deps.workbookRepository.listWorkbookCalculationsByWorkbookId(
          {
            workbookId,
            statuses,
            limit: limit + 1,
            cursor: decodeListCursor(command.cursor),
          },
        );
      return {
        workbookCalculations: calculations.slice(0, limit),
        nextCursor:
          calculations.length > limit
            ? encodeListCursor(calculations[limit - 1]?.createdAt)
            : null,
      };
    }
    const calculations =
      await this.deps.workbookRepository.listWorkbookCalculationsByOwnerUserId({
        ownerUserId: command.currentUser.user.id,
        statuses,
        limit: limit + 1,
        cursor: decodeListCursor(command.cursor),
      });
    return {
      workbookCalculations: calculations.slice(0, limit),
      nextCursor:
        calculations.length > limit
          ? encodeListCursor(calculations[limit - 1]?.createdAt)
          : null,
    };
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
