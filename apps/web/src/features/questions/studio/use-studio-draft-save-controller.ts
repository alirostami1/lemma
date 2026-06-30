import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useCompleteFileUpload,
  useCreateFileUpload,
} from "#/domains/files/hooks";
import {
  useAttachQuestionBlueprintDraftSourceFile,
  usePublishQuestionBlueprintDraft,
  useUpdateQuestionBlueprintDraft,
} from "#/domains/questions";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import { stripUnusedComposedReferences } from "#/domains/questions/authoring";
import { composedEditorModelToQuestionBlueprintDocument } from "#/domains/questions/canonical-authoring";
import type {
  PublishQuestionBlueprintDraftResult,
  QuestionBlueprintDraft,
} from "#/domains/questions/model";
import { uploadWorkbookDraftFileRuntime } from "#/domains/workbooks/upload-runtime";
import {
  notifyDraftPublished,
  notifyDraftPublishFailed,
} from "#/features/notifications";
import { getApiErrorCode } from "#/lib/errors/api-error";
import type { PublishDraftDialogState } from "./publish-draft-dialog";
import type { StudioSource } from "./source/studio-source-model";
import {
  fromDraftSourceToStudioSource,
  fromStudioSourcesToDraftSources,
} from "./source/studio-source-model";
import {
  getFirstReadinessIssueMessage,
  type StudioReadiness,
} from "./studio-readiness";

export type UseStudioDraftSaveControllerInput = {
  authoringModel: ComposedEditorModel;
  blueprintDescription: string;
  blueprintName: string;
  initialDraftId: string | null;
  initialDraftRevision: number | null;
  sources: StudioSource[];
  onSourcesChange(sources: StudioSource[]): void;
  onDraftSaved(input: {
    authoringModel: ComposedEditorModel;
    draft: QuestionBlueprintDraft;
    sources: StudioSource[];
  }): void;
  onDraftPublished(input: PublishQuestionBlueprintDraftResult): void;
  readiness: StudioReadiness;
};

export type DraftSaveConflict =
  | { type: "revision_conflict"; message: string }
  | { type: "base_version_conflict"; message: string };

export type StudioDraftSaveController = {
  commandBarSave: {
    isSaving: boolean;
    isPublishing: boolean;
    saveError: string | null;
    onOpenPublishDialog(): void;
    onSaveDraft(): void;
  };
  clearMessages(): void;
  conflict: DraftSaveConflict | null;
  markDraftChanged(): void;
  onReloadLatestDraft(): void;
  publishDialog: {
    open: boolean;
    state: PublishDraftDialogState;
    isSavingBeforePublish: boolean;
    isPublishing: boolean;
    onOpenChange(open: boolean): void;
    onPublish(): void;
  };
  saveDocumentIssue: string | null;
};

