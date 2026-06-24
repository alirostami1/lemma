import { useCallback, useMemo, useState } from "react";
import {
  useCompleteFileUpload,
  useCreateFileUpload,
} from "#/domains/files/hooks";
import {
  useAttachQuestionBlueprintDraftSourceFile,
  useCreateQuestionBlueprint,
  useCreateQuestionBlueprintDraft,
  usePublishQuestionBlueprintDraft,
  useUpdateQuestionBlueprint,
  useUpdateQuestionBlueprintDraft,
} from "#/domains/questions";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import { stripUnusedComposedReferences } from "#/domains/questions/authoring";
import {
  toCreateQuestionBlueprintInput,
  toUpdateQuestionBlueprintInput,
} from "#/domains/questions/blueprint";
import { buildQuestionBlueprintDraft } from "#/domains/questions/blueprint-draft";
import { composedEditorModelToQuestionBlueprintDocument } from "#/domains/questions/canonical-authoring";
import { useCreateWorkbook } from "#/domains/workbooks/hooks";
import {
  uploadWorkbookDraftFileRuntime,
  uploadWorkbookFileRuntime,
} from "#/domains/workbooks/upload-runtime";
import {
  notifyBlueprintSaved,
  notifyBlueprintSaveFailed,
} from "#/features/notifications";
import type {
  SaveBlueprintDialogInput,
  SaveDialogState,
} from "./save-blueprint-dialog";
import { buildSourceUsageBySourceId } from "./source/source-usage";
import type { StudioSource } from "./source/studio-source-model";
import {
  fromStudioSourcesToDraftSources,
  toStudioSourcesFromSavedBlueprint,
} from "./source/studio-source-model";
import {
  getFirstReadinessIssueMessage,
  type StudioReadiness,
} from "./studio-readiness";

type UseSaveBlueprintControllerInput = {
  authoringModel: ComposedEditorModel;
  blueprintDescription: string;
  blueprintName: string;
  hasUnsavedChanges: boolean;
  loadedBlueprintId: string | null;
  initialDraftId: string | null;
  sources: StudioSource[];
  onSourcesChange(sources: StudioSource[]): void;
  onDraftSaved(input: { draftId: string }): void;
  onBlueprintPublished?: (input: {
    blueprintId: string;
    draftId: string | null;
  }) => void;
  onSaved(input: {
    blueprintDescription: string;
    blueprintId: string;
    blueprintName: string;
    sources: StudioSource[];
  }): void;
  readiness: StudioReadiness;
};

export type SaveBlueprintController = {
  commandBarSave: {
    isSaving: boolean;
    saveError: string | null;
    onOpenSaveDialog(): void;
    onSaveDraft(): void;
  };
  clearMessages(): void;
  saveDialog: {
    open: boolean;
    state: SaveDialogState;
    isSaving: boolean;
    onOpenChange(open: boolean): void;
    onSave(input: SaveBlueprintDialogInput): void;
  };
  saveDocumentIssue: string | null;
};

