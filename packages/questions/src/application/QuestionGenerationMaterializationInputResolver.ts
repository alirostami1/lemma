import type { OperationLineage } from "@lemma/domain";
import type { DomainEventEnvelope } from "@lemma/events/domain";
import {
  markQuestionGenerationRunWaitingForWorkbookCalculation,
  type QuestionBlueprintVersion,
  type QuestionGenerationRun,
  workbookSnapshotId as toWorkbookSnapshotId,
  type WorkbookSnapshotId,
} from "../domain/index.js";
import {
  QuestionGenerationRunNotFoundError,
  WorkbookQuestionSourceError,
} from "./errors.js";
import type {
  Clock,
  IdGenerator,
  QuestionGenerationTransactionPort,
  WorkbookCalculationPort,
} from "./ports.js";
import { blueprintRequiresWorkbookSource } from "./question-blueprint-analysis.js";
import { questionGenerationRunWaitingForWorkbookCalculationEvent } from "./question-generation-events.js";

export type QuestionGenerationMaterializationInputResult =
  | {
      status: "materialization_ready";
      workbookSnapshotIds: WorkbookSnapshotId[];
    }
  | {
      status: "waiting_for_workbook_calculation";
      questionGenerationRun: QuestionGenerationRun;
    };

export class QuestionGenerationMaterializationInputResolver {
  constructor(
    private readonly deps: {
      workbookCalculationPort: WorkbookCalculationPort;
      questionGenerationTransaction: QuestionGenerationTransactionPort;
      idGenerator: IdGenerator;
      clock: Clock;
    },
  ) {}

  async resolve(input: {
    run: QuestionGenerationRun;
    version: QuestionBlueprintVersion;
    workbookCalculationId?: string | null;
    workbookSnapshotIds?: readonly string[];
    lineage: OperationLineage;
  }): Promise<QuestionGenerationMaterializationInputResult> {
    const { run, version } = input;
    const requiresWorkbook = blueprintRequiresWorkbookSource(version.document);
    if (!requiresWorkbook) {
      return { status: "materialization_ready", workbookSnapshotIds: [] };
    }
    if (!run.source) {
      throw new WorkbookQuestionSourceError(
        "generation run has no workbook source",
      );
    }
    if (run.source.workbookSnapshotId) {
      return {
        status: "materialization_ready",
        workbookSnapshotIds: [run.source.workbookSnapshotId],
      };
    }
    if (input.workbookSnapshotIds && input.workbookSnapshotIds.length > 0) {
      if (
        input.workbookCalculationId &&
        run.source.workbookCalculationId &&
        input.workbookCalculationId !== run.source.workbookCalculationId
      ) {
        throw new WorkbookQuestionSourceError(
          "workbook calculation does not match generation run",
        );
      }
      return {
        status: "materialization_ready",
        workbookSnapshotIds:
          input.workbookSnapshotIds.map(toWorkbookSnapshotId),
      };
    }

    if (!run.source.workbookCalculationId) {
      const requested =
        await this.deps.workbookCalculationPort.requestCalculation({
          createdByUserId: run.createdByUserId,
          workbookId: run.source.workbookId,
          workbookSources: version.workbookSources.map((source) => ({
            sourceId: source.sourceId,
            workbookId: source.workbookId,
          })),
          requestedCount: run.requestedCount,
          correlationId: run.id,
          lineage: input.lineage,
        });
      const waiting = await this.persistRunWithEvents(
        markQuestionGenerationRunWaitingForWorkbookCalculation(
          run,
          requested.workbookCalculationId,
          this.deps.clock.now(),
        ),
        (persisted, occurredAt) => [
          questionGenerationRunWaitingForWorkbookCalculationEvent({
            id: this.deps.idGenerator.eventId(),
            run: persisted,
            lineage: input.lineage,
            occurredAt,
          }),
        ],
      );
      return {
        status: "waiting_for_workbook_calculation",
        questionGenerationRun: waiting,
      };
    }

    return {
      status: "waiting_for_workbook_calculation",
      questionGenerationRun: run,
    };
  }

  private async persistRunWithEvents(
    run: QuestionGenerationRun,
    createEvents: (
      run: QuestionGenerationRun,
      occurredAt: Date,
    ) => readonly DomainEventEnvelope[],
  ): Promise<QuestionGenerationRun> {
    const occurredAt = this.deps.clock.now();
    return this.deps.questionGenerationTransaction.transaction(
      async ({ questionsRepository, outboxRepository }) => {
        const saved =
          await questionsRepository.updateQuestionGenerationRun(run);
        if (!saved) {
          throw new QuestionGenerationRunNotFoundError();
        }
        await outboxRepository.appendEvents(createEvents(saved, occurredAt));
        return saved;
      },
    );
  }
}