export function useStudioDraftSaveController({
  authoringModel,
  blueprintDescription,
  blueprintName,
  initialDraftId,
  initialDraftRevision,
  onDraftSaved,
  onDraftPublished,
  onSourcesChange,
  sources,
  readiness,
}: UseStudioDraftSaveControllerInput): StudioDraftSaveController {
  const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<DraftSaveConflict | null>(null);
  const [serverDraftRevision, setServerDraftRevision] = useState<number | null>(
    initialDraftRevision,
  );
  const createFileUpload = useCreateFileUpload();
  const completeFileUpload = useCompleteFileUpload();
  const updateServerDraft = useUpdateQuestionBlueprintDraft();
  const attachServerDraftFile = useAttachQuestionBlueprintDraftSourceFile();
  const publishServerDraft = usePublishQuestionBlueprintDraft();
  const publishAttemptIdempotencyKeyRef = useRef<string | null>(null);
  const publishAttemptDraftRef = useRef<{
    draftId: string;
    revision: number;
  } | null>(null);

  const isUploadingSources =
    createFileUpload.isPending || completeFileUpload.isPending;
  const isSavingDraft =
    updateServerDraft.isPending || attachServerDraftFile.isPending;
  const isSaving =
    isUploadingSources || isSavingDraft || publishServerDraft.isPending;
  const saveDocumentIssue = getFirstReadinessIssueMessage(readiness, "save");
  const publishDocumentIssue = getFirstReadinessIssueMessage(
    readiness,
    "publish",
  );

  useEffect(() => {
    setServerDraftRevision(initialDraftRevision);
    clearPublishAttempt();
  }, [initialDraftId, initialDraftRevision]);

  const publishDialogState: PublishDraftDialogState = useMemo(
    () => ({
      currentName: blueprintName,
      validationIssue:
        conflict?.message ?? publishDocumentIssue ?? saveDocumentIssue,
    }),
    [blueprintName, conflict?.message, publishDocumentIssue, saveDocumentIssue],
  );

  const clearMessages = useCallback(() => {
    setSaveError(null);
  }, []);

  function clearPublishAttempt() {
    publishAttemptIdempotencyKeyRef.current = null;
    publishAttemptDraftRef.current = null;
  }

  function markDraftChanged() {
    clearPublishAttempt();
    setConflict(null);
    setSaveError(null);
  }

  function getPublishAttemptIdempotencyKey() {
    publishAttemptIdempotencyKeyRef.current ??=
      createDraftPublishIdempotencyKey();
    return publishAttemptIdempotencyKeyRef.current;
  }

  function recordConflict(error: unknown): DraftSaveConflict | null {
    const code = getApiErrorCode(error);
    if (code === "DRAFT_REVISION_CONFLICT") {
      return {
        message: "This changed in another tab.",
        type: "revision_conflict",
      };
    }
    if (code === "BLUEPRINT_BASE_VERSION_CONFLICT") {
      return {
        message: "This changed in another tab. Reload before publishing.",
        type: "base_version_conflict",
      };
    }
    return null;
  }

  async function saveDraft() {
    clearMessages();
    setConflict(null);
    if (saveDocumentIssue) {
      setSaveError(saveDocumentIssue);
      return null;
    }

    try {
      const savedAuthoringModel = stripUnusedComposedReferences(authoringModel);
      const document =
        composedEditorModelToQuestionBlueprintDocument(savedAuthoringModel);
      const draftId = initialDraftId;
      let expectedRevision = serverDraftRevision;

      if (!draftId || expectedRevision === null) {
        throw new Error("This work could not be saved.");
      }

      let nextSources = [...sources];
      let result = await updateServerDraft.mutateAsync({
        description: blueprintDescription.trim() || null,
        document,
        draftId,
        expectedRevision,
        name: blueprintName.trim(),
        sources: fromStudioSourcesToDraftSources(nextSources),
      });
      expectedRevision = result.draft.revision;
      setServerDraftRevision(expectedRevision);

      for (const source of sources) {
        if (source.backing.kind !== "local_file") continue;
        const parsedWorkbook = source.backing.parsedWorkbook;
        const uploaded = await uploadWorkbookDraftFileRuntime({
          completeFileUpload: (args) => completeFileUpload.mutateAsync(args),
          createFileUpload: (args) => createFileUpload.mutateAsync(args),
          file: source.backing.file,
        });
        const attachedDraft = await attachServerDraftFile.mutateAsync({
          draftId,
          expectedRevision,
          fileId: uploaded.id,
          sourceId: source.sourceId,
        });
        result = attachedDraft;
        expectedRevision = attachedDraft.draft.revision;
        setServerDraftRevision(expectedRevision);
        const attachedSource = attachedDraft.draft.sources.find(
          (candidate) => candidate.sourceId === source.sourceId,
        );
        nextSources = nextSources.map((candidate) =>
          candidate.sourceId === source.sourceId
            ? attachedSource
              ? fromDraftSourceToStudioSource(attachedSource, candidate)
              : {
                  ...candidate,
                  backing: {
                    byteSize: uploaded.byteSize,
                    checksumSha256: uploaded.checksumSha256,
                    fileId: uploaded.id,
                    kind: "draft_file" as const,
                    originalName: uploaded.originalName,
                    parsedWorkbook,
                    previewError: null,
                    previewStatus: "loaded" as const,
                    workbookId: null,
                  },
                }
            : candidate,
        );
      }
      setServerDraftRevision(result.draft.revision);
      onSourcesChange(nextSources);
      onDraftSaved({
        authoringModel: savedAuthoringModel,
        draft: result.draft,
        sources: nextSources,
      });
      return { draftId: result.draft.id, revision: result.draft.revision };
    } catch (error) {
      const conflictState = recordConflict(error);
      if (conflictState) {
        setConflict(conflictState);
        setSaveError(conflictState.message);
        return null;
      }
      setSaveError(
        error instanceof Error && error.message
          ? error.message
          : "Blueprint could not be saved.",
      );
      return null;
    }
  }

  async function publishDraft() {
    clearMessages();
    setConflict(null);
    if (publishDocumentIssue) {
      setSaveError(publishDocumentIssue);
      return false;
    }

    let savedDraft = publishAttemptDraftRef.current;
    if (!savedDraft) {
      savedDraft = await saveDraft();
      publishAttemptDraftRef.current = savedDraft;
    }
    if (!savedDraft) return false;
    try {
      const result = await publishServerDraft.mutateAsync({
        draftId: savedDraft.draftId,
        expectedRevision: savedDraft.revision,
        idempotencyKey: getPublishAttemptIdempotencyKey(),
      });
      onDraftPublished(result);
      clearPublishAttempt();
      notifyDraftPublished();
      return true;
    } catch (error) {
      const conflictState = recordConflict(error);
      if (conflictState) {
        setConflict(conflictState);
        setSaveError(conflictState.message);
        notifyDraftPublishFailed(conflictState.message);
        return false;
      }
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Blueprint could not be published.";
      setSaveError(message);
      notifyDraftPublishFailed(message);
      return false;
    }
  }

  function onPublishDialogPublish() {
    void publishDraft().then((saved) => {
      if (saved) {
        setIsPublishDialogOpen(false);
      }
    });
  }

  return {
    clearMessages,
    commandBarSave: {
      isSaving,
      isPublishing: publishServerDraft.isPending,
      onOpenPublishDialog: () => {
        clearMessages();
        setIsPublishDialogOpen(true);
      },
      onSaveDraft: () => {
        clearPublishAttempt();
        void saveDraft();
      },
      saveError,
    },
    conflict,
    markDraftChanged,
    onReloadLatestDraft: () => {
      window.location.reload();
    },
    publishDialog: {
      isPublishing: publishServerDraft.isPending,
      isSavingBeforePublish: isUploadingSources || isSavingDraft,
      onOpenChange: (open) => {
        setIsPublishDialogOpen(open);
        if (!open) {
          clearPublishAttempt();
        }
      },
      onPublish: onPublishDialogPublish,
      open: isPublishDialogOpen,
      state: publishDialogState,
    },
    saveDocumentIssue,
  };
}

function createDraftPublishIdempotencyKey(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()}`;
}
