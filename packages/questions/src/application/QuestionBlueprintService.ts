import {
  createQuestionBlueprint,
  deleteQuestionBlueprint,
  InvalidQuestionFieldError,
  questionBlueprintDescription,
  questionBlueprintName,
  questionBlueprintVisibility,
  questionBlueprintId as toQuestionBlueprintId,
  questionBlueprintStatus as toQuestionBlueprintStatus,
  userId as toUserId,
  updateQuestionBlueprintDefinition,
  updateQuestionBlueprintMetadata,
} from "../domain/index.js";
import type {
  CreateQuestionBlueprintCommand,
  ListCommand,
  QuestionBlueprintByIdCommand,
  UpdateQuestionBlueprintCommand,
} from "./commands.js";
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
  canCreateQuestionBlueprint,
  canManageQuestionBlueprint,
  canViewQuestionBlueprint,
  canViewQuestionBlueprintAuthoring,
} from "./policies.js";
import type { Clock, IdGenerator, QuestionsRepository } from "./ports.js";
import {
  assertQuestionAuthorized,
  findQuestionBlueprintByIdOrThrow,
  hydrateQuestionBlueprint,
  normalizeCanonicalBlueprintInput,
  persistQuestionBlueprint,
} from "./question-application-helpers.js";

export class QuestionBlueprintService {
  constructor(
    private readonly deps: {
      questionsRepository: QuestionsRepository;
      idGenerator: IdGenerator;
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

  async createQuestionBlueprint(
    command: CreateQuestionBlueprintCommand,
  ): Promise<QuestionBlueprintResult> {
    assertQuestionAuthorized(
      canCreateQuestionBlueprint(
        command.currentUser,
        command.visibility ?? "private",
      ),
      "You cannot create this question blueprint.",
    );
    if (command.sources === undefined) {
      throw new InvalidQuestionFieldError(
        "sources must be provided when creating question blueprint",
      );
    }

    const compiled = normalizeCanonicalBlueprintInput({
      document: command.document,
      sources: command.sources,
    });
    const at = this.deps.clock.now();
    const blueprint = createQuestionBlueprint(
      {
        createdByUserId: toUserId(command.currentUser.user.id),
        description: questionBlueprintDescription(command.description ?? null),
        document: compiled.document,
        id: toQuestionBlueprintId(this.deps.idGenerator.questionBlueprintId()),
        name: questionBlueprintName(command.name),
        ownerUserId: toUserId(command.currentUser.user.id),
        sources: compiled.sources,
        visibility: questionBlueprintVisibility(
          command.visibility ?? "private",
        ),
      },
      at,
    );

    return {
      questionBlueprint: await hydrateQuestionBlueprint(
        await this.deps.questionsRepository.createQuestionBlueprint(blueprint),
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

  async updateQuestionBlueprint(
    command: UpdateQuestionBlueprintCommand,
  ): Promise<QuestionBlueprintResult> {
    const blueprint = await this.findQuestionBlueprintById(
      command.questionBlueprintId,
    );
    assertQuestionAuthorized(
      canManageQuestionBlueprint(command.currentUser, blueprint),
      "You cannot update this question blueprint.",
    );

    const at = this.deps.clock.now();
    const updatedMetadata = updateQuestionBlueprintMetadata(
      blueprint,
      {
        description: command.patch.description,
        name: command.patch.name,
        status:
          command.patch.status === undefined
            ? undefined
            : toQuestionBlueprintStatus(command.patch.status),
        visibility:
          command.patch.visibility === undefined
            ? undefined
            : questionBlueprintVisibility(command.patch.visibility),
      },
      at,
    );

    const documentChanged = command.patch.document !== undefined;
    const sourcesChanged = command.patch.sources !== undefined;
    if (!documentChanged && !sourcesChanged) {
      return {
        questionBlueprint: await hydrateQuestionBlueprint(
          await persistQuestionBlueprint(
            this.deps.questionsRepository,
            updatedMetadata,
          ),
        ),
      };
    }

    const compiled = normalizeCanonicalBlueprintInput({
      document: command.patch.document ?? blueprint.document,
      sources: command.patch.sources ?? blueprint.sources,
    });

    return {
      questionBlueprint: await hydrateQuestionBlueprint(
        await persistQuestionBlueprint(
          this.deps.questionsRepository,
          updateQuestionBlueprintDefinition(
            updatedMetadata,
            {
              document: compiled.document,
              sources: compiled.sources,
            },
            at,
          ),
        ),
      ),
    };
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
