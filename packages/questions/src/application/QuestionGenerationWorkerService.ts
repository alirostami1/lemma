import type { OperationLineage } from "@lemma/domain";
import type { DomainEventEnvelope } from "@lemma/events/domain";
import { instrumentService } from "@lemma/observability";
import {
  InvalidQuestionStateTransitionError,
  isTerminalRun,
  markQuestionGenerationRunFailed,
  markQuestionGenerationRunMaterializing,
  markQuestionGenerationRunSucceeded,
  type QuestionGenerationRun,
  type QuestionGenerationRunId,
  questionGenerationRunId as toQuestionGenerationRunId,
} from "../domain/index.js";
import type { QuestionGenerationRunResultDto } from "./dto.js";
import {
  InvalidQuestionBlueprintError,
  QuestionGenerationRunNotFoundError,
  UnsupportedQuestionValueExpressionError,
  WorkbookQuestionReferenceError,
} from "./errors.js";
import type {
  Clock,
  IdGenerator,
  QuestionGenerationTransactionPort,
  QuestionsRepository,
  QuestionValueResolverPort,
  WorkbookCalculationPort,
  WorkbookSnapshotReadPort,
} from "./ports.js";
import { QuestionGenerationMaterializationInputResolver } from "./QuestionGenerationMaterializationInputResolver.js";
import { QuestionGenerationRunMaterializer } from "./QuestionGenerationRunMaterializer.js";
import {
  questionGenerationRunFailedEvent,
  questionGenerationRunMaterializingEvent,
  questionGenerationRunSucceededEvent,
  questionSetQuestionsAddedEvent,
} from "./question-generation-events.js";

const instrumentation = instrumentService("questions", "generation_worker");

export type QuestionGenerationWorkerResult =
  | (QuestionGenerationRunResultDto & { status: "processed" | "failed" })
  | {
      status: "skipped";
      questionGenerationRun: QuestionGenerationRun | null;
      reason: "invalid_payload" | "not_found" | "terminal";
    };

type QuestionGenerationFailureResult =
  | (QuestionGenerationRunResultDto & { status: "failed" })
  | Extract<QuestionGenerationWorkerResult, { status: "skipped" }>;

type SkippedQuestionGenerationRunResult = Extract<
  QuestionGenerationWorkerResult,
  { status: "skipped" }
>;

type ActiveQuestionGenerationRunResult =
  | { status: "active"; questionGenerationRun: QuestionGenerationRun }
  | SkippedQuestionGenerationRunResult;

export type QuestionGenerationOrchestrationResult =
  | {
      status: "materialization_ready";
      questionGenerationRun: QuestionGenerationRun;
      eventWorkbookSnapshotIds: readonly string[];
      lineage: OperationLineage;
    }
  | {
      status: "waiting_for_workbook_calculation";
      questionGenerationRun: QuestionGenerationRun;
    }
  | {
      status: "failed";
      questionGenerationRun: QuestionGenerationRun;
    }
  | Extract<QuestionGenerationWorkerResult, { status: "skipped" }>;

export class QuestionGenerationWorkerService {
  constructor(
    private readonly deps: {
      questionsRepository: QuestionsRepository;
      questionValueResolverPort: QuestionValueResolverPort;
      workbookCalculationPort: WorkbookCalculationPort;
      workbookSnapshotReadPort: WorkbookSnapshotReadPort;
      questionGenerationTransaction: QuestionGenerationTransactionPort;
      idGenerator: IdGenerator;
      clock: Clock;
    },
  ) {}

  async orchestrateQuestionGenerationRun(input: {
    questionGenerationRunId: string;
    workbookCalculationId?: string | null;
    eventWorkbookSnapshotIds?: readonly string[];
    workbookCalculationErrorMessage?: string | null;
    lineage: OperationLineage;
  }): Promise<QuestionGenerationOrchestrationResult> {
    return this.operation(
      "orchestrate_question_generation_run",
      input.lineage,
      async () => {
        const active = await this.findActiveWorkflowRun(
          input.questionGenerationRunId,
        );
        if (active.status === "skipped") {
          return active;
        }

        return this.withPermanentFailureHandling({
          execute: async () =>
            this.orchestrateActiveRun(active.questionGenerationRun, input),
          lineage: input.lineage,
          runId: active.questionGenerationRun.id,
        });
      },
    );
  }

  async materializeQuestionGenerationRun(input: {
    questionGenerationRunId: string;
    eventWorkbookSnapshotIds: readonly string[];
    lineage: OperationLineage;
  }): Promise<QuestionGenerationWorkerResult> {
    return this.operation(
      "materialize_question_generation_run",
      input.lineage,
      async () => {
        const active = await this.findActiveWorkflowRun(
          input.questionGenerationRunId,
        );
        if (active.status === "skipped") {
          return active;
        }

        return this.withPermanentFailureHandling({
          execute: () =>
            this.materializeActiveRun(
              active.questionGenerationRun,
              input.eventWorkbookSnapshotIds,
              input.lineage,
            ),
          lineage: input.lineage,
          runId: active.questionGenerationRun.id,
        });
      },
    );
  }

