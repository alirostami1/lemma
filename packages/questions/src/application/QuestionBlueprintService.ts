import type {
  QuestionBlueprint,
  QuestionBlueprintVersion,
  WorkbookId,
} from "../domain/index.js";
import {
  createQuestionBlueprint,
  createQuestionBlueprintVersion,
  createQuestionBlueprintVersionAssets,
  deleteQuestionBlueprint,
  questionBlueprintDescription,
  questionBlueprintName,
  questionBlueprintVisibility,
  questionBlueprintWorkbookSources,
  questionBlueprintId as toQuestionBlueprintId,
  questionBlueprintStatus as toQuestionBlueprintStatus,
  questionBlueprintVersionId as toQuestionBlueprintVersionId,
  userId as toUserId,
  workbookId as toWorkbookId,
  updateQuestionBlueprintMetadata,
} from "../domain/index.js";
import type {
  CreateQuestionBlueprintCommand,
  ListCommand,
  QuestionBlueprintByIdCommand,
  QuestionBlueprintVersionByIdCommand,
  UpdateQuestionBlueprintCommand,
} from "./commands.js";
import type {
  QuestionBlueprintAuthoringResult,
  QuestionBlueprintResult,
  QuestionBlueprintsResult,
  QuestionBlueprintVersionsResult,
} from "./dto.js";
import { QuestionBlueprintNotFoundError } from "./errors.js";
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
  hydrateQuestionBlueprintVersion,
  hydrateQuestionBlueprintVersions,
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
        ownerUserId: toUserId(command.currentUser.user.id),
        statuses: command.status
          ? [toQuestionBlueprintStatus(command.status)]
          : ["active", "archived"],
        limit: limit + 1,
        cursor: decodeListCursor(command.cursor),
        includeSystem: true,
      });
    return {
      questionBlueprints: await Promise.all(
        blueprints
          .slice(0, limit)
          .map((blueprint) =>
            hydrateQuestionBlueprint(this.deps.questionsRepository, blueprint),
          ),
      ),
      nextCursor:
        blueprints.length > limit
          ? encodeListCursor(blueprints[limit - 1]?.createdAt)
          : null,
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
    const compiled = normalizeCanonicalBlueprintInput({
      document: command.document,
      workbookId: command.workbookId ?? null,
      workbookSources: command.workbookSources,
    });
    const at = this.deps.clock.now();
    const blueprint = createQuestionBlueprint(
      {
        id: toQuestionBlueprintId(this.deps.idGenerator.questionBlueprintId()),
        ownerUserId: toUserId(command.currentUser.user.id),
        createdByUserId: toUserId(command.currentUser.user.id),
        name: questionBlueprintName(command.name),
        description: questionBlueprintDescription(command.description ?? null),
        workbookId: compiled.workbookId,
        workbookSources: compiled.workbookSources,
        visibility: questionBlueprintVisibility(
          command.visibility ?? "private",
        ),
      },
      at,
    );
    const version = createQuestionBlueprintVersion(
      {
        id: toQuestionBlueprintVersionId(
          this.deps.idGenerator.questionBlueprintVersionId(),
        ),
        questionBlueprintId: blueprint.id,
        versionNumber: 1,
        document: compiled.document,
        workbookId: compiled.workbookId,
        workbookSources: compiled.workbookSources,
        createdByUserId: blueprint.createdByUserId,
      },
      at,
    );
    const assets = createQuestionBlueprintVersionAssets(
      {
        questionBlueprintVersionId: version.id,
        workbookIds: sourceAssetWorkbookIds({
          workbookId: command.workbookId ?? null,
          workbookSources: command.workbookSources,
        }),
      },
      at,
    );
    const saved =
      await this.deps.questionsRepository.createQuestionBlueprintWithVersion({
        blueprint,
        version,
        assets,
      });
    return {
      questionBlueprint: await hydrateQuestionBlueprint(
        this.deps.questionsRepository,
        saved,
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
      questionBlueprint: await hydrateQuestionBlueprint(
        this.deps.questionsRepository,
        questionBlueprint,
      ),
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
    return {
      questionBlueprint: await this.hydrateQuestionBlueprintAuthoring(
        questionBlueprint,
        null,
      ),
    };
  }

  async getQuestionBlueprintVersionAuthoring(
    command: QuestionBlueprintVersionByIdCommand,
  ): Promise<QuestionBlueprintAuthoringResult> {
    const questionBlueprint = await this.findQuestionBlueprintById(
      command.questionBlueprintId,
    );
    assertQuestionAuthorized(
      canViewQuestionBlueprintAuthoring(command.currentUser, questionBlueprint),
      "You cannot view this question blueprint authoring data.",
    );
    const version =
      await this.deps.questionsRepository.findQuestionBlueprintVersionById(
        toQuestionBlueprintVersionId(command.questionBlueprintVersionId),
      );
    if (!version || version.questionBlueprintId !== questionBlueprint.id) {
      throw new QuestionBlueprintNotFoundError();
    }
    return {
      questionBlueprint: await this.hydrateQuestionBlueprintAuthoring(
        questionBlueprint,
        version,
      ),
    };
  }

  async listQuestionBlueprintVersions(
    command: QuestionBlueprintByIdCommand,
  ): Promise<QuestionBlueprintVersionsResult> {
    const questionBlueprint = await this.findQuestionBlueprintById(
      command.questionBlueprintId,
    );
    assertQuestionAuthorized(
      canViewQuestionBlueprintAuthoring(command.currentUser, questionBlueprint),
      "You cannot view this question blueprint authoring data.",
    );
    return {
      versions: await hydrateQuestionBlueprintVersions(
        this.deps.questionsRepository,
        await this.deps.questionsRepository.listQuestionBlueprintVersions({
          blueprintId: questionBlueprint.id,
        }),
      ),
    };
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
    const documentChanged = command.patch.document !== undefined;
    const workbookChanged = command.patch.workbookId !== undefined;
    const workbookSourcesChanged = command.patch.workbookSources !== undefined;
    const at = this.deps.clock.now();
    const updatedMetadata = updateQuestionBlueprintMetadata(
      blueprint,
      {
        name: command.patch.name,
        description: command.patch.description,
        visibility:
          command.patch.visibility === undefined
            ? undefined
            : questionBlueprintVisibility(command.patch.visibility),
        status:
          command.patch.status === undefined
            ? undefined
            : toQuestionBlueprintStatus(command.patch.status),
      },
      at,
    );
    if (!documentChanged && !workbookChanged && !workbookSourcesChanged) {
      return {
        questionBlueprint: await hydrateQuestionBlueprint(
          this.deps.questionsRepository,
          await persistQuestionBlueprint(
            this.deps.questionsRepository,
            updatedMetadata,
          ),
        ),
      };
    }
    const currentVersion =
      await this.deps.questionsRepository.findCurrentQuestionBlueprintVersion(
        blueprint.id,
      );
    if (!currentVersion) {
      throw new QuestionBlueprintNotFoundError();
    }
    const compiled = normalizeCanonicalBlueprintInput({
      document: command.patch.document ?? currentVersion.document,
      workbookId:
        command.patch.workbookId !== undefined
          ? command.patch.workbookId
          : currentVersion.workbookId,
      workbookSources:
        command.patch.workbookSources !== undefined
          ? command.patch.workbookSources
          : currentVersion.workbookSources,
    });
    const versions =
      await this.deps.questionsRepository.listQuestionBlueprintVersions({
        blueprintId: blueprint.id,
      });
    const nextVersionNumber =
      versions.reduce(
        (max, version) => Math.max(max, version.versionNumber),
        0,
      ) + 1;
    const version = createQuestionBlueprintVersion(
      {
        id: toQuestionBlueprintVersionId(
          this.deps.idGenerator.questionBlueprintVersionId(),
        ),
        questionBlueprintId: blueprint.id,
        versionNumber: nextVersionNumber,
        document: compiled.document,
        workbookId: compiled.workbookId,
        workbookSources: compiled.workbookSources,
        createdByUserId: toUserId(command.currentUser.user.id),
      },
      at,
    );
    const assets = createQuestionBlueprintVersionAssets(
      {
        questionBlueprintVersionId: version.id,
        workbookIds: sourceAssetWorkbookIds({
          workbookId:
            command.patch.workbookId !== undefined
              ? command.patch.workbookId
              : currentVersion.workbookId,
          workbookSources:
            command.patch.workbookSources !== undefined
              ? command.patch.workbookSources
              : currentVersion.workbookSources,
        }),
      },
      at,
    );
    const saved =
      await this.deps.questionsRepository.updateQuestionBlueprintWithNewVersion(
        {
          blueprint: {
            ...updatedMetadata,
            workbookId: compiled.workbookId,
            workbookSources: compiled.workbookSources,
            currentVersionId: version.id,
          },
          version,
          assets,
        },
      );
    if (!saved) {
      throw new QuestionBlueprintNotFoundError();
    }
    return {
      questionBlueprint: await hydrateQuestionBlueprint(
        this.deps.questionsRepository,
        saved,
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

  private async hydrateQuestionBlueprintAuthoring(
    questionBlueprint: QuestionBlueprint,
    selectedVersion: QuestionBlueprintVersion | null,
  ): Promise<QuestionBlueprintAuthoringResult["questionBlueprint"]> {
    const currentBlueprint = await hydrateQuestionBlueprint(
      this.deps.questionsRepository,
      questionBlueprint,
    );
    const selected =
      selectedVersion === null
        ? currentBlueprint.currentVersion
        : await hydrateQuestionBlueprintVersion(
            this.deps.questionsRepository,
            selectedVersion,
          );
    const versions = await hydrateQuestionBlueprintVersions(
      this.deps.questionsRepository,
      await this.deps.questionsRepository.listQuestionBlueprintVersions({
        blueprintId: questionBlueprint.id,
      }),
    );
    return {
      ...currentBlueprint,
      selectedVersion: selected,
      versions,
    };
  }
}

function sourceAssetWorkbookIds(input: {
  workbookId: string | null;
  workbookSources?: unknown;
}): WorkbookId[] {
  if (input.workbookSources !== undefined) {
    return questionBlueprintWorkbookSources(input.workbookSources).map(
      (source) => source.workbookId,
    );
  }
  return input.workbookId === null ? [] : [toWorkbookId(input.workbookId)];
}
