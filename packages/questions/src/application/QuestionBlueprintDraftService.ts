import { z } from "zod";
import {
  attachDraftSourceFile,
  createQuestionBlueprintDraft,
  createSourceArtifact,
  createSourceDocument,
  createSourceRevision,
  discardQuestionBlueprintDraft,
  InvalidQuestionStateTransitionError,
  publishableWorkbookDraftSource,
  type QuestionBlueprint,
  type QuestionBlueprintDraft,
  type QuestionBlueprintDraftSource,
  type QuestionBlueprintDraftSourceIntent,
  type QuestionBlueprintDraftStatus,
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
  workbookId,
} from "../domain/index.js";
import type {
  AttachQuestionBlueprintDraftSourceFileCommand,
  CompleteQuestionBlueprintDraftWorkbookEditorUploadCommand,
  CreateQuestionBlueprintDraftCommand,
  CreateQuestionBlueprintDraftWorkbookEditorUploadCommand,
  CreateQuestionBlueprintEditDraftCommand,
  DiscardQuestionBlueprintDraftCommand,
  ListCommand,
  ListQuestionBlueprintDraftsCommand,
  PublishQuestionBlueprintDraftCommand,
  QuestionBlueprintDraftByIdCommand,
  SaveQuestionBlueprintDraftWorkbookSourceRevisionCommand,
  UpdateQuestionBlueprintDraftCommand,
} from "./commands.js";
import type {
  CompletedQuestionBlueprintDraftWorkbookEditorUploadResult,
  CreatedQuestionBlueprintDraftWorkbookEditorUploadResult,
  PublishedQuestionBlueprintDraftResult,
  QuestionBlueprintDraftResult,
  QuestionBlueprintDraftsResult,
  QuestionBlueprintEditDraftResult,
  SavedQuestionBlueprintDraftWorkbookSourceRevisionResult,
} from "./dto.js";
import {
  DraftSourceEditorUploadInvalidError,
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
  WorkbookEditorOutputStaleError,
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
  DraftSourceUploadMetadata,
  DraftSourceWorkbookMaterialization,
  DraftSourceWorkbookRegistrationPort,
  IdGenerator,
  PublishSourceMaterialization,
  QuestionBlueprintDraftTransactionPort,
  QuestionsRepository,
} from "./ports.js";
import {
  WORKBOOK_EDITOR_OUTPUT_FILE_METADATA_TYPE,
  WORKBOOK_EDITOR_OUTPUT_FILE_METADATA_VERSION,
} from "./ports.js";

const WORKBOOK_SOURCE_PROCESSOR = "lemma-workbook";
const WORKBOOK_SOURCE_PROCESSOR_VERSION = "1";
const workbookEditorOutputFileMetadataSchema = z.strictObject({
  draftId: z.string().min(1),
  draftRevision: z.number().int().min(1),
  ownerUserId: z.string().min(1),
  sourceArtifactId: z.string().min(1).nullable(),
  sourceDocumentId: z.string().min(1),
  sourceId: z.string().min(1),
  sourceRevisionId: z.string().min(1),
  type: z.literal(WORKBOOK_EDITOR_OUTPUT_FILE_METADATA_TYPE),
  version: z.literal(WORKBOOK_EDITOR_OUTPUT_FILE_METADATA_VERSION),
});

type WorkbookEditorOutputFileMetadata = z.infer<
  typeof workbookEditorOutputFileMetadataSchema
>;

type SaveWorkbookSourceRevisionInput = {
  command:
    | AttachQuestionBlueprintDraftSourceFileCommand
    | SaveQuestionBlueprintDraftWorkbookSourceRevisionCommand;
  editorMetadata: { origin: "file_upload" | "workbook_editor" };
  expectedFilePurpose: "workbook" | "workbook_editor_output";
  fileId: string;
  requireExistingRevision: boolean;
};

