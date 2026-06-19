import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  WorkbookPickerRequest,
  WorkbookRangeSelection,
} from "#/features/questions/table-block-editor";
import { useSourceController } from "./source/use-source-controller";
import type {
  StudioController,
  StudioRouteSearch,
} from "./studio-controller-types";
import {
  getFirstReadinessIssueMessage,
  getStudioReadiness,
} from "./studio-readiness";
import { getStudioState } from "./studio-state";
import { useBlueprintDraftController } from "./use-blueprint-draft-controller";
import { useGenerateQuestionsController } from "./use-generate-questions-controller";
import { useReferencePreviewController } from "./use-reference-preview-controller";
import { useSaveBlueprintController } from "./use-save-blueprint-controller";
import { useSavedBlueprintsController } from "./use-saved-blueprints-controller";

export type { StudioRouteSearch } from "./studio-controller-types";

export function useStudioController(
  input: StudioRouteSearch = {},
): StudioController {
  const initialBlueprintId = input.blueprintId ?? "";
  const [workbookPickerRequest, setWorkbookPickerRequest] =
    useState<WorkbookPickerRequest | null>(null);
  const [workbookSelectionValuesByRef, setWorkbookSelectionValuesByRef] =
    useState<Record<string, string[][]>>({});
  const [isSavedBlueprintsOpen, setIsSavedBlueprintsOpen] = useState(false);
  const previousSelectedWorkbookIdRef = useRef<string | null>(null);
  const openWorkbookPicker = useCallback((request: WorkbookPickerRequest) => {
    setWorkbookPickerRequest(request);
  }, []);
  const draft = useBlueprintDraftController({
    initialBlueprintId,
  });
  const source = useSourceController({
    loadWorkbookPickerPreview: workbookPickerRequest !== null,
    model: draft.authoringModel,
    selectedWorkbookId: draft.selectedWorkbookId || null,
    onSelectedWorkbookIdChange: (workbookId) => {
      draft.setSelectedWorkbookId(workbookId ?? "");
    },
  });
  const referencePreview = useReferencePreviewController({
    model: draft.authoringModel,
    workbookSnapshotId: source.workbookPreviewController.workbookSnapshotId,
    workbookSelectionValuesByRef,
    workbookPreview: source.workbookPreviewController.workbookPreview,
  });

  const hasWorkbookSelection = draft.selectedWorkbookId.length > 0;
  const canUseWorkbookTools = hasWorkbookSelection;
  const readiness = useMemo(
    () =>
      getStudioReadiness(draft.authoringModel, {
        questionName: draft.blueprintName,
        hasWorkbookSelection,
        hasWorkbookPreview:
          source.workbookPreviewController.workbookSnapshotId !== null ||
          source.workbookPreviewController.previewStatus === "ready",
      }),
    [
      draft.authoringModel,
      draft.blueprintName,
      hasWorkbookSelection,
      source.workbookPreviewController.workbookSnapshotId,
      source.workbookPreviewController.previewStatus,
    ],
  );
  const save = useSaveBlueprintController({
    authoringModel: draft.authoringModel,
    blueprintDescription: draft.blueprintDescription,
    blueprintName: draft.blueprintName,
    hasUnsavedChanges: draft.hasUnsavedChanges,
    loadedBlueprintId: draft.loadedBlueprintId,
    selectedWorkbookId: draft.selectedWorkbookId,
    readiness,
    onSaved: (saved) => {
      draft.markSaved(saved);
    },
  });
  const generation = useGenerateQuestionsController({
    getWorkbookName: source.getWorkbookName,
  });
  const savedBlueprints = useSavedBlueprintsController({
    onGenerateBlueprint: generation.onGenerateBlueprint,
  });

  useEffect(() => {
    if (previousSelectedWorkbookIdRef.current === null) {
      previousSelectedWorkbookIdRef.current = draft.selectedWorkbookId;
      return;
    }

    if (previousSelectedWorkbookIdRef.current !== draft.selectedWorkbookId) {
      save.clearMessages();
      setWorkbookSelectionValuesByRef({});
      previousSelectedWorkbookIdRef.current = draft.selectedWorkbookId;
    }
  }, [draft.selectedWorkbookId, save.clearMessages]);

  const generateReadinessIssue = getFirstReadinessIssueMessage(
    readiness,
    "generate_saved_blueprint",
  );
  const currentGenerationSource =
    draft.loadedBlueprintId && draft.loadedBlueprintVersionId
      ? {
          id: draft.loadedBlueprintId,
          name: draft.blueprintName,
          workbookId: draft.selectedWorkbookId || null,
          currentVersionId: draft.loadedBlueprintVersionId,
        }
      : null;
  const studioState = getStudioState({
    activeGenerationRun: generation.generationStatus.run,
    currentGenerationSourceExists: currentGenerationSource !== null,
    hasLoadedBlueprint: draft.loadedBlueprintId !== null,
    hasUnsavedChanges: draft.hasUnsavedChanges,
    isGenerationSubmitting: generation.generateDialog.isSubmitting,
    isLoadingBlueprint: draft.isLoadingBlueprint,
    isResetPending: draft.resetConfirmation.open,
    loadError: draft.loadError,
    localDraftError: draft.localDraftError,
    localDraftStatus: draft.localDraftStatus,
    loadedBlueprintId: draft.loadedBlueprintId,
    readinessIssue: generateReadinessIssue,
    remoteSaveError: save.commandBarSave.saveError,
    remoteSaveIsSaving: save.commandBarSave.isSaving,
    restoredInitialLocalDraft: draft.restoredInitialLocalDraft,
  });

  return {
    state: studioState,
    commandBar: {
      blueprintDescription: draft.blueprintDescription,
      blueprintName: draft.blueprintName,
      canGenerate: studioState.canGenerate,
      canRedo: draft.canRedo,
      canUndo: draft.canUndo,
      generateDisabledReason: studioState.generateDisabledReason,
      isSaving: save.commandBarSave.isSaving,
      saveState: studioState.saveState,
      saveError: studioState.saveError,
      onBlueprintDescriptionChange: (description) => {
        draft.setBlueprintDescription(description);
        save.clearMessages();
      },
      onBlueprintNameChange: (name) => {
        draft.setBlueprintName(name);
        save.clearMessages();
      },
      onGenerate: () => {
        if (currentGenerationSource && studioState.canGenerate) {
          generation.onGenerateBlueprint(currentGenerationSource);
        }
      },
      onOpenSaveDialog: save.commandBarSave.onOpenSaveDialog,
      onOpenSavedBlueprints: () => setIsSavedBlueprintsOpen(true),
      onReset: draft.requestReset,
      onRedo: draft.redo,
      onUndo: draft.undo,
    },
    blueprintOpenWarning: draft.blueprintOpenWarning,
    draftRecovery: draft.draftRecovery,
    resetConfirmation: draft.resetConfirmation,
    source,
    editor: {
      authoringModel: draft.authoringModel,
      referencePreviewCache: referencePreview.referencePreviewCache,
      canUseWorkbookTools,
      onAuthoringModelChange: (model) => {
        draft.setAuthoringModel(model);
        save.clearMessages();
      },
    },
    savedBlueprints: {
      open: isSavedBlueprintsOpen,
      ...savedBlueprints,
      onOpenChange: setIsSavedBlueprintsOpen,
      onOpenBlueprint: (id) => {
        savedBlueprints.onOpenBlueprint(id);
        setIsSavedBlueprintsOpen(false);
      },
    },
    generationStatus: generation.generationStatus,
    saveDialog: save.saveDialog,
    generateDialog: generation.generateDialog,
    workbookPicker: {
      workbookSnapshotId: source.workbookPreviewController.workbookSnapshotId,
      workbookSheets: source.workbookPreviewController.workbookSheets,
      hasMoreWorkbookSheets:
        source.workbookPreviewController.hasMoreWorkbookSheets,
      isLoadingMoreWorkbookSheets:
        source.workbookPreviewController.isLoadingMoreWorkbookSheets,
      fileName:
        source.selectedWorkbook?.originalName ??
        (draft.selectedWorkbookId ? "Selected source could not be found." : ""),
      open: workbookPickerRequest !== null,
      request: workbookPickerRequest,
      openWorkbookPicker,
      onOpenChange: (open) => {
        if (!open) {
          setWorkbookPickerRequest(null);
        }
      },
      onLoadMoreWorkbookSheets:
        source.workbookPreviewController.loadMoreWorkbookSheets,
      onSelect: (selection: WorkbookRangeSelection) => {
        setWorkbookSelectionValuesByRef((currentValues) => ({
          ...currentValues,
          [selection.reference]: selection.values,
        }));
        workbookPickerRequest?.onSelect(selection);
        setWorkbookPickerRequest(null);
      },
    },
    readiness,
  };
}
