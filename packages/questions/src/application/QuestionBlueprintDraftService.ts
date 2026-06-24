import {
  attachDraftSourceFile,
  createQuestionBlueprint,
  createQuestionBlueprintDraft,
  discardQuestionBlueprintDraft,
  markQuestionBlueprintDraftPublished,
  type QuestionBlueprint,
  questionBlueprintDescription,
  questionBlueprintDocument,
  questionBlueprintDraftId,
  questionBlueprintDraftSources,
  questionBlueprintId,
  questionBlueprintName,
  questionBlueprintSourceIdsUsedByDocument,
  questionBlueprintVisibility,
  updateQuestionBlueprintDefinition,
  updateQuestionBlueprintDraft,
  updateQuestionBlueprintMetadata,
  userId,
  workbookId,
} from "../domain/index.js";
import type {
  AttachQuestionBlueprintDraftSourceFileCommand,
  CreateQuestionBlueprintDraftCommand,
  ListCommand,
  PublishQuestionBlueprintDraftCommand,
  QuestionBlueprintDraftByIdCommand,
  UpdateQuestionBlueprintDraftCommand,
} from "./commands.js";
import type {
  PublishedQuestionBlueprintDraftResult,
  QuestionBlueprintDraftResult,
  QuestionBlueprintDraftsResult,
} from "./dto.js";
import {
  ForbiddenQuestionActionError,
  InvalidQuestionBlueprintError,
  QuestionBlueprintDraftNotFoundError,
  QuestionBlueprintNotFoundError,
} from "./errors.js";
import {
  decodeListCursor,
  encodeListCursor,
  normalizeListLimit,
} from "./mappers.js";
import { canManageQuestionBlueprint } from "./policies.js";
import type {
  Clock,
  DraftSourceFilePort,
  IdGenerator,
  QuestionsRepository,
  WorkbookRegistrationPort,
} from "./ports.js";

export class QuestionBlueprintDraftService {
  constructor(
    private readonly deps: {
      questionsRepository: QuestionsRepository;
      draftSourceFilePort: DraftSourceFilePort;
      workbookRegistrationPort: WorkbookRegistrationPort;
      idGenerator: IdGenerator;
      clock: Clock;
    },
  ) {}

  async createQuestionBlueprintDraft(
    command: CreateQuestionBlueprintDraftCommand,
  ): Promise<QuestionBlueprintDraftResult> {
    let targetBlueprint: QuestionBlueprint | null = null;
    if (command.blueprintId) {
      targetBlueprint = await this.assertCanManageBlueprint(
        command.currentUser,
        command.blueprintId,
      );
    }
    const at = this.deps.clock.now();
    const draft = createQuestionBlueprintDraft(
      {
        baseVersionId: targetBlueprint?.currentVersionId ?? null,
        blueprintId: command.blueprintId
          ? questionBlueprintId(command.blueprintId)
          : null,
        createdByUserId: userId(command.currentUser.user.id),
        description: questionBlueprintDescription(command.description ?? null),
        document: questionBlueprintDocument(command.document),
        id: this.deps.idGenerator.questionBlueprintDraftId(),
        name: questionBlueprintName(command.name),
        ownerUserId: userId(command.currentUser.user.id),
        sources: questionBlueprintDraftSources(command.sources),
      },
      at,
    );
    return {
      draft:
        await this.deps.questionsRepository.createQuestionBlueprintDraft(draft),
    };
  }

  async getQuestionBlueprintDraft(
    command: QuestionBlueprintDraftByIdCommand,
  ): Promise<QuestionBlueprintDraftResult> {
    return { draft: await this.findOwned(command) };
  }

  async listQuestionBlueprintDrafts(
    command: ListCommand,
  ): Promise<QuestionBlueprintDraftsResult> {
    const limit = normalizeListLimit(command.limit);
    const drafts =
      await this.deps.questionsRepository.listQuestionBlueprintDraftsByOwnerUserId(
        {
          cursor: decodeListCursor(command.cursor),
          limit: limit + 1,
          ownerUserId: userId(command.currentUser.user.id),
          statuses: ["draft"],
        },
      );
    return {
      drafts: drafts.slice(0, limit),
      nextCursor:
        drafts.length > limit
          ? encodeListCursor(drafts[limit - 1]?.updatedAt)
          : null,
    };
  }