export class QuestionBlueprintDraftService {
  constructor(
    private readonly deps: {
      questionsRepository: QuestionsRepository;
      draftSourceFilePort: DraftSourceFilePort;
      questionBlueprintDraftTransaction: QuestionBlueprintDraftTransactionPort;
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
    command: ListQuestionBlueprintDraftsCommand,
  ): Promise<QuestionBlueprintDraftsResult> {
    const limit = normalizeListLimit(command.limit);
    const statuses: readonly QuestionBlueprintDraftStatus[] = command.status
      ? [command.status]
      : ["draft"];
    const drafts =
      await this.deps.questionsRepository.listQuestionBlueprintDraftsByOwnerUserId(
        {
          cursor: decodeListCursor(command.cursor),
          limit: limit + 1,
          ownerUserId: userId(command.currentUser.user.id),
          statuses,
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
    const result = await this.saveWorkbookSourceRevision({
      command,
      editorMetadata: { origin: "file_upload" },
      expectedFilePurpose: "workbook",
      fileId: command.fileId,
      requireExistingRevision: false,
    });
    return { draft: result.draft };
  }

  async saveQuestionBlueprintDraftWorkbookSourceRevision(
    command: SaveQuestionBlueprintDraftWorkbookSourceRevisionCommand,
  ): Promise<SavedQuestionBlueprintDraftWorkbookSourceRevisionResult> {
    return this.saveWorkbookSourceRevision({
      command,
      editorMetadata: { origin: "workbook_editor" },
      expectedFilePurpose: "workbook_editor_output",
      fileId: command.editorOutputFileId,
      requireExistingRevision: true,
    });
  }

  async createQuestionBlueprintDraftWorkbookEditorUpload(
    command: CreateQuestionBlueprintDraftWorkbookEditorUploadCommand,
  ): Promise<CreatedQuestionBlueprintDraftWorkbookEditorUploadResult> {
    const draft = await this.findOwned(command);
    assertExpectedDraftRevision(draft, command.expectedRevision);
    const source = draft.sources.find(
      (candidate) => candidate.sourceId === command.sourceId,
    );
    assertEditorUploadSourceReady(source);

    return this.deps.draftSourceFilePort.createEditorOutputUpload({
      byteSize: command.byteSize,
      checksumSha256: command.checksumSha256,
      contentType: command.contentType,
      currentUser: command.currentUser,
      draftId: draft.id,
      draftRevision: draft.revision,
      originalName: command.originalName,
      sourceArtifactId: source.sourceArtifactId,
      sourceDocumentId: source.sourceDocumentId,
      sourceId: source.sourceId,
      sourceRevisionId: source.sourceRevisionId,
    });
  }

  async completeQuestionBlueprintDraftWorkbookEditorUpload(
    command: CompleteQuestionBlueprintDraftWorkbookEditorUploadCommand,
  ): Promise<CompletedQuestionBlueprintDraftWorkbookEditorUploadResult> {
    const draft = await this.findOwned(command);
    assertExpectedDraftRevision(draft, command.expectedRevision);
    const source = draft.sources.find(
      (candidate) => candidate.sourceId === command.sourceId,
    );
    assertEditorUploadSourceReady(source);

    const upload = await this.deps.draftSourceFilePort.getUploadMetadata({
      currentUser: command.currentUser,
      uploadId: command.uploadId,
    });
    assertWorkbookEditorOutputMetadataMatchesCurrentSource(upload, {
      draft,
      source,
    });

    const completed =
      await this.deps.draftSourceFilePort.completeEditorOutputUpload({
        currentUser: command.currentUser,
        uploadId: command.uploadId,
      });
    assertWorkbookEditorOutputMetadataMatchesCurrentSource(
      {
        metadata: completed.file.metadata,
        ownerUserId: completed.file.ownerUserId,
        purpose: completed.file.purpose,
        uploadId: command.uploadId,
      },
      { draft, source },
    );

    return {
      editorOutputFile: {
        byteSize: completed.file.byteSize,
        checksumSha256: completed.file.checksumSha256,
        contentType: completed.file.contentType,
        id: completed.file.id,
        originalName: completed.file.originalName,
      },
    };
  }

  private async saveWorkbookSourceRevision(
    input: SaveWorkbookSourceRevisionInput,
  ): Promise<SavedQuestionBlueprintDraftWorkbookSourceRevisionResult> {
    const { command } = input;
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
    if (
      input.requireExistingRevision &&
      (!source.sourceDocumentId || !source.sourceRevisionId)
    ) {
      throw new DraftSourceNotReadyError(
        "Workbook editor output requires an existing source revision.",
      );
    }
    const file = await this.deps.draftSourceFilePort.getFileMetadata({
      currentUser: command.currentUser,
      fileId: input.fileId,
    });
    if (file.ownerUserId !== draft.ownerUserId) {
      throw new DraftSourceFileForbiddenError(
        "Draft source file must belong to draft owner.",
      );
    }
    if (
      file.purpose !== input.expectedFilePurpose ||
      file.contentType !==
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ) {
      throw new DraftSourceFileInvalidError(
        input.expectedFilePurpose === "workbook_editor_output"
          ? "Workbook editor output file is invalid."
          : "Draft source file must be an xlsx workbook.",
      );
    }
    if (input.expectedFilePurpose === "workbook_editor_output") {
      assertWorkbookEditorOutputFileMetadataMatchesCurrentSource(file, {
        draft,
        source,
      });
    }
    const persisted =
      await this.deps.questionBlueprintDraftTransaction.transaction(
        async ({
          fileReferenceGuard,
          questionsRepository,
          workbookRegistrationPort,
        }) => {
          const lockedDraft =
            await questionsRepository.findQuestionBlueprintDraftByIdForUpdate(
              draft.id,
            );
          if (!lockedDraft) return null;
          if (lockedDraft.ownerUserId !== command.currentUser.user.id) {
            return null;
          }
          assertExpectedDraftRevision(lockedDraft, command.expectedRevision);
          if (lockedDraft.status !== "draft") {
            throw new InvalidQuestionStateTransitionError(
              "question blueprint draft cannot change from current state",
            );
          }
          const lockedSource = lockedDraft.sources.find(
            (candidate) => candidate.sourceId === command.sourceId,
          );
          if (!lockedSource) throw new DraftSourceNotFoundError();
          if (lockedSource.type !== "workbook") {
            throw new DraftSourceKindUnsupportedError();
          }
          if (
            input.requireExistingRevision &&
            (!lockedSource.sourceDocumentId || !lockedSource.sourceRevisionId)
          ) {
            throw new DraftSourceNotReadyError(
              "Workbook editor output requires an existing source revision.",
            );
          }
          if (input.expectedFilePurpose === "workbook_editor_output") {
            assertWorkbookEditorOutputFileMetadataMatchesCurrentSource(file, {
              draft: lockedDraft,
              source: lockedSource,
            });
          }
          await fileReferenceGuard.assertFileAliasReferenceableForUpdate(
            file.fileId,
          );
          const materialization = await this.materializeWorkbookSource({
            command,
            draft: lockedDraft,
            editorMetadata: input.editorMetadata,
            file,
            questionsRepository,
            source: lockedSource,
            workbookRegistrationPort,
          });
          if (materialization.sourceDocument) {
            await questionsRepository.createSourceDocument(
              materialization.sourceDocument,
            );
          }
          await questionsRepository.createSourceRevision(
            materialization.sourceRevision,
          );
          await questionsRepository.createSourceArtifact(
            materialization.sourceArtifact,
          );
          if (materialization.advanceDocumentHead) {
            await questionsRepository.setSourceDocumentCurrentRevision({
              currentRevisionId: materialization.sourceRevisionId,
              expectedCurrentRevisionId:
                materialization.sourceRevision.parentRevisionId,
              kind: materialization.sourceRevision.kind,
              ownerUserId: lockedDraft.ownerUserId,
              sourceDocumentId: materialization.sourceDocumentId,
              updatedAt: materialization.attachedAt,
            });
          }
          const updatedDraft = attachDraftSourceFile(
            lockedDraft,
            {
              byteSize: file.byteSize,
              checksumSha256: file.checksumSha256,
              fileId: file.fileId,
              originalName: file.originalName,
              sourceArtifactId: materialization.sourceArtifactId,
              sourceDocumentId: materialization.sourceDocumentId,
              sourceId: command.sourceId,
              sourceRevisionId: materialization.sourceRevisionId,
              status: materialization.draftSourceStatus,
              workbookId: materialization.workbookId,
            },
            materialization.attachedAt,
          );
          const persistedDraft =
            await questionsRepository.updateQuestionBlueprintDraftWithExpectedRevision(
              {
                draft: updatedDraft,
                expectedRevision: command.expectedRevision,
              },
            );
          return persistedDraft
            ? {
                draft: persistedDraft,
                sourceArtifact: materialization.sourceArtifact,
                sourceRevision: materialization.sourceRevision,
              }
            : null;
        },
      );
    if (!persisted) throw new QuestionBlueprintDraftNotFoundError();
    return persisted;
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
      try {
        const readySource = publishableWorkbookDraftSource(source);
        sourceMaterialization.push({
          sourceArtifactId: readySource.sourceArtifactId,
          sourceDocumentId: readySource.sourceDocumentId,
          sourceId,
          sourceRevisionId: readySource.sourceRevisionId,
          workbookId: readySource.workbookId,
        });
      } catch {
        throw new DraftSourceNotReadyError("Workbook source is not validated.");
      }
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

  private async materializeWorkbookSource(input: {
    command: Pick<
      AttachQuestionBlueprintDraftSourceFileCommand,
      "currentUser" | "lineage"
    >;
    draft: QuestionBlueprintDraft;
    editorMetadata: { origin: "file_upload" | "workbook_editor" };
    file: DraftSourceFileMetadata;
    questionsRepository: QuestionsRepository;
    source: QuestionBlueprintDraftSource;
    workbookRegistrationPort: DraftSourceWorkbookRegistrationPort;
  }): Promise<DraftSourceWorkbookMaterialization> {
    const at = this.deps.clock.now();
    const registered =
      await input.workbookRegistrationPort.registerWorkbookFromFile({
        byteSize: input.file.byteSize,
        checksumSha256: input.file.checksumSha256,
        contentType: input.file.contentType,
        createdByUserId: userId(input.command.currentUser.user.id),
        fileId: input.file.fileId,
        lineage: input.command.lineage,
        name: input.source.name,
        originalName: input.file.originalName,
        ownerUserId: input.draft.ownerUserId,
      });
    if (registered.status === "archived" || registered.status === "deleted") {
      throw new DraftSourceFileInvalidError(
        "Draft source workbook is unavailable.",
      );
    }
    const registeredWorkbookId = workbookId(registered.workbookId);
    const sourceDocumentId =
      input.source.sourceDocumentId ?? this.deps.idGenerator.sourceDocumentId();
    const sourceRevisionId = this.deps.idGenerator.sourceRevisionId();
    const sourceArtifactId = this.deps.idGenerator.sourceArtifactId();
    const previousRevision = input.source.sourceRevisionId
      ? await input.questionsRepository.findSourceRevisionById(
          input.source.sourceRevisionId,
        )
      : null;
    const parentRevisionId =
      previousRevision?.sourceDocumentId === sourceDocumentId
        ? previousRevision.id
        : null;
    const sourceDocument = input.source.sourceDocumentId
      ? null
      : createSourceDocument(
          {
            id: sourceDocumentId,
            kind: "workbook",
            name: input.source.name,
            ownerUserId: input.draft.ownerUserId,
          },
          at,
        );
    const sourceRevision = createSourceRevision({
      byteSize: input.file.byteSize,
      checksumSha256: input.file.checksumSha256,
      contentType: input.file.contentType,
      createdAt: at,
      createdByUserId: userId(input.command.currentUser.user.id),
      editorMetadata: input.editorMetadata,
      fileId: input.file.fileId,
      id: sourceRevisionId,
      kind: "workbook",
      ownerUserId: input.draft.ownerUserId,
      parentRevisionId,
      sourceDocumentId,
    });
    const sourceArtifact = createSourceArtifact(
      {
        artifactMetadata: { originalName: input.file.originalName },
        id: sourceArtifactId,
        kind: "workbook",
        ownerUserId: input.draft.ownerUserId,
        processor: WORKBOOK_SOURCE_PROCESSOR,
        processorVersion: WORKBOOK_SOURCE_PROCESSOR_VERSION,
        sourceRevisionId,
        status: toSourceArtifactStatus(registered.status),
        validationError: registered.validationError
          ? { message: registered.validationError }
          : null,
        workbookId: registeredWorkbookId,
      },
      at,
    );
    const draftSourceStatus = toDraftSourceStatus(
      toSourceArtifactStatus(registered.status),
    );

    return {
      advanceDocumentHead: true,
      draftSourceStatus,
      sourceArtifact,
      sourceArtifactId,
      attachedAt: at,
      sourceDocument,
      sourceDocumentId,
      sourceRevision,
      sourceRevisionId,
      workbookId: registeredWorkbookId,
    };
  }
}

function toSourceArtifactStatus(
  workbookStatus:
    | "pending_validation"
    | "valid"
    | "invalid"
    | "archived"
    | "deleted",
) {
  if (workbookStatus === "valid") return "valid" as const;
  if (workbookStatus === "invalid") return "invalid" as const;
  return "pending_validation" as const;
}

function toDraftSourceStatus(
  artifactStatus: "pending_validation" | "valid" | "invalid",
): "uploaded" | "validated" | "invalid" {
  if (artifactStatus === "valid") return "validated";
  if (artifactStatus === "invalid") return "invalid";
  return "uploaded";
}

function assertExpectedDraftRevision(
  draft: QuestionBlueprintDraft,
  expectedRevision: number,
): void {
  if (draft.revision !== questionBlueprintDraftRevision(expectedRevision)) {
    throw new QuestionBlueprintDraftRevisionConflictError();
  }
}

function assertEditorUploadSourceReady(
  source: QuestionBlueprintDraftSource | undefined,
): asserts source is QuestionBlueprintDraftSource & {
  sourceDocumentId: NonNullable<
    QuestionBlueprintDraftSource["sourceDocumentId"]
  >;
  sourceRevisionId: NonNullable<
    QuestionBlueprintDraftSource["sourceRevisionId"]
  >;
} {
  if (!source) throw new DraftSourceNotFoundError();
  if (source.type !== "workbook") {
    throw new DraftSourceKindUnsupportedError();
  }
  if (!source.sourceDocumentId || !source.sourceRevisionId) {
    throw new DraftSourceNotReadyError(
      "Workbook editor output requires an existing source revision.",
    );
  }
}

function assertWorkbookEditorOutputFileMetadataMatchesCurrentSource(
  file: Pick<DraftSourceFileMetadata, "metadata" | "ownerUserId" | "purpose">,
  expected: {
    draft: QuestionBlueprintDraft;
    source: QuestionBlueprintDraftSource;
  },
): void {
  if (file.purpose !== "workbook_editor_output") {
    throw new DraftSourceEditorUploadInvalidError(
      "Workbook editor output file is invalid.",
    );
  }
  if (file.ownerUserId !== expected.draft.ownerUserId) {
    throw new DraftSourceEditorUploadInvalidError(
      "Workbook editor output file is invalid.",
    );
  }
  const metadata = parseWorkbookEditorOutputFileMetadata(file.metadata);
  assertWorkbookEditorOutputMetadataMatchesExpectedSource(metadata, expected);
}

function assertWorkbookEditorOutputMetadataMatchesCurrentSource(
  upload: DraftSourceUploadMetadata,
  expected: {
    draft: QuestionBlueprintDraft;
    source: QuestionBlueprintDraftSource;
  },
): void {
  const metadata = parseWorkbookEditorOutputFileMetadata(upload.metadata);
  if (upload.purpose !== "workbook_editor_output") {
    throw new DraftSourceEditorUploadInvalidError(
      "Workbook editor upload is invalid.",
    );
  }
  if (upload.ownerUserId !== expected.draft.ownerUserId) {
    throw new DraftSourceEditorUploadInvalidError(
      "Workbook editor upload is invalid.",
    );
  }
  assertWorkbookEditorOutputMetadataMatchesExpectedSource(metadata, expected);
}

function parseWorkbookEditorOutputFileMetadata(
  metadata: Record<string, unknown>,
): WorkbookEditorOutputFileMetadata | null {
  const parsed = workbookEditorOutputFileMetadataSchema.safeParse(metadata);
  return parsed.success ? parsed.data : null;
}

function isWorkbookEditorOutputMetadataForSource(
  metadata: WorkbookEditorOutputFileMetadata,
  expected: {
    draft: QuestionBlueprintDraft;
    source: QuestionBlueprintDraftSource;
  },
): boolean {
  return (
    metadata.type === WORKBOOK_EDITOR_OUTPUT_FILE_METADATA_TYPE &&
    metadata.version === WORKBOOK_EDITOR_OUTPUT_FILE_METADATA_VERSION &&
    metadata.draftId === expected.draft.id &&
    metadata.ownerUserId === expected.draft.ownerUserId &&
    metadata.sourceId === expected.source.sourceId &&
    metadata.sourceDocumentId === expected.source.sourceDocumentId &&
    metadata.sourceRevisionId === expected.source.sourceRevisionId &&
    metadata.sourceArtifactId === expected.source.sourceArtifactId &&
    metadata.draftRevision === expected.draft.revision
  );
}

function assertWorkbookEditorOutputMetadataMatchesExpectedSource(
  metadata: WorkbookEditorOutputFileMetadata | null,
  expected: {
    draft: QuestionBlueprintDraft;
    source: QuestionBlueprintDraftSource;
  },
): void {
  if (metadata === null) {
    throw new DraftSourceEditorUploadInvalidError(
      "Workbook editor output metadata is invalid.",
    );
  }
  if (
    metadata.draftId !== expected.draft.id ||
    metadata.ownerUserId !== expected.draft.ownerUserId ||
    metadata.sourceId !== expected.source.sourceId
  ) {
    throw new DraftSourceEditorUploadInvalidError(
      "Workbook editor output metadata is invalid.",
    );
  }
  if (!isWorkbookEditorOutputMetadataForSource(metadata, expected)) {
    throw new WorkbookEditorOutputStaleError();
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
    sourceArtifactId: source.sourceArtifactId,
    sourceDocumentId: source.sourceDocumentId,
    sourceId: source.sourceId,
    sourceRevisionId: source.sourceRevisionId,
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
        sourceArtifactId: null,
        sourceDocumentId: null,
        sourceRevisionId: null,
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
      sourceArtifactId: saved.sourceArtifactId,
      sourceDocumentId: saved.sourceDocumentId,
      sourceRevisionId: saved.sourceRevisionId,
      status: saved.status,
      workbookId: saved.workbookId,
    };
  });
}