export function useSaveBlueprintController({
  authoringModel,
  blueprintDescription,
  blueprintName,
  hasUnsavedChanges,
  loadedBlueprintId,
  initialDraftId,
  onSaved,
  onDraftSaved,
  onBlueprintPublished,
  onSourcesChange,
  sources,
  readiness,
}: UseSaveBlueprintControllerInput): SaveBlueprintController {
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [serverDraftId, setServerDraftId] = useState<string | null>(
    initialDraftId,
  );
  const [uploadedWorkbookIdsBySourceId, setUploadedWorkbookIdsBySourceId] =
    useState<Record<string, string>>({});
  const createFileUpload = useCreateFileUpload();
  const completeFileUpload = useCompleteFileUpload();
  const createWorkbook = useCreateWorkbook();
  const createServerDraft = useCreateQuestionBlueprintDraft();
  const updateServerDraft = useUpdateQuestionBlueprintDraft();
  const attachServerDraftFile = useAttachQuestionBlueprintDraftSourceFile();
  const publishServerDraft = usePublishQuestionBlueprintDraft();
  const { mutateAsync: createBlueprint, isPending: isCreateBlueprintPending } =
    useCreateQuestionBlueprint();
  const { mutateAsync: updateBlueprint, isPending: isUpdateBlueprintPending } =
    useUpdateQuestionBlueprint();

  const isUploadingSources =
    createFileUpload.isPending ||
    completeFileUpload.isPending ||
    createWorkbook.isPending;
  const isSavingDraft =
    createServerDraft.isPending ||
    updateServerDraft.isPending ||
    attachServerDraftFile.isPending;
  const isSaving =
    isUploadingSources ||
    isSavingDraft ||
    publishServerDraft.isPending ||
    isCreateBlueprintPending ||
    isUpdateBlueprintPending;
  const hasExistingBlueprint = loadedBlueprintId !== null;
  const saveDocumentIssue = getFirstReadinessIssueMessage(readiness, "save");

  const saveDialogState: SaveDialogState = useMemo(
    () => ({
      currentName: blueprintName,
      hasExistingBlueprint,
      isDirty: hasUnsavedChanges,
      validationIssue: saveDocumentIssue,
    }),
    [blueprintName, hasExistingBlueprint, hasUnsavedChanges, saveDocumentIssue],
  );

  const clearMessages = useCallback(() => {
    setSaveError(null);
  }, []);

  async function saveDraft() {
    clearMessages();
    try {
      const document = composedEditorModelToQuestionBlueprintDocument(
        stripUnusedComposedReferences(authoringModel),
      );
      const initialSources = fromStudioSourcesToDraftSources(sources);
      const draftId =
        serverDraftId ??
        (
          await createServerDraft.mutateAsync({
            blueprintId: loadedBlueprintId,
            description: blueprintDescription.trim() || null,
            document,
            name: blueprintName.trim(),
            sources: initialSources,
          })
        ).draft.id;
      setServerDraftId(draftId);

      let nextSources = [...sources];
      for (const source of sources) {
        if (source.backing.kind !== "local_file") continue;
        const parsedWorkbook = source.backing.parsedWorkbook;
        const uploaded = await uploadWorkbookDraftFileRuntime({
          completeFileUpload: (args) => completeFileUpload.mutateAsync(args),
          createFileUpload: (args) => createFileUpload.mutateAsync(args),
          file: source.backing.file,
        });
        await attachServerDraftFile.mutateAsync({
          draftId,
          fileId: uploaded.id,
          sourceId: source.sourceId,
        });
        nextSources = nextSources.map((candidate) =>
          candidate.sourceId === source.sourceId
            ? {
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
      const result = await updateServerDraft.mutateAsync({
        description: blueprintDescription.trim() || null,
        document,
        draftId,
        name: blueprintName.trim(),
        sources: fromStudioSourcesToDraftSources(nextSources),
      });
      setServerDraftId(result.draft.id);
      onSourcesChange(nextSources);
      onDraftSaved({ draftId: result.draft.id });
      return true;
    } catch (error) {
      setSaveError(
        error instanceof Error && error.message
          ? error.message
          : "Draft could not be saved.",
      );
      return false;
    }
  }

  async function saveBlueprint(
    mode: "update_existing" | "save_as_new",
    nameOverride?: string,
  ) {
    clearMessages();
    if (saveDocumentIssue) {
      setSaveError(saveDocumentIssue);
      return false;
    }
    if (serverDraftId) {
      if (!(await saveDraft())) return false;
      try {
        const result = await publishServerDraft.mutateAsync(serverDraftId);
        const savedBlueprint = result.questionBlueprint;
        const draftId = result.draft.id;
        onSaved({
          blueprintDescription: savedBlueprint.description ?? "",
          blueprintId: savedBlueprint.id,
          blueprintName: savedBlueprint.name,
          sources: toStudioSourcesFromSavedBlueprint(savedBlueprint.sources),
        });
        onBlueprintPublished?.({
          blueprintId: savedBlueprint.id,
          draftId,
        });
        notifyBlueprintSaved();
        return true;
      } catch (error) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : "Blueprint could not be published.";
        setSaveError(message);
        notifyBlueprintSaveFailed(message);
        return false;
      }
    }

    const usageBySourceId = buildSourceUsageBySourceId({
      model: authoringModel,
      sources,
    });
    const usedSources = sources.filter(
      (source) => usageBySourceId.get(source.sourceId)?.isUsed,
    );
    const persistedSources: Array<{
      sourceId: string;
      name: string;
      workbookId: string;
    }> = [];

    try {
      for (const source of usedSources) {
        if (source.backing.kind === "missing_local_file") {
          setSaveError("Reattach the workbook file before saving.");
          return false;
        }

        if (source.backing.kind === "restoring_local_file") {
          setSaveError(
            "Workbook file is still restoring. Try again in a moment.",
          );
          return false;
        }

        if (source.backing.kind === "persisted_workbook") {
          persistedSources.push({
            name: source.name,
            sourceId: source.sourceId,
            workbookId: source.backing.workbookId,
          });
          continue;
        }
        if (source.backing.kind === "draft_file") {
          setSaveError("Save draft before publishing this source.");
          return false;
        }

        if (source.backing.parseStatus === "failed") {
          setSaveError(
            source.backing.parseError?.message ??
              "Workbook file could not be parsed.",
          );
          return false;
        }

        const cachedWorkbookId = uploadedWorkbookIdsBySourceId[source.sourceId];
        if (cachedWorkbookId) {
          persistedSources.push({
            name: source.name,
            sourceId: source.sourceId,
            workbookId: cachedWorkbookId,
          });
          continue;
        }

        onSourcesChange(
          sources.map((candidate) =>
            candidate.sourceId === source.sourceId &&
            candidate.backing.kind === "local_file"
              ? {
                  ...candidate,
                  backing: {
                    ...candidate.backing,
                    uploadError: null,
                    uploadStatus: "uploading",
                  },
                }
              : candidate,
          ),
        );
        const workbook = await uploadWorkbookFileRuntime({
          completeFileUpload: (args) => completeFileUpload.mutateAsync(args),
          createFileUpload: (args) => createFileUpload.mutateAsync(args),
          createWorkbook: (args) => createWorkbook.mutateAsync(args),
          file: source.backing.file,
          name: source.name,
        });
        setUploadedWorkbookIdsBySourceId((current) => ({
          ...current,
          [source.sourceId]: workbook.id,
        }));
        onSourcesChange(
          sources.map((candidate) =>
            candidate.sourceId === source.sourceId &&
            candidate.backing.kind === "local_file"
              ? {
                  ...candidate,
                  backing: {
                    ...candidate.backing,
                    uploadError: null,
                    uploadStatus: "uploaded",
                  },
                }
              : candidate,
          ),
        );

        persistedSources.push({
          name: source.name,
          sourceId: source.sourceId,
          workbookId: workbook.id,
        });
      }
    } catch (error) {
      onSourcesChange(
        sources.map((candidate) =>
          candidate.backing.kind === "local_file" &&
          usedSources.some((source) => source.sourceId === candidate.sourceId)
            ? {
                ...candidate,
                backing: {
                  ...candidate.backing,
                  uploadError:
                    error instanceof Error && error.message.length > 0
                      ? error.message
                      : "Source upload failed.",
                  uploadStatus: "failed",
                },
              }
            : candidate,
        ),
      );
      const message =
        error instanceof Error && error.message.length > 0
          ? error.message
          : "Source upload failed.";
      setSaveError(message);
      notifyBlueprintSaveFailed(message);
      return false;
    }

    const draft = buildQuestionBlueprintDraft({
      description: blueprintDescription,
      model: authoringModel,
      name: nameOverride ?? blueprintName,
      sources: persistedSources,
    });
    if (!draft.ok) {
      if (draft.code === "missing_name") {
        setSaveError("Add a blueprint name.");
        return false;
      }

      setSaveError(
        draft.cause instanceof Error && draft.cause.message.length > 0
          ? draft.cause.message
          : "Blueprint is invalid.",
      );
      return false;
    }

    try {
      const result =
        mode === "update_existing" && hasExistingBlueprint
          ? await updateBlueprint(
              toUpdateQuestionBlueprintInput({
                ...draft.value,
                questionBlueprintId: loadedBlueprintId ?? "",
              }),
            )
          : await createBlueprint(toCreateQuestionBlueprintInput(draft.value));
      const savedBlueprint = result.questionBlueprint;

      onSaved({
        blueprintDescription: savedBlueprint.description ?? "",
        blueprintId: savedBlueprint.id,
        blueprintName: savedBlueprint.name,
        sources: toStudioSourcesFromSavedBlueprint(savedBlueprint.sources),
      });
      setUploadedWorkbookIdsBySourceId({});
      notifyBlueprintSaved();
      return true;
    } catch (error) {
      const message =
        error instanceof Error && error.message.length > 0
          ? error.message
          : null;
      notifyBlueprintSaveFailed(message);
      setSaveError(message ?? "Blueprint could not be saved.");
      return false;
    }
  }

  return {
    clearMessages,
    commandBarSave: {
      isSaving,
      onOpenSaveDialog: () => {
        clearMessages();
        setIsSaveDialogOpen(true);
      },
      onSaveDraft: () => {
        void saveDraft();
      },
      saveError,
    },
    saveDialog: {
      isSaving,
      onOpenChange: setIsSaveDialogOpen,
      onSave: (dialogInput) => {
        void saveBlueprint(dialogInput.mode, dialogInput.name).then((saved) => {
          if (saved) {
            setIsSaveDialogOpen(false);
          }
        });
      },
      open: isSaveDialogOpen,
      state: saveDialogState,
    },
    saveDocumentIssue,
  };
}
