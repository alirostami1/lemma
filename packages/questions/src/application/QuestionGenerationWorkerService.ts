import type { OperationLineage } from "@lemma/domain";
import type { DomainEventEnvelope } from "@lemma/events/domain";
import { instrumentService } from "@lemma/observability";
import {
  createQuestion,
  createQuestionSetQuestion,
  InvalidQuestionStateTransitionError,
  isTerminalRun,
  markQuestionGenerationRunFailed,
  markQuestionGenerationRunMaterializing,
  markQuestionGenerationRunSucceeded,
  markQuestionGenerationRunWaitingForWorkbookCalculation,
  type Question,
  type QuestionBlueprintVersion,
  type QuestionGenerationRun,
  type QuestionGenerationRunId,
  type QuestionProducer,
  type QuestionSetQuestion,
  questionProducer,
  questionGenerationRunId as toQuestionGenerationRunId,
  questionId as toQuestionId,
  workbookSnapshotId as toWorkbookSnapshotId,
  type WorkbookSnapshotId,
} from "../domain/index.js";
import { CanonicalQuestionMaterializer } from "./CanonicalQuestionMaterializer.js";
import type { QuestionGenerationRunResultDto } from "./dto.js";
import {
  InvalidQuestionBlueprintError,
  QuestionBlueprintNotFoundError,
  QuestionGenerationRunNotFoundError,
  UnsupportedQuestionValueExpressionError,
  WorkbookQuestionSourceError,
} from "./errors.js";
import type {
  Clock,
  IdGenerator,
  QuestionGenerationTransactionPort,
  QuestionsRepository,
  QuestionValueResolverPort,
  WorkbookCalculationPort,
} from "./ports.js";
import { blueprintRequiresWorkbookSource } from "./question-blueprint-analysis.js";
import {
  questionGenerationRunFailedEvent,
  questionGenerationRunMaterializingEvent,
  questionGenerationRunSucceededEvent,
  questionGenerationRunWaitingForWorkbookCalculationEvent,
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
      workbookSnapshotIds: WorkbookSnapshotId[];
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
      questionGenerationTransaction: QuestionGenerationTransactionPort;
      idGenerator: IdGenerator;
      clock: Clock;
    },
  ) {}

  async orchestrateQuestionGenerationRun(input: {
    questionGenerationRunId: string;
    workbookCalculationId?: string | null;
    workbookSnapshotIds?: readonly string[];
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
          runId: active.questionGenerationRun.id,
          lineage: input.lineage,
          execute: async () => {
            const version = await this.loadBlueprintVersion(
              active.questionGenerationRun,
            );
            return this.orchestrateActiveRun(
              active.questionGenerationRun,
              version,
              input,
            );
          },
        });
      },
    );
  }

  async materializeQuestionGenerationRun(input: {
    questionGenerationRunId: string;
    workbookSnapshotIds: readonly string[];
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
          runId: active.questionGenerationRun.id,
          lineage: input.lineage,
          execute: () =>
            this.materializeActiveRun(
              active.questionGenerationRun,
              input.workbookSnapshotIds.map(toWorkbookSnapshotId),
              input.lineage,
            ),
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
    version: QuestionBlueprintVersion,
    input: {
      workbookCalculationId?: string | null;
      workbookSnapshotIds?: readonly string[];
      workbookCalculationErrorMessage?: string | null;
      lineage: OperationLineage;
    },
  ): Promise<QuestionGenerationOrchestrationResult> {
    if (input.workbookCalculationErrorMessage) {
      return this.failRun(
        run.id,
        new WorkbookQuestionSourceError(
          `workbook calculation failed: ${input.workbookCalculationErrorMessage}`,
        ),
        input.lineage,
      );
    }

    const resolved = await this.resolveMaterializationInputs(
      run,
      version,
      input,
    );
    if (resolved.status === "waiting_for_workbook_calculation") {
      return resolved;
    }

    const activeRun = await this.findActiveRun(run.id);
    if (!activeRun) {
      return this.skippedTerminalRun(run.id);
    }

    return {
      status: "materialization_ready",
      questionGenerationRun: activeRun,
      workbookSnapshotIds: resolved.workbookSnapshotIds,
      lineage: input.lineage,
    };
  }

  private async materializeActiveRun(
    run: QuestionGenerationRun,
    workbookSnapshotIds: readonly WorkbookSnapshotId[],
    lineage: OperationLineage,
  ): Promise<QuestionGenerationWorkerResult> {
    const version = await this.loadBlueprintVersion(run);
    const materializing = await this.persistRunWithEvents(
      markQuestionGenerationRunMaterializing(run, this.deps.clock.now()),
      (persisted, occurredAt) => [
        questionGenerationRunMaterializingEvent({
          id: this.deps.idGenerator.eventId(),
          run: persisted,
          lineage,
          occurredAt,
        }),
      ],
    );

    const materialized = await this.materializeRunFromVersion(
      materializing,
      version,
      workbookSnapshotIds,
    );
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
          run: succeeded,
          questions: materialized.questions,
          memberships: materialized.memberships,
        });
        if (!saved) {
          return null;
        }
        await outboxRepository.appendEvents([
          questionGenerationRunSucceededEvent({
            id: this.deps.idGenerator.eventId(),
            run: saved,
            lineage,
            occurredAt,
          }),
          questionSetQuestionsAddedEvent({
            id: this.deps.idGenerator.eventId(),
            run: saved,
            questionIds: materialized.questions.map((question) => question.id),
            lineage,
            occurredAt,
          }),
        ]);
        return saved;
      },
    );
    if (!completed) {
      return this.skippedTerminalRun(succeeded.id);
    }

    return { status: "processed", questionGenerationRun: completed };
  }

  private async resolveMaterializationInputs(
    run: QuestionGenerationRun,
    version: QuestionBlueprintVersion,
    input: {
      workbookCalculationId?: string | null;
      workbookSnapshotIds?: readonly string[];
      lineage: OperationLineage;
    },
  ): Promise<
    | {
        status: "materialization_ready";
        workbookSnapshotIds: WorkbookSnapshotId[];
      }
    | {
        status: "waiting_for_workbook_calculation";
        questionGenerationRun: QuestionGenerationRun;
      }
  > {
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

  private async materializeRunFromVersion(
    run: QuestionGenerationRun,
    version: QuestionBlueprintVersion,
    workbookSnapshotIds: readonly WorkbookSnapshotId[],
  ): Promise<{
    questions: Question[];
    memberships: QuestionSetQuestion[];
  }> {
    if (
      blueprintRequiresWorkbookSource(version.document) &&
      workbookSnapshotIds.length === 0
    ) {
      throw new WorkbookQuestionSourceError(
        "generation run has no workbook snapshot",
      );
    }
    if (
      blueprintRequiresWorkbookSource(version.document) &&
      !run.source?.workbookSnapshotId &&
      workbookSnapshotIds.length < run.requestedCount
    ) {
      throw new WorkbookQuestionSourceError(
        "workbook calculation produced fewer snapshots than requested",
      );
    }

    const materializer = new CanonicalQuestionMaterializer(
      this.deps.questionValueResolverPort,
    );
    const questions: Question[] = [];
    for (let index = 0; index < run.requestedCount; index += 1) {
      const workbookSnapshotId =
        workbookSnapshotIds[index] ?? workbookSnapshotIds[0] ?? null;
      const questionSource =
        run.source && workbookSnapshotId
          ? {
              ...run.source,
              workbookSnapshotId,
            }
          : run.source;
      const materialized = await materializer.materialize({
        document: version.document,
        workbookSnapshotId,
      });
      questions.push(
        createQuestion(
          {
            id: toQuestionId(this.deps.idGenerator.questionId()),
            ownerUserId: run.ownerUserId,
            createdByUserId: run.createdByUserId,
            blueprintId: run.blueprintId,
            blueprintVersionId: version.id,
            generationRunId: run.id,
            body: materialized.body,
            solution: materialized.solution,
            sourcePlan: materialized.sourcePlan,
            producer: this.createGenerationProducer({ run, version }),
            source: questionSource,
          },
          this.deps.clock.now(),
        ),
      );
    }
    return {
      questions,
      memberships: questions.map((question) =>
        createQuestionSetQuestion(
          {
            questionSetId: run.targetQuestionSetId,
            questionId: question.id,
            addedByUserId: run.createdByUserId,
          },
          this.deps.clock.now(),
        ),
      ),
    };
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
          run: persisted,
          lineage,
          occurredAt,
        }),
      ],
    );
    return { status: "failed", questionGenerationRun: failed };
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

  private async loadBlueprintVersion(
    run: QuestionGenerationRun,
  ): Promise<QuestionBlueprintVersion> {
    const version =
      await this.deps.questionsRepository.findQuestionBlueprintVersionById(
        run.blueprintVersionId,
      );
    if (!version || version.questionBlueprintId !== run.blueprintId) {
      throw new QuestionBlueprintNotFoundError();
    }
    return version;
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

    return { status: "active", questionGenerationRun: run };
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
      status: "skipped",
      questionGenerationRun,
      reason,
    };
  }

  private createGenerationProducer(input: {
    run: QuestionGenerationRun;
    version: QuestionBlueprintVersion;
  }): QuestionProducer {
    return questionProducer({
      schemaVersion: 1,
      compiler: "canonical-question-materializer@1",
      source: {
        blueprintId: input.run.blueprintId,
        blueprintVersionId: input.version.id,
        generationRunId: input.run.id,
      },
    });
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
    error instanceof WorkbookQuestionSourceError ||
    error instanceof InvalidQuestionStateTransitionError ||
    error instanceof QuestionBlueprintNotFoundError ||
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