  async reconcileFailedGenerationJob(input: {
    questionGenerationRunId: string;
    errorMessage?: string | null;
    lineage: OperationLineage;
  }): Promise<QuestionGenerationWorkerResult> {
    return this.operation(
      "reconcile_failed_generation_job",
      input.lineage,
      async () => {
        const runId = parseRunId(input.questionGenerationRunId);
        if (!runId) {
          return this.skippedRun(null, "invalid_payload");
        }

        return this.failRun(
          runId,
          new Error(failedGenerationJobMessage(input.errorMessage)),
          input.lineage,
        );
      },
    );
  }

  private async orchestrateActiveRun(
    run: QuestionGenerationRun,
    input: {
      workbookCalculationId?: string | null;
      eventWorkbookSnapshotIds?: readonly string[];
      workbookCalculationErrorMessage?: string | null;
      lineage: OperationLineage;
    },
  ): Promise<QuestionGenerationOrchestrationResult> {
    if (input.workbookCalculationErrorMessage) {
      return this.failRun(
        run.id,
        new WorkbookQuestionReferenceError(
          `workbook calculation failed: ${input.workbookCalculationErrorMessage}`,
        ),
        input.lineage,
      );
    }

    const resolved = await new QuestionGenerationMaterializationInputResolver({
      clock: this.deps.clock,
      idGenerator: this.deps.idGenerator,
      questionGenerationTransaction: this.deps.questionGenerationTransaction,
      workbookCalculationPort: this.deps.workbookCalculationPort,
      workbookSnapshotReadPort: this.deps.workbookSnapshotReadPort,
    }).resolve({
      blueprintSnapshot: run.blueprintSnapshot,
      eventWorkbookSnapshotIds: input.eventWorkbookSnapshotIds,
      lineage: input.lineage,
      run,
      workbookCalculationId: input.workbookCalculationId,
    });
    if (resolved.status === "waiting_for_workbook_calculation") {
      return resolved;
    }

    const activeRun = await this.findActiveRun(run.id);
    if (!activeRun) {
      return this.skippedTerminalRun(run.id);
    }

    return {
      eventWorkbookSnapshotIds: input.eventWorkbookSnapshotIds ?? [],
      lineage: input.lineage,
      questionGenerationRun: activeRun,
      status: "materialization_ready",
    };
  }

  private async materializeActiveRun(
    run: QuestionGenerationRun,
    eventWorkbookSnapshotIds: readonly string[],
    lineage: OperationLineage,
  ): Promise<QuestionGenerationWorkerResult> {
    const resolved = await new QuestionGenerationMaterializationInputResolver({
      clock: this.deps.clock,
      idGenerator: this.deps.idGenerator,
      questionGenerationTransaction: this.deps.questionGenerationTransaction,
      workbookCalculationPort: this.deps.workbookCalculationPort,
      workbookSnapshotReadPort: this.deps.workbookSnapshotReadPort,
    }).resolve({
      blueprintSnapshot: run.blueprintSnapshot,
      eventWorkbookSnapshotIds,
      lineage,
      run,
      workbookCalculationId: run.workbookCalculationId,
    });
    if (resolved.status === "waiting_for_workbook_calculation") {
      throw new WorkbookQuestionReferenceError(
        "Question generation run is not ready for materialization.",
      );
    }

    const materializing = await this.persistRunWithEvents(
      markQuestionGenerationRunMaterializing(run, this.deps.clock.now()),
      (persisted, occurredAt) => [
        questionGenerationRunMaterializingEvent({
          id: this.deps.idGenerator.eventId(),
          lineage,
          occurredAt,
          run: persisted,
        }),
      ],
    );

    const materialized = await new QuestionGenerationRunMaterializer({
      clock: this.deps.clock,
      idGenerator: this.deps.idGenerator,
      questionValueResolverPort: this.deps.questionValueResolverPort,
    }).materialize({
      blueprintSnapshot: materializing.blueprintSnapshot,
      run: materializing,
      snapshotsBySourceIdAndQuestionIndex:
        resolved.snapshotsBySourceIdAndQuestionIndex,
      usedSources: resolved.usedSources,
    });
    const beforeCommit = await this.findActiveRun(materializing.id);
    if (!beforeCommit) {
      return this.skippedTerminalRun(materializing.id);
    }

    const occurredAt = this.deps.clock.now();
    const succeeded = markQuestionGenerationRunSucceeded(
      beforeCommit,
      materialized.questions.map((question) => question.id),
      occurredAt,
    );

    const completed = await this.deps.questionGenerationTransaction.transaction(
      async ({ questionsRepository, outboxRepository }) => {
        const saved = await questionsRepository.completeQuestionGenerationRun({
          memberships: materialized.memberships,
          questions: materialized.questions,
          run: succeeded,
        });
        if (!saved) {
          return null;
        }
        await outboxRepository.appendEvents([
          questionGenerationRunSucceededEvent({
            id: this.deps.idGenerator.eventId(),
            lineage,
            occurredAt,
            run: saved,
          }),
          questionSetQuestionsAddedEvent({
            id: this.deps.idGenerator.eventId(),
            lineage,
            occurredAt,
            questionIds: materialized.questions.map((question) => question.id),
            run: saved,
          }),
        ]);
        return saved;
      },
    );
    if (!completed) {
      return this.skippedTerminalRun(succeeded.id);
    }

    return { questionGenerationRun: completed, status: "processed" };
  }

