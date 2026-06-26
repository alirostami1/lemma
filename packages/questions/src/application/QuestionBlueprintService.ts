import {
  deleteQuestionBlueprint,
  questionBlueprintStatus as toQuestionBlueprintStatus,
  userId as toUserId,
} from "../domain/index.js";
import type { ListCommand, QuestionBlueprintByIdCommand } from "./commands.js";
import type {
  QuestionBlueprintAuthoringResult,
  QuestionBlueprintResult,
  QuestionBlueprintsResult,
} from "./dto.js";
import {
  decodeListCursor,
  encodeListCursor,
  normalizeListLimit,
} from "./mappers.js";
import {
  canManageQuestionBlueprint,
  canViewQuestionBlueprint,
  canViewQuestionBlueprintAuthoring,
} from "./policies.js";
import type { Clock, QuestionsRepository } from "./ports.js";
import {
  assertQuestionAuthorized,
  findQuestionBlueprintByIdOrThrow,
  hydrateQuestionBlueprint,
  persistQuestionBlueprint,
} from "./question-application-helpers.js";

export class QuestionBlueprintService {
  constructor(
    private readonly deps: {
      questionsRepository: QuestionsRepository;
      clock: Clock;
    },
  ) {}

  async listQuestionBlueprints(
    command: ListCommand & { status?: string },
  ): Promise<QuestionBlueprintsResult> {
    const limit = normalizeListLimit(command.limit);
    const blueprints =
      await this.deps.questionsRepository.listQuestionBlueprintsByOwnerUserId({
        cursor: decodeListCursor(command.cursor),
        includeSystem: true,
        limit: limit + 1,
        ownerUserId: toUserId(command.currentUser.user.id),
        statuses: command.status
          ? [toQuestionBlueprintStatus(command.status)]
          : ["active", "archived"],
      });

    return {
      nextCursor:
        blueprints.length > limit
          ? encodeListCursor(blueprints[limit - 1]?.createdAt)
          : null,
      questionBlueprints: await Promise.all(
        blueprints
          .slice(0, limit)
          .map((blueprint) => hydrateQuestionBlueprint(blueprint)),
      ),
    };
  }

  async getQuestionBlueprint(
    command: QuestionBlueprintByIdCommand,
  ): Promise<QuestionBlueprintResult> {
    const questionBlueprint = await this.findQuestionBlueprintById(
      command.questionBlueprintId,
    );
    assertQuestionAuthorized(
      canViewQuestionBlueprint(command.currentUser, questionBlueprint),
      "You cannot view this question blueprint.",
    );
    return {
      questionBlueprint: await hydrateQuestionBlueprint(questionBlueprint),
    };
  }

  async getQuestionBlueprintAuthoring(
    command: QuestionBlueprintByIdCommand,
  ): Promise<QuestionBlueprintAuthoringResult> {
    const questionBlueprint = await this.findQuestionBlueprintById(
      command.questionBlueprintId,
    );
    assertQuestionAuthorized(
      canViewQuestionBlueprintAuthoring(command.currentUser, questionBlueprint),
      "You cannot view this question blueprint authoring data.",
    );
    return { questionBlueprint };
  }

  async deleteQuestionBlueprint(
    command: QuestionBlueprintByIdCommand,
  ): Promise<void> {
    const blueprint = await this.findQuestionBlueprintById(
      command.questionBlueprintId,
    );
    assertQuestionAuthorized(
      canManageQuestionBlueprint(command.currentUser, blueprint),
      "You cannot delete this question blueprint.",
    );
    await persistQuestionBlueprint(
      this.deps.questionsRepository,
      deleteQuestionBlueprint(blueprint, this.deps.clock.now()),
    );
  }

  private findQuestionBlueprintById(id: string) {
    return findQuestionBlueprintByIdOrThrow(this.deps.questionsRepository, id);
  }
}