  async updateQuestionBlueprintDraft(
    command: UpdateQuestionBlueprintDraftCommand,
  ): Promise<QuestionBlueprintDraftResult> {
    const draft = await this.findOwned(command);
    const sources = mergeAttachedFileMetadata(
      questionBlueprintDraftSources(command.patch.sources),
      draft.sources,
    );
    const updated = updateQuestionBlueprintDraft(
      draft,
      {
        description: questionBlueprintDescription(command.patch.description),
        document: questionBlueprintDocument(command.patch.document),
        name: questionBlueprintName(command.patch.name),
        sources,
      },
      this.deps.clock.now(),
    );
    return { draft: await this.persist(updated) };
  }

  async attachQuestionBlueprintDraftSourceFile(
    command: AttachQuestionBlueprintDraftSourceFileCommand,
  ): Promise<QuestionBlueprintDraftResult> {
    const draft = await this.findOwned(command);
    let file: Awaited<ReturnType<DraftSourceFilePort["getFileMetadata"]>>;
    try {
      file = await this.deps.draftSourceFilePort.getFileMetadata({
        currentUser: command.currentUser,
        fileId: command.fileId,
      });
    } catch {
      throw new InvalidQuestionBlueprintError(
        "Draft source file is unavailable.",
      );
    }
    if (file.ownerUserId !== draft.ownerUserId) {
      throw new ForbiddenQuestionActionError(
        "Draft file must belong to draft owner.",
      );
    }
    if (
      file.purpose !== "workbook" ||
      file.contentType !==
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ) {
      throw new InvalidQuestionBlueprintError(
        "Draft source file must be an xlsx workbook.",
      );
    }
    const updated = attachDraftSourceFile(
      draft,
      { sourceId: command.sourceId, ...file },
      this.deps.clock.now(),
    );
    const persisted =
      await this.deps.questionsRepository.attachQuestionBlueprintDraftSourceFile(
        {
          draft: updated,
          file,
          sourceId: command.sourceId,
        },
      );
    if (!persisted) throw new QuestionBlueprintDraftNotFoundError();
    return { draft: persisted };
  }

  async discardQuestionBlueprintDraft(
    command: QuestionBlueprintDraftByIdCommand,
  ): Promise<void> {
    await this.persist(
      discardQuestionBlueprintDraft(
        await this.findOwned(command),
        this.deps.clock.now(),
      ),
    );
  }

