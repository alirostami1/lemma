import type { OperationLineage } from "@lemma/domain";
import { instrumentService } from "@lemma/observability";
import {
  assertWorkbookIsUsable,
  createWorkbookSnapshot,
  markWorkbookCalculationFailed,
  markWorkbookCalculationSucceeded,
  workbookCalculationId as toWorkbookCalculationId,
  workbookId as toWorkbookId,
  type WorkbookCalculation,
  type WorkbookSnapshot,
} from "../domain/index.js";
import type { ProcessWorkbookCalculationCommand } from "./commands.js";
import { WorkbookNotFoundError } from "./errors.js";
import type {
  Clock,
  IdGenerator,
  WorkbookCalculator,
  WorkbookFileProviderPort,
  WorkbookRepository,
  WorkbookTransactionPort,
} from "./ports.js";
import {
  normalizeWorkbookCalculationSources,
  type WorkbookCalculationSource,
} from "./workbook-calculation-sources.js";
import { workbookCalculationFinishedEvent } from "./workbook-events.js";
import { withWorkbookTempFile } from "./workbook-temp-file.js";

const instrumentation = instrumentService("workbook", "calculation_processor");

export class WorkbookCalculationProcessorService {
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

  async processWorkbookCalculation(
    command: ProcessWorkbookCalculationCommand,
  ): Promise<void> {
    await this.operation("process_workbook_calculation", command.lineage, () =>
      this.processQueuedWorkbookCalculation(command),
    );
  }

  private async processQueuedWorkbookCalculation(
    command: ProcessWorkbookCalculationCommand,
  ): Promise<void> {
    const running =
      await this.deps.workbookRepository.claimQueuedWorkbookCalculation(
        toWorkbookCalculationId(command.workbookCalculationId),
        this.deps.clock.now(),
      );
    if (!running) {
      return;
    }

    try {
      const calculated = await this.calculateSnapshots(
        running,
        command.sources,
        command.lineage,
      );
      await this.succeedRunningCalculation({
        running,
        snapshots: calculated.snapshots,
        sources: calculated.sources,
        finishedAt: calculated.finishedAt,
        lineage: command.lineage,
      });
    } catch (error) {
      await this.failRunningCalculation({
        running,
        sources: command.sources,
        error,
        lineage: command.lineage,
      });
    }
  }

  private async calculateSnapshots(
    running: WorkbookCalculation,
    sources: readonly WorkbookCalculationSource[],
    lineage: OperationLineage,
  ): Promise<{
    snapshots: WorkbookSnapshot[];
    finishedAt: Date;
    sources: readonly WorkbookCalculationSource[];
  }> {
    const normalizedSources = normalizeWorkbookCalculationSources(
      sources,
      "sources",
    );
    const finishedAt = this.deps.clock.now();
    const snapshots: WorkbookSnapshot[] = [];

    for (const [sourceIndex, source] of normalizedSources.entries()) {
      const workbook = await this.deps.workbookRepository.findWorkbookById(
        toWorkbookId(source.workbookId),
      );

      if (!workbook) {
        throw new WorkbookNotFoundError();
      }

      assertWorkbookIsUsable(workbook);

      const file =
        await this.deps.workbookFileProvider.readWorkbookFileContentForOwnerUserId(
          {
            ownerUserId: workbook.ownerUserId,
            fileId: workbook.fileId,
          },
        );

      const values = await withWorkbookTempFile(file, (path) =>
        this.deps.workbookCalculator.calculateBatch(
          path,
          running.requestedCount,
          { lineage },
        ),
      );

      snapshots.push(
        ...values.map((snapshotValues, questionIndex) =>
          createWorkbookSnapshot(
            {
              id: this.deps.idGenerator.workbookSnapshotId(),
              workbookId: workbook.id,
              calculationId: running.id,
              snapshotIndex: questionIndex * normalizedSources.length + sourceIndex,
              values: snapshotValues,
            },
            finishedAt,
          ),
        ),
      );
    }

    return {
      finishedAt,
      sources: normalizedSources,
      snapshots: snapshots.sort((left, right) => {
        return left.snapshotIndex - right.snapshotIndex;
      }),
    };
  }

  private async succeedRunningCalculation(input: {
    running: WorkbookCalculation;
    snapshots: readonly WorkbookSnapshot[];
    sources: readonly WorkbookCalculationSource[];
    finishedAt: Date;
    lineage: OperationLineage;
  }): Promise<void> {
    await this.deps.workbookTransaction.transaction(
      async ({ workbookRepository, outboxRepository }) => {
        const result = await workbookRepository.completeWorkbookCalculation({
          calculation: markWorkbookCalculationSucceeded(
            input.running,
            input.finishedAt,
          ),
          snapshots: input.snapshots,
        });
        await outboxRepository.appendEvents([
          this.finishedCalculationEvent({
            calculation: result.calculation,
            sources: input.sources,
            snapshots: sortSnapshotsByIndex(result.snapshots),
            lineage: input.lineage,
          }),
        ]);
      },
    );
  }

  private async failRunningCalculation(input: {
    running: WorkbookCalculation;
    sources: readonly WorkbookCalculationSource[];
    error: unknown;
    lineage: OperationLineage;
  }): Promise<void> {
    const failed = markWorkbookCalculationFailed(
      input.running,
      errorMessageFromUnknown(input.error, "Workbook calculation failed."),
      this.deps.clock.now(),
    );

    await this.deps.workbookTransaction.transaction(
      async ({ workbookRepository, outboxRepository }) => {
        const updated =
          (await workbookRepository.updateWorkbookCalculation(failed)) ??
          failed;
        await outboxRepository.appendEvents([
          this.finishedCalculationEvent({
            calculation: updated,
            sources: input.sources,
            lineage: input.lineage,
          }),
        ]);
      },
    );
  }

  private finishedCalculationEvent(input: {
    calculation: WorkbookCalculation;
    sources: readonly WorkbookCalculationSource[];
    snapshots?: readonly WorkbookSnapshot[];
    lineage: OperationLineage;
  }) {
    return workbookCalculationFinishedEvent({
      id: this.deps.idGenerator.eventId(),
      calculation: input.calculation,
      sources: input.sources,
      snapshots: input.snapshots,
      lineage: input.lineage,
      occurredAt: input.calculation.updatedAt,
    });
  }

  private async operation<T>(
    operation: string,
    lineage: OperationLineage | null,
    fn: () => Promise<T>,
  ): Promise<T> {
    return instrumentation.run(operation, { lineage }, fn);
  }
}

function errorMessageFromUnknown(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function sortSnapshotsByIndex(
  snapshots: readonly WorkbookSnapshot[],
): WorkbookSnapshot[] {
  return [...snapshots].sort((left, right) => {
    return left.snapshotIndex - right.snapshotIndex;
  });
}
