import type { OperationLineage } from "@lemma/domain";
import type { DomainEventEnvelope } from "@lemma/events/domain";
import {
  markQuestionGenerationRunWaitingForWorkbookCalculation,
  type QuestionBlueprintSnapshot,
  type QuestionBlueprintSource,
  type QuestionGenerationRun,
  questionBlueprintSourcesReferencedByDocument,
  workbookSnapshotId as toWorkbookSnapshotId,
} from "../domain/index.js";
import {
  QuestionGenerationRunNotFoundError,
  WorkbookQuestionReferenceError,
} from "./errors.js";
import type {
  Clock,
  IdGenerator,
  QuestionGenerationSnapshotKey,
  QuestionGenerationTransactionPort,
  WorkbookCalculationPort,
  WorkbookSnapshotForQuestionGeneration,
  WorkbookSnapshotReadPort,
} from "./ports.js";
import {
  type ResolvedQuestionGenerationSnapshots,
  resolveQuestionGenerationSnapshots,
} from "./QuestionGenerationSnapshotResolver.js";
import { blueprintRequiresWorkbookSource } from "./question-blueprint-analysis.js";
import { questionGenerationRunWaitingForWorkbookCalculationEvent } from "./question-generation-events.js";

export type QuestionGenerationMaterializationInputResult =
  | {
      status: "materialization_ready";
      usedSources: readonly QuestionBlueprintSource[];
      snapshotsBySourceIdAndQuestionIndex: ReadonlyMap<
        QuestionGenerationSnapshotKey,
        WorkbookSnapshotForQuestionGeneration
      >;
      snapshotsByQuestionIndex: ResolvedQuestionGenerationSnapshots["snapshotsByQuestionIndex"];
    }
  | {
      status: "waiting_for_workbook_calculation";
      questionGenerationRun: QuestionGenerationRun;
    };

export class QuestionGenerationMaterializationInputResolver {
  constructor(
    private readonly deps: {
      workbookCalculationPort: WorkbookCalculationPort;
      workbookSnapshotReadPort: WorkbookSnapshotReadPort;
      questionGenerationTransaction: QuestionGenerationTransactionPort;
      idGenerator: IdGenerator;
      clock: Clock;
    },
  ) {}

  async resolve(input: {
    run: QuestionGenerationRun;
    blueprintSnapshot: QuestionBlueprintSnapshot;
    workbookCalculationId?: string | null;
    eventWorkbookSnapshotIds?: readonly string[];
    lineage: OperationLineage;
  }): Promise<QuestionGenerationMaterializationInputResult> {
    const requiresWorkbook = blueprintRequiresWorkbookSource(
      input.blueprintSnapshot.document,
    );
    const referencedSources = questionBlueprintSourcesReferencedByDocument(
      input.blueprintSnapshot.document,
      input.blueprintSnapshot.sources,
    );

    if (!requiresWorkbook) {
      return {
        snapshotsByQuestionIndex: new Map(),
        snapshotsBySourceIdAndQuestionIndex: new Map(),
        status: "materialization_ready",
        usedSources: [],
      };
    }

    if (!input.run.workbookCalculationId) {
      if (referencedSources.length === 0) {
        throw new WorkbookQuestionReferenceError(
          "generation run has no referenced workbook source",
        );
      }
      const requested =
        await this.deps.workbookCalculationPort.requestCalculation({
          correlationId: input.run.id,
          createdByUserId: input.run.createdByUserId,
          lineage: input.lineage,
          ownerUserId: input.run.ownerUserId,
          requestedCount: input.run.requestedCount,
          sources: referencedSources.map((source) => ({
            sourceId: source.sourceId,
            workbookId: source.workbookId,
          })),
        });
      const waiting = await this.persistRunWithEvents(
        markQuestionGenerationRunWaitingForWorkbookCalculation(
          input.run,
          requested.workbookCalculationId,
          this.deps.clock.now(),
        ),
        (persisted, occurredAt) => [
          questionGenerationRunWaitingForWorkbookCalculationEvent({
            id: this.deps.idGenerator.eventId(),
            lineage: input.lineage,
            occurredAt,
            run: persisted,
          }),
        ],
      );
      return {
        questionGenerationRun: waiting,
        status: "waiting_for_workbook_calculation",
      };
    }

    if (
      input.workbookCalculationId &&
      input.workbookCalculationId !== input.run.workbookCalculationId
    ) {
      throw new WorkbookQuestionReferenceError(
        "workbook calculation does not match generation run",
      );
    }

    const eventWorkbookSnapshotIds =
      input.eventWorkbookSnapshotIds?.map(toWorkbookSnapshotId);
    const snapshots =
      await this.deps.workbookSnapshotReadPort.listSnapshotMetadataForCalculation(
        {
          workbookCalculationId: input.run.workbookCalculationId,
        },
      );
    if (snapshots.length === 0) {
      return {
        questionGenerationRun: input.run,
        status: "waiting_for_workbook_calculation",
      };
    }
    const resolved = resolveQuestionGenerationSnapshots({
      eventWorkbookSnapshotIds,
      requestedCount: input.run.requestedCount,
      snapshots,
      usedSources: referencedSources,
      workbookCalculationId: input.run.workbookCalculationId,
    });

    return {
      snapshotsByQuestionIndex: resolved.snapshotsByQuestionIndex,
      snapshotsBySourceIdAndQuestionIndex:
        resolved.snapshotsBySourceIdAndQuestionIndex,
      status: "materialization_ready",
      usedSources: referencedSources,
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