  async publishQuestionBlueprintDraft(
    command: PublishQuestionBlueprintDraftCommand,
  ): Promise<PublishedQuestionBlueprintDraftResult> {
    const draft = await this.findOwned(command);
    const usedIds = questionBlueprintSourceIdsUsedByDocument(draft.document);
    const sourcesById = new Map(
      draft.sources.map((source) => [source.sourceId, source]),
    );
    const publishedSources = [];
    const updatedDraftSources = [...draft.sources];

    for (const sourceId of usedIds) {
      const source = sourcesById.get(sourceId);
      if (!source) {
        throw new InvalidQuestionBlueprintError(
          `Source ${sourceId} is not attached.`,
        );
      }
      let registeredWorkbookId = source.workbookId;
      if (!registeredWorkbookId) {
        if (!source.fileId) {
          throw new InvalidQuestionBlueprintError(
            "Attach workbook file before publishing.",
          );
        }
        const registered =
          await this.deps.workbookRegistrationPort.registerWorkbookFromFile({
            currentUser: command.currentUser,
            fileId: source.fileId,
            lineage: command.lineage,
            name: source.name,
          });
        registeredWorkbookId = workbookId(registered.workbookId);
        const index = updatedDraftSources.findIndex(
          (candidate) => candidate.sourceId === sourceId,
        );
        updatedDraftSources[index] = {
          ...source,
          status: "validated",
          workbookId: registeredWorkbookId,
        };
      }
      publishedSources.push({
        name: source.name,
        sourceId,
        type: "workbook" as const,
        workbookId: registeredWorkbookId,
      });
    }

    const at = this.deps.clock.now();
    let blueprint: QuestionBlueprint;
    if (draft.blueprintId) {
      const existing = await this.assertCanManageBlueprint(
        command.currentUser,
        draft.blueprintId,
      );
      blueprint = updateQuestionBlueprintDefinition(
        updateQuestionBlueprintMetadata(
          existing,
          { description: draft.description, name: draft.name },
          at,
        ),
        { document: draft.document, sources: publishedSources },
        at,
      );
      const persistedBlueprint =
        await this.deps.questionsRepository.updateQuestionBlueprintDefinition({
          blueprint,
          versionId: this.deps.idGenerator.questionBlueprintVersionId(),
        });
      if (!persistedBlueprint) throw new QuestionBlueprintNotFoundError();
      blueprint = persistedBlueprint;
    } else {
      blueprint = await this.deps.questionsRepository.createQuestionBlueprint(
        createQuestionBlueprint(
          {
            createdByUserId: draft.createdByUserId,
            description: draft.description,
            document: draft.document,
            currentVersionId:
              this.deps.idGenerator.questionBlueprintVersionId(),
            id: this.deps.idGenerator.questionBlueprintId(),
            name: draft.name,
            ownerUserId: draft.ownerUserId,
            sources: publishedSources,
            visibility: questionBlueprintVisibility("private"),
          },
          at,
        ),
      );
    }
    // Keep unused draft sources and attachments as authoring history; retention cleanup is separate.
    const publishedDraft = markQuestionBlueprintDraftPublished(
      draft,
      blueprint.id,
      updatedDraftSources,
      at,
    );
    return {
      draft: await this.persist(publishedDraft),
      questionBlueprint: blueprint,
    };
  }

  private async findOwned(command: QuestionBlueprintDraftByIdCommand) {
    const draft =
      await this.deps.questionsRepository.findQuestionBlueprintDraftById(
        questionBlueprintDraftId(command.draftId),
      );
    if (!draft || draft.ownerUserId !== command.currentUser.user.id) {
      throw new QuestionBlueprintDraftNotFoundError();
    }
    if (draft.blueprintId) {
      await this.assertCanManageBlueprint(
        command.currentUser,
        draft.blueprintId,
      );
    }
    return draft;
  }

  private async persist(
    draft: Parameters<QuestionsRepository["updateQuestionBlueprintDraft"]>[0],
  ) {
    const persisted =
      await this.deps.questionsRepository.updateQuestionBlueprintDraft(draft);
    if (!persisted) throw new QuestionBlueprintDraftNotFoundError();
    return persisted;
  }

  private async assertCanManageBlueprint(
    currentUser: ListCommand["currentUser"],
    id: string,
  ) {
    const blueprint =
      await this.deps.questionsRepository.findQuestionBlueprintById(
        questionBlueprintId(id),
      );
    if (!blueprint) throw new QuestionBlueprintNotFoundError();
    if (!canManageQuestionBlueprint(currentUser, blueprint)) {
      throw new ForbiddenQuestionActionError(
        "You cannot manage this question blueprint.",
      );
    }
    return blueprint;
  }
}

function mergeAttachedFileMetadata(
  next: ReturnType<typeof questionBlueprintDraftSources>,
  previous: readonly ReturnType<typeof questionBlueprintDraftSources>[number][],
) {
  const previousById = new Map(
    previous.map((source) => [source.sourceId, source]),
  );
  return next.map((source) => {
    const saved = previousById.get(source.sourceId);
    if (!saved?.fileId || source.fileId) return source;
    return {
      ...source,
      byteSize: saved.byteSize,
      checksumSha256: saved.checksumSha256,
      fileId: saved.fileId,
      originalName: saved.originalName,
      status: saved.status,
    };
  });
}
