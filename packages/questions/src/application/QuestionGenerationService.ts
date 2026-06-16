import type { DomainEventEnvelope } from "@lemma/events/domain";
import type { CurrentUser } from "@lemma/identity/application";
import { instrumentService } from "@lemma/observability";
import {
  assertQuestionGenerationRunCanRetry,
  cancelQuestionGenerationRun,
  createQuestionGenerationRun,
  type QuestionGenerationRun,
  questionBlueprintId as toQuestionBlueprintId,
  questionBlueprintVersionId as toQuestionBlueprintVersionId,
  questionGenerationRunId as toQuestionGenerationRunId,
  questionGenerationRunStatus as toQuestionGenerationRunStatus,
  questionSetId as toQuestionSetId,
  userId as toUserId,
  workbookId as toWorkbookId,
  type QuestionBlueprint,
  type QuestionBlueprintVersion,
  workbookQuestionSource,
} from "../domain/index.js";
import type {
  CreateQuestionGenerationRunCommand,
  ListCommand,
  QuestionGenerationRunByIdCommand,
  QuestionGenerationRunMutationCommand,
} from "./commands.js";
import type {
  QuestionGenerationRunResultDto,
  QuestionGenerationRunsResult,
} from "./dto.js";
import {
  ForbiddenQuestionActionError,
  InvalidQuestionBlueprintError,
  QuestionBlueprintNotFoundError,
  QuestionGenerationRunNotFoundError,
  QuestionSetNotFoundError,
} from "./errors.js";
import {
  decodeListCursor,
  encodeListCursor,
  normalizeListLimit,
} from "./mappers.js";
import {
  canManageQuestionGenerationRun,
  canManageQuestionSet,
  canViewQuestionBlueprint,
  canViewQuestionGenerationRun,
} from "./policies.js";
import type {
  Clock,
  IdGenerator,
  QuestionGenerationTransactionPort,
  QuestionsRepository,
  WorkbookAccessPort,
} from "./ports.js";
import { blueprintRequiresWorkbookSource } from "./question-blueprint-analysis.js";
import {
  questionGenerationRunCancelledEvent,
  questionGenerationRunRequestedEvent,
} from "./question-generation-events.js";

const instrumentation = instrumentService("questions", "generation_service");

export class QuestionGenerationService {
  constructor(
    private readonly deps: {
      questionsRepository: QuestionsRepository;
      workbookAccessPort: WorkbookAccessPort;
      questionGenerationTransaction: QuestionGenerationTransactionPort;
      idGenerator: IdGenerator;
      clock: Clock;
    },
  ) {}

  async listQuestionGenerationRuns(
    command: ListCommand & { status?: string },
  ): Promise<QuestionGenerationRunsResult> {
    const limit = normalizeListLimit(command.limit);
    const runs =
      await this.deps.questionsRepository.listQuestionGenerationRunsByOwnerUserId(
        {
          ownerUserId: toUserId(command.currentUser.user.id),
          statuses: command.status
            ? [toQuestionGenerationRunStatus(command.status)]
            : undefined,
          limit: limit + 1,
          cursor: decodeListCursor(command.cursor),
        },
      );
    return {
      questionGenerationRuns: runs.slice(0, limit),
      nextCursor:
        runs.length > limit
          ? encodeListCursor(runs[limit - 1]?.createdAt)
          : null,
    };
  }