  private async failRun(
    runId: QuestionGenerationRunId,
    error: unknown,
    lineage: OperationLineage,
  ): Promise<QuestionGenerationFailureResult> {
    const run = await this.findActiveRun(runId);
    if (!run) {
      return this.skippedTerminalRun(runId);
    }
    const failed = await this.persistRunWithEvents(
      markQuestionGenerationRunFailed(
        run,
        error instanceof Error ? error.message : "Question generation failed.",
        this.deps.clock.now(),
      ),
      (persisted, occurredAt) => [
        questionGenerationRunFailedEvent({
          id: this.deps.idGenerator.eventId(),
          lineage,
          occurredAt,
          run: persisted,
        }),
      ],
    );
    return { questionGenerationRun: failed, status: "failed" };
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

  private async findActiveRun(
    id: QuestionGenerationRunId,
  ): Promise<QuestionGenerationRun | null> {
    const run = await this.findRunById(id);
    if (!run || isTerminalRun(run)) {
      return null;
    }
    return run;
  }

  private findRunById(id: QuestionGenerationRunId) {
    return this.deps.questionsRepository.findQuestionGenerationRunById(id);
  }

  private async findActiveWorkflowRun(
    questionGenerationRunId: string,
  ): Promise<ActiveQuestionGenerationRunResult> {
    const runId = parseRunId(questionGenerationRunId);
    if (!runId) {
      return this.skippedRun(null, "invalid_payload");
    }

    const run = await this.findRunById(runId);
    if (!run) {
      return this.skippedRun(null, "not_found");
    }
    if (isTerminalRun(run)) {
      return this.skippedRun(run, "terminal");
    }

    return { questionGenerationRun: run, status: "active" };
  }

  private async withPermanentFailureHandling<TResult>(input: {
    runId: QuestionGenerationRunId;
    lineage: OperationLineage;
    execute(): Promise<TResult>;
  }): Promise<TResult | QuestionGenerationFailureResult> {
    try {
      return await input.execute();
    } catch (error) {
      if (classifyQuestionGenerationError(error) === "transient") {
        throw error;
      }
      return this.failRun(input.runId, error, input.lineage);
    }
  }

  private async skippedTerminalRun(
    runId: QuestionGenerationRunId,
  ): Promise<SkippedQuestionGenerationRunResult> {
    return this.skippedRun(await this.findRunById(runId), "terminal");
  }

  private skippedRun(
    questionGenerationRun: QuestionGenerationRun | null,
    reason: SkippedQuestionGenerationRunResult["reason"],
  ): SkippedQuestionGenerationRunResult {
    return {
      questionGenerationRun,
      reason,
      status: "skipped",
    };
  }

  private async operation<T>(
    operation: string,
    lineage: OperationLineage,
    fn: () => Promise<T>,
  ): Promise<T> {
    return instrumentation.run(operation, { lineage }, fn);
  }
}

function classifyQuestionGenerationError(
  error: unknown,
): "permanent" | "transient" {
  if (
    error instanceof InvalidQuestionBlueprintError ||
    error instanceof UnsupportedQuestionValueExpressionError ||
    error instanceof WorkbookQuestionReferenceError ||
    error instanceof InvalidQuestionStateTransitionError ||
    error instanceof QuestionGenerationRunNotFoundError
  ) {
    return "permanent";
  }
  return "transient";
}

function failedGenerationJobMessage(message: string | null | undefined) {
  const normalized = message?.trim();
  if (!normalized) {
    return "Question generation job failed after queue retries.";
  }
  return `Question generation job failed after queue retries: ${normalized}`;
}

function parseRunId(value: string): QuestionGenerationRunId | null {
  try {
    return toQuestionGenerationRunId(value);
  } catch {
    return null;
  }
}
