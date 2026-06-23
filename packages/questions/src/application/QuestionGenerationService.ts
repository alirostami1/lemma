import type { DomainEventEnvelope } from "@lemma/events/domain";
import { instrumentService } from "@lemma/observability";
import {
  cancelQuestionGenerationRun,
  createInitialQuestionGenerationRun,
  createQuestionBlueprintSnapshot,
  createRetryQuestionGenerationRun,
  type QuestionBlueprint,
  type QuestionGenerationRun,
  questionBlueprintId as toQuestionBlueprintId,
  questionGenerationRunId as toQuestionGenerationRunId,
  questionGenerationRunStatus as toQuestionGenerationRunStatus,
  questionSetId as toQuestionSetId,
  userId as toUserId,
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
import { QuestionGenerationSourceResolver } from "./QuestionGenerationSourceResolver.js";
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
          cursor: decodeListCursor(command.cursor),
          limit: limit + 1,
          ownerUserId: toUserId(command.currentUser.user.id),
          statuses: command.status
            ? [toQuestionGenerationRunStatus(command.status)]
            : undefined,
        },
      );
    return {
      nextCursor:
        runs.length > limit
          ? encodeListCursor(runs[limit - 1]?.createdAt)
          : null,
      questionGenerationRuns: runs.slice(0, limit),
    };
  }

  async createQuestionGenerationRun(
    command: CreateQuestionGenerationRunCommand,
  ): Promise<QuestionGenerationRunResultDto> {
    return this.operation(
      "create_question_generation_run",
      command.lineage,
      async () => {
        const blueprint = await this.loadGenerationBlueprint(command);
        const targetQuestionSetId = toQuestionSetId(
          command.targetQuestionSetId,
        );
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

        const at = this.deps.clock.now();
        const run = createInitialQuestionGenerationRun(
          {
            blueprintId: blueprint.id,
            blueprintSnapshot: createQuestionBlueprintSnapshot({
              blueprintId: blueprint.id,
              capturedAt: at,
              description: blueprint.description,
              document: blueprint.document,
              name: blueprint.name,
              sources: blueprint.sources,
            }),
            createdByUserId: toUserId(command.currentUser.user.id),
            id: toQuestionGenerationRunId(
              this.deps.idGenerator.questionGenerationRunId(),
            ),
            ownerUserId: toUserId(command.currentUser.user.id),
            requestedCount: command.count,
            targetQuestionSetId,
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
              lineage: command.lineage,
              occurredAt: at,
              run: persisted,
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
        const at = this.deps.clock.now();
        const retry = createRetryQuestionGenerationRun(
          {
            createdByUserId: toUserId(command.currentUser.user.id),
            id: this.deps.idGenerator.questionGenerationRunId(),
            original: run,
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
            lineage,
            occurredAt: at,
            run: created,
          }),
        ]);
        return created;
      },
    );
  }

  private async loadGenerationBlueprint(
    command: CreateQuestionGenerationRunCommand,
  ): Promise<QuestionBlueprint> {
    const blueprint = await this.findQuestionBlueprintByIdOrThrow(
      command.blueprintId,
    );
    this.assertAuthorized(
      canViewQuestionBlueprint(command.currentUser, blueprint),
      "You cannot use this question blueprint.",
    );
    await new QuestionGenerationSourceResolver({
      workbookAccessPort: this.deps.workbookAccessPort,
    }).assertAccess({
      blueprint,
      currentUser: command.currentUser,
    });
    return blueprint;
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
        const updated =
          await questionsRepository.updateQuestionGenerationRun(run);
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