  async createQuestionGenerationRun(
    command: CreateQuestionGenerationRunCommand,
  ): Promise<QuestionGenerationRunResultDto> {
    return this.operation(
      "create_question_generation_run",
      command.lineage,
      async () => {
        const { blueprint, version } =
          await this.loadGenerationBlueprintAndVersion(command);
        const explicitSource =
          command.source !== undefined && command.source !== null
            ? workbookQuestionSource(command.source)
            : null;
        this.assertWorkbookSourceIsAllowed({
          version,
          explicitSource,
        });
        const source = this.resolveGenerationSource({
          version,
          explicitSource,
        });
        await this.assertWorkbookSourceAccess(command.currentUser, source);

        const targetQuestionSetId = toQuestionSetId(command.targetQuestionSetId);
        const targetSet =
          await this.deps.questionsRepository.findQuestionSetById(
            targetQuestionSetId,
          );
        if (!targetSet) {
          throw new QuestionSetNotFoundError();
        }
        if (!canManageQuestionSet(command.currentUser, targetSet)) {
          throw new ForbiddenQuestionActionError(
            "You cannot generate into this question set.",
          );
        }

        if (blueprintRequiresWorkbookSource(version.document) && !source) {
          throw new InvalidQuestionBlueprintError(
            "blueprint requires workbook source",
          );
        }

        const at = this.deps.clock.now();
        const run = createQuestionGenerationRun(
          {
            id: toQuestionGenerationRunId(
              this.deps.idGenerator.questionGenerationRunId(),
            ),
            ownerUserId: toUserId(command.currentUser.user.id),
            createdByUserId: toUserId(command.currentUser.user.id),
            blueprintId: blueprint.id,
            blueprintVersionId: version.id,
            targetQuestionSetId,
            requestedCount: command.count,
            source,
          },
          at,
        );

        return {
          questionGenerationRun: await this.createQueuedRun(
            run,
            at,
            command.lineage,
          ),
        };
      },
    );
  }

  async getQuestionGenerationRun(
    command: QuestionGenerationRunByIdCommand,
  ): Promise<QuestionGenerationRunResultDto> {
    const run = await this.findRunByIdOrThrow(command.questionGenerationRunId);
    if (!canViewQuestionGenerationRun(command.currentUser, run)) {
      throw new ForbiddenQuestionActionError(
        "You cannot view this generation run.",
      );
    }
    return { questionGenerationRun: run };
  }

  async cancelQuestionGenerationRun(
    command: QuestionGenerationRunMutationCommand,
  ): Promise<void> {
    await this.operation(
      "cancel_question_generation_run",
      command.lineage,
      async () => {
        const run = await this.findRunByIdOrThrow(
          command.questionGenerationRunId,
        );
        if (!canManageQuestionGenerationRun(command.currentUser, run)) {
          throw new ForbiddenQuestionActionError(
            "You cannot cancel this generation run.",
          );
        }
        const at = this.deps.clock.now();
        await this.persistRunWithEvents(
          cancelQuestionGenerationRun(run, at),
          (persisted) => [
            questionGenerationRunCancelledEvent({
              id: this.deps.idGenerator.eventId(),
              run: persisted,
              lineage: command.lineage,
              occurredAt: at,
            }),
          ],
        );
      },
    );
  }

  async retryQuestionGenerationRun(
    command: QuestionGenerationRunMutationCommand,
  ): Promise<QuestionGenerationRunResultDto> {
    return this.operation(
      "retry_question_generation_run",
      command.lineage,
      async () => {
        const run = await this.findRunByIdOrThrow(
          command.questionGenerationRunId,
        );
        if (!canManageQuestionGenerationRun(command.currentUser, run)) {
          throw new ForbiddenQuestionActionError(
            "You cannot retry this generation run.",
          );
        }
        assertQuestionGenerationRunCanRetry(run);
        const at = this.deps.clock.now();
        const retry = createQuestionGenerationRun(
          {
            id: toQuestionGenerationRunId(
              this.deps.idGenerator.questionGenerationRunId(),
            ),
            ownerUserId: run.ownerUserId,
            createdByUserId: toUserId(command.currentUser.user.id),
            blueprintId: run.blueprintId,
            blueprintVersionId: run.blueprintVersionId,
            targetQuestionSetId: run.targetQuestionSetId,
            requestedCount: run.requestedCount,
            source: run.source,
          },
          at,
        );
        return {
          questionGenerationRun: await this.createQueuedRun(
            retry,
            at,
            command.lineage,
          ),
        };
      },
    );
  }

  private async createQueuedRun(
    run: QuestionGenerationRun,
    at: Date,
    lineage: CreateQuestionGenerationRunCommand["lineage"],
  ): Promise<QuestionGenerationRun> {
    return this.deps.questionGenerationTransaction.transaction(
      async ({ questionsRepository, outboxRepository }) => {
        const created =
          await questionsRepository.createQuestionGenerationRun(run);
        await outboxRepository.appendEvents([
          questionGenerationRunRequestedEvent({
            id: this.deps.idGenerator.eventId(),
            run: created,
            lineage,
            occurredAt: at,
          }),
        ]);
        return created;
      },
    );
  }

