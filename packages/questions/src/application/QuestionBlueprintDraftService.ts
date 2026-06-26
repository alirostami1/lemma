import {
  createQuestionBlueprintDraft,
  discardQuestionBlueprintDraft,
  InvalidQuestionStateTransitionError,
  type QuestionBlueprint,
  type QuestionBlueprintDraft,
  type QuestionBlueprintDraftSource,
  type QuestionBlueprintDraftSourceIntent,
  type QuestionBlueprintSource,
  questionBlueprintDescription,
  questionBlueprintDocument,
  questionBlueprintDraftId,
  questionBlueprintDraftPublishIdempotencyKey,
  questionBlueprintDraftRevision,
  questionBlueprintDraftSourceIntents,
  questionBlueprintId,
  questionBlueprintName,
  questionBlueprintSourceIdsUsedByDocument,
  updateQuestionBlueprintDraft,
  userId,
} from "../domain/index.js";
import type {
  AttachQuestionBlueprintDraftSourceFileCommand,
  CreateQuestionBlueprintDraftCommand,
  CreateQuestionBlueprintEditDraftCommand,
  DiscardQuestionBlueprintDraftCommand,
  ListCommand,
  PublishQuestionBlueprintDraftCommand,
  QuestionBlueprintDraftByIdCommand,
  UpdateQuestionBlueprintDraftCommand,
} from "./commands.js";
import type {
  PublishedQuestionBlueprintDraftResult,
  QuestionBlueprintDraftResult,
  QuestionBlueprintDraftsResult,
  QuestionBlueprintEditDraftResult,
} from "./dto.js";
import {
  DraftSourceFileForbiddenError,
  DraftSourceFileInvalidError,
  DraftSourceKindUnsupportedError,
  DraftSourceNotFoundError,
  DraftSourceNotReadyError,
  ForbiddenQuestionActionError,
  InvalidDraftSourceReferenceError,
  QuestionBlueprintDraftNotFoundError,
  QuestionBlueprintDraftRevisionConflictError,
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
  DraftSourceFileMetadata,
  DraftSourceFilePort,
  IdGenerator,
  PublishSourceMaterialization,
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
        sources: normalizeDraftSourceIntentMaterialization(
          questionBlueprintDraftSourceIntents(command.sources),
          [],
        ),
      },
      at,
    );
    return {
      draft:
        await this.deps.questionsRepository.createQuestionBlueprintDraft(draft),
    };
  }

  async createQuestionBlueprintEditDraft(
    command: CreateQuestionBlueprintEditDraftCommand,
  ): Promise<QuestionBlueprintEditDraftResult> {
    const blueprint = await this.assertCanManageBlueprint(
      command.currentUser,
      command.blueprintId,
    );
    const at = this.deps.clock.now();
    const ownerUserId = userId(command.currentUser.user.id);
    const draft = createQuestionBlueprintDraft(
      {
        baseVersionId: blueprint.currentVersionId,
        blueprintId: blueprint.id,
        createdByUserId: ownerUserId,
        description: blueprint.description,
        document: blueprint.document,
        id: this.deps.idGenerator.questionBlueprintDraftId(),
        name: blueprint.name,
        ownerUserId,
        sources: blueprint.sources.map(toEditDraftSource),
      },
      at,
    );
    return this.deps.questionsRepository.createOrResumeQuestionBlueprintEditDraft(
      {
        blueprintId: blueprint.id,
        draft,
        ownerUserId,
      },
    );
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
    // Fast pre-check gives stale callers a deterministic conflict before patch validation;
    // repository optimistic lock remains authoritative.
    assertExpectedDraftRevision(draft, command.patch.expectedRevision);
    const sources = normalizeDraftSourceIntentMaterialization(
      questionBlueprintDraftSourceIntents(command.patch.sources),
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
    return {
      draft: await this.persistWithExpectedRevision({
        draft: updated,
        expectedRevision: command.patch.expectedRevision,
      }),
    };
  }

  async attachQuestionBlueprintDraftSourceFile(
    command: AttachQuestionBlueprintDraftSourceFileCommand,
  ): Promise<QuestionBlueprintDraftResult> {
    const draft = await this.findOwned(command);
    // Fast pre-checks give callers deterministic errors before file/workbook work;
    // repository checks after locking remain authoritative.
    assertExpectedDraftRevision(draft, command.expectedRevision);
    const source = draft.sources.find(
      (candidate) => candidate.sourceId === command.sourceId,
    );
    if (!source) throw new DraftSourceNotFoundError();
    if (source.type !== "workbook") {
      throw new DraftSourceKindUnsupportedError();
    }
    let file: DraftSourceFileMetadata;
    try {
      file = await this.deps.draftSourceFilePort.getFileMetadata({
        currentUser: command.currentUser,
        fileId: command.fileId,
      });
    } catch {
      throw new DraftSourceFileInvalidError(
        "Draft source file is unavailable.",
      );
    }
    if (file.ownerUserId !== draft.ownerUserId) {
      throw new DraftSourceFileForbiddenError(
        "Draft source file must belong to draft owner.",
      );
    }
    if (
      file.purpose !== "workbook" ||
      file.contentType !==
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ) {
      throw new DraftSourceFileInvalidError(
        "Draft source file must be an xlsx workbook.",
      );
    }
    const persisted =
      await this.deps.questionsRepository.attachQuestionBlueprintDraftSourceFileWithExpectedRevision(
        {
          currentUser: command.currentUser,
          draftId: draft.id,
          expectedRevision: command.expectedRevision,
          file,
          lineage: command.lineage,
          registeredAt: this.deps.clock.now(),
          registerWorkbookFromFile: (input) =>
            this.deps.workbookRegistrationPort.registerWorkbookFromFile(input),
          sourceId: command.sourceId,
        },
      );
    if (!persisted) throw new QuestionBlueprintDraftNotFoundError();
    return {
      draft: persisted,
    };
  }

  async discardQuestionBlueprintDraft(
    command: DiscardQuestionBlueprintDraftCommand,
  ): Promise<void> {
    const draft = await this.findOwned(command);
    await this.persistWithExpectedRevision({
      draft: discardQuestionBlueprintDraft(draft, this.deps.clock.now()),
      expectedRevision: command.expectedRevision,
    });
  }

  async publishQuestionBlueprintDraft(
    command: PublishQuestionBlueprintDraftCommand,
  ): Promise<PublishedQuestionBlueprintDraftResult> {
    const idempotencyKey = questionBlueprintDraftPublishIdempotencyKey(
      command.idempotencyKey,
    );
    const draft = await this.findOwned(command);
    if (draft.status === "published") {
      if (draft.publishIdempotencyKey === idempotencyKey) {
        return this.findPublishedDraftResult(command, draft);
      }
      throw new InvalidQuestionStateTransitionError(
        "question blueprint draft cannot be published from current state",
      );
    }
    // Pre-check avoids workbook registration side effects when caller is already stale;
    // repository optimistic lock remains authoritative.
    assertExpectedDraftRevision(draft, command.expectedRevision);
    if (draft.status !== "draft") {
      throw new InvalidQuestionStateTransitionError(
        "question blueprint draft cannot be published from current state",
      );
    }

    const usedIds = questionBlueprintSourceIdsUsedByDocument(draft.document);
    const sourcesById = new Map(
      draft.sources.map((source) => [source.sourceId, source]),
    );
    const sourceMaterialization: PublishSourceMaterialization[] = [];

    for (const sourceId of usedIds) {
      const source = sourcesById.get(sourceId);
      if (!source) {
        throw new InvalidDraftSourceReferenceError(
          `Source ${sourceId} is not attached.`,
        );
      }
      if (source.status !== "validated" || !source.workbookId) {
        throw new DraftSourceNotReadyError("Workbook source is not validated.");
      }
      sourceMaterialization.push({
        sourceId,
        workbookId: source.workbookId,
      });
    }

    const at = this.deps.clock.now();
    const versionId = this.deps.idGenerator.questionBlueprintVersionId();
    const result =
      await this.deps.questionsRepository.publishQuestionBlueprintDraft({
        blueprintId:
          draft.blueprintId ?? this.deps.idGenerator.questionBlueprintId(),
        draftId: draft.id,
        expectedRevision: command.expectedRevision,
        idempotencyKey: command.idempotencyKey,
        ownerUserId: userId(command.currentUser.user.id),
        sourceMaterialization,
        publishedAt: at,
        versionId,
      });
    if (!result) throw new QuestionBlueprintDraftNotFoundError();
    return result;
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

  private async findPublishedDraftResult(
    command: QuestionBlueprintDraftByIdCommand,
    draft: QuestionBlueprintDraft,
  ): Promise<PublishedQuestionBlueprintDraftResult> {
    if (!draft.blueprintId || !draft.publishedVersionId) {
      throw new QuestionBlueprintDraftNotFoundError();
    }
    const questionBlueprint = await this.assertCanManageBlueprint(
      command.currentUser,
      draft.blueprintId,
    );
    const questionBlueprintVersion =
      await this.deps.questionsRepository.findQuestionBlueprintVersionById(
        draft.publishedVersionId,
      );
    if (!questionBlueprintVersion) {
      throw new QuestionBlueprintNotFoundError();
    }
    return { draft, questionBlueprint, questionBlueprintVersion };
  }

  private async persistWithExpectedRevision(input: {
    draft: QuestionBlueprintDraft;
    expectedRevision: number;
  }) {
    const persisted =
      await this.deps.questionsRepository.updateQuestionBlueprintDraftWithExpectedRevision(
        input,
      );
    if (!persisted) throw new QuestionBlueprintDraftRevisionConflictError();
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

function assertExpectedDraftRevision(
  draft: QuestionBlueprintDraft,
  expectedRevision: number,
): void {
  if (draft.revision !== questionBlueprintDraftRevision(expectedRevision)) {
    throw new QuestionBlueprintDraftRevisionConflictError();
  }
}

function toEditDraftSource(
  source: QuestionBlueprintSource,
): QuestionBlueprintDraftSource {
  return {
    byteSize: source.byteSize,
    checksumSha256: source.checksumSha256,
    fileId: source.fileId,
    name: source.name,
    originalName: source.originalName,
    sourceId: source.sourceId,
    status: "validated",
    type: "workbook",
    workbookId: source.workbookId,
  };
}

function normalizeDraftSourceIntentMaterialization(
  next: readonly QuestionBlueprintDraftSourceIntent[],
  previous: readonly QuestionBlueprintDraftSource[],
): QuestionBlueprintDraftSource[] {
  const previousById = new Map(
    previous.map((source) => [source.sourceId, source]),
  );
  return next.map((source) => {
    const saved = previousById.get(source.sourceId);
    if (!saved) {
      return {
        ...source,
        byteSize: null,
        checksumSha256: null,
        fileId: null,
        originalName: null,
        status: "local",
        workbookId: null,
      };
    }
    return {
      ...source,
      byteSize: saved.byteSize,
      checksumSha256: saved.checksumSha256,
      fileId: saved.fileId,
      originalName: saved.originalName,
      status: saved.status,
      workbookId: saved.workbookId,
    };
  });
}
