import type { OperationLineage } from "@lemma/domain";
import { instrumentService } from "@lemma/observability";
import {
  assertWorkbookIsUsable,
  createWorkbookSnapshot,
  InvalidWorkbookFieldError,
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

    let sources: readonly WorkbookCalculationSource[] = [];
    try {
      sources = await this.loadCalculationSources(running.id);
      const calculated = await this.calculateSnapshots({
        lineage: command.lineage,
        running,
        sources,
      });
      await this.succeedRunningCalculation({
        finishedAt: calculated.finishedAt,
        lineage: command.lineage,
        running,
        snapshots: calculated.snapshots,
        sources,
      });
    } catch (error) {
      await this.failRunningCalculation({
        error,
        lineage: command.lineage,
        running,
        sources,
      });
    }
  }

  private async calculateSnapshots(input: {
    running: WorkbookCalculation;
    sources: readonly WorkbookCalculationSource[];
    lineage: OperationLineage;
  }): Promise<{
    snapshots: WorkbookSnapshot[];
    finishedAt: Date;
  }> {
    const normalizedSources = normalizeWorkbookCalculationSources(
      input.sources,
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
      if (workbook.ownerUserId !== input.running.ownerUserId) {
        throw new InvalidWorkbookFieldError(
          "All calculation source workbooks must belong to calculation owner.",
        );
      }

      const file =
        await this.deps.workbookFileProvider.readWorkbookFileContentForOwnerUserId(
          {
            fileId: workbook.fileId,
            ownerUserId: workbook.ownerUserId,
          },
        );

      const values = await withWorkbookTempFile(file, (path) =>
        this.deps.workbookCalculator.calculateBatch(
          path,
          input.running.requestedCount,
          { lineage: input.lineage },
        ),
      );
      if (values.length !== input.running.requestedCount) {
        throw new InvalidWorkbookFieldError(
          `Workbook calculator returned ${values.length} snapshots for source ${source.sourceId}; expected ${input.running.requestedCount}.`,
        );
      }

      snapshots.push(
        ...values.map((snapshotValues, questionIndex) =>
          createWorkbookSnapshot(
            {
              calculationId: input.running.id,
              id: this.deps.idGenerator.workbookSnapshotId(),
              questionIndex,
              snapshotIndex:
                questionIndex * normalizedSources.length + sourceIndex,
              sourceId: source.sourceId,
              values: snapshotValues,
              workbookId: workbook.id,
            },
            finishedAt,
          ),
        ),
      );
    }

    return {
      finishedAt,
      snapshots: snapshots.sort((left, right) => {
        return left.snapshotIndex - right.snapshotIndex;
      }),
    };
  }

  private async loadCalculationSources(
    calculationId: WorkbookCalculation["id"],
  ): Promise<WorkbookCalculationSource[]> {
    const sources =
      await this.deps.workbookRepository.listWorkbookCalculationSources(
        calculationId,
      );
    return sources
      .sort((left, right) => left.position - right.position)
      .map((source) => ({
        sourceId: source.sourceId,
        workbookId: source.workbookId,
      }));
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
            lineage: input.lineage,
            snapshots: sortSnapshotsByIndex(result.snapshots),
            sources: input.sources,
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
            lineage: input.lineage,
            sources: input.sources,
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
      calculation: input.calculation,
      id: this.deps.idGenerator.eventId(),
      lineage: input.lineage,
      occurredAt: input.calculation.updatedAt,
      snapshots: input.snapshots,
      sources: input.sources,
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