  private async loadGenerationBlueprintAndVersion(
    command: CreateQuestionGenerationRunCommand,
  ): Promise<{
    blueprint: QuestionBlueprint;
    version: QuestionBlueprintVersion;
  }> {
    const blueprint = await this.findQuestionBlueprintByIdOrThrow(
      command.blueprintId,
    );
    this.assertAuthorized(
      canViewQuestionBlueprint(command.currentUser, blueprint),
      "You cannot use this question blueprint.",
    );

    const version = command.blueprintVersionId
      ? await this.deps.questionsRepository.findQuestionBlueprintVersionById(
          toQuestionBlueprintVersionId(command.blueprintVersionId),
        )
      : await this.deps.questionsRepository.findCurrentQuestionBlueprintVersion(
          blueprint.id,
        );
    if (!version || version.questionBlueprintId !== blueprint.id) {
      throw new QuestionBlueprintNotFoundError();
    }

    return { blueprint, version };
  }

  private resolveGenerationSource(input: {
    version: QuestionBlueprintVersion;
    explicitSource: ReturnType<typeof workbookQuestionSource> | null;
  }) {
    return input.explicitSource !== null
      ? input.explicitSource
      : input.version.workbookId
        ? workbookQuestionSource({
            type: "workbook_snapshot",
            workbookId: input.version.workbookId,
          })
        : null;
  }

  private assertWorkbookSourceIsAllowed(input: {
    version: QuestionBlueprintVersion;
    explicitSource: ReturnType<typeof workbookQuestionSource> | null;
  }): void {
    if (input.explicitSource === null || input.version.workbookId === null) {
      return;
    }
    if (input.explicitSource.workbookId !== input.version.workbookId) {
      throw new InvalidQuestionBlueprintError(
        "explicit workbook source must match blueprint workbook",
      );
    }
  }

  private async assertWorkbookSourceAccess(
    currentUser: CurrentUser,
    source: ReturnType<typeof workbookQuestionSource> | null,
  ): Promise<void> {
    if (
      source &&
      !(await this.deps.workbookAccessPort.canUserAccessWorkbook({
        currentUser,
        workbookId: toWorkbookId(source.workbookId),
      }))
    ) {
      throw new ForbiddenQuestionActionError(
        "You cannot access this workbook.",
      );
    }
  }

  private async findRunByIdOrThrow(id: string) {
    const run =
      await this.deps.questionsRepository.findQuestionGenerationRunById(
        toQuestionGenerationRunId(id),
      );
    if (!run) {
      throw new QuestionGenerationRunNotFoundError();
    }
    return run;
  }

  private async findQuestionBlueprintByIdOrThrow(id: string) {
    const blueprint =
      await this.deps.questionsRepository.findQuestionBlueprintById(
        toQuestionBlueprintId(id),
      );

    if (!blueprint) {
      throw new QuestionBlueprintNotFoundError();
    }

    return blueprint;
  }

  private assertAuthorized(allowed: boolean, message: string): void {
    if (!allowed) {
      throw new ForbiddenQuestionActionError(message);
    }
  }

  private async persistRunWithEvents(
    run: QuestionGenerationRun,
    createEvents: (
      run: QuestionGenerationRun,
    ) => readonly DomainEventEnvelope[],
  ) {
    return this.deps.questionGenerationTransaction.transaction(
      async ({ questionsRepository, outboxRepository }) => {
        const updated = await questionsRepository.updateQuestionGenerationRun(
          run,
        );
        if (!updated) {
          throw new QuestionGenerationRunNotFoundError();
        }
        await outboxRepository.appendEvents(createEvents(updated));
        return updated;
      },
    );
  }

  private async operation<T>(
    operation: string,
    lineage: CreateQuestionGenerationRunCommand["lineage"] | null,
    fn: () => Promise<T>,
  ): Promise<T> {
    return instrumentation.run(operation, { lineage }, fn);
  }
}
