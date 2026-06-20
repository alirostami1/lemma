import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  WorkbookPickerRequest,
  WorkbookRangeSelection,
} from "#/features/questions/table-block-editor";
import { createWorkbookSelectionCacheKey } from "#/domains/questions/reference-preview";
import { normalizeWorkbookRef } from "#/domains/questions/workbook-reference";
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
  const navigate = useNavigate();
  const initialBlueprintId = input.blueprintId ?? "";
  const initialBlueprintVersionId = input.blueprintVersionId ?? "";
  const [workbookPickerRequest, setWorkbookPickerRequest] =
    useState<WorkbookPickerRequest | null>(null);
  const [workbookSelectionValuesBySourceAndRef, setWorkbookSelectionValuesBySourceAndRef] =
    useState<Record<string, string[][]>>({});
  const [isSavedBlueprintsOpen, setIsSavedBlueprintsOpen] = useState(false);

  const draft = useBlueprintDraftController({
    initialBlueprintId,
    initialBlueprintVersionId,
  });
  const source = useSourceController({
    loadWorkbookPickerPreview: workbookPickerRequest !== null,
    model: draft.authoringModel,
    sources: draft.sources,
    onSourcesChange: draft.setSources,
  });
  const referencePreview = useReferencePreviewController({
    model: draft.authoringModel,
    previewSourceId: source.previewSourceId,
    workbookSnapshotId: source.workbookPreviewController.workbookSnapshotId,
    workbookSelectionValuesBySourceAndRef,
    workbookPreview: source.workbookPreviewController.workbookPreview,
  });

  const attachedSources = draft.sources;
  const canUseWorkbookTools = attachedSources.length > 0;
  const readiness = useMemo(
    () =>
      getStudioReadiness(draft.authoringModel, {
        questionName: draft.blueprintName,
        attachedSources,
      }),
    [attachedSources, draft.authoringModel, draft.blueprintName],
  );
  const save = useSaveBlueprintController({
    authoringModel: draft.authoringModel,
    blueprintDescription: draft.blueprintDescription,
    blueprintName: draft.blueprintName,
    hasUnsavedChanges: draft.hasUnsavedChanges,
    loadedBlueprintId: draft.loadedBlueprintId,
    sources: attachedSources,
    readiness,
    onSaved: (saved) => {
      draft.markSaved(saved);
    },
  });
  const generation = useGenerateQuestionsController();
  const savedBlueprints = useSavedBlueprintsController({
    onGenerateBlueprint: generation.onGenerateBlueprint,
  });
  const commandBarVersions = useMemo(
    () =>
      (draft.loadedBlueprint?.versions ?? []).map((version) => ({
        id: version.id,
        versionNumber: version.versionNumber,
        createdAt: version.createdAt,
        sourceCount: version.sourceAssets.length,
        isCurrent: version.id === draft.loadedBlueprint?.currentVersionId,
      })),
    [draft.loadedBlueprint?.currentVersionId, draft.loadedBlueprint?.versions],
  );

  useEffect(() => {
    setWorkbookSelectionValuesBySourceAndRef((currentValues) => {
      const sourceIds = new Set(attachedSources.map((source) => source.sourceId));
      let changed = false;
      const nextValues: Record<string, string[][]> = {};

      for (const [cacheKey, value] of Object.entries(currentValues)) {
        const delimiterIndex = cacheKey.indexOf("::");
        const sourceId = delimiterIndex >= 0 ? cacheKey.slice(0, delimiterIndex) : "";
        if (!sourceIds.has(sourceId)) {
          changed = true;
          continue;
        }
        nextValues[cacheKey] = value;
      }

      return changed ? nextValues : currentValues;
    });
  }, [attachedSources]);

  const generateReadinessIssue = getFirstReadinessIssueMessage(
    readiness,
    "generate_saved_blueprint",
  );
  const currentGenerationSource =
    draft.loadedBlueprintId && draft.loadedBlueprintVersionId
      ? {
          id: draft.loadedBlueprintId,
          name: draft.blueprintName,
          sources: attachedSources,
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
      selectedVersionId: draft.loadedBlueprintVersionId,
      versions: commandBarVersions,
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
      onOpenVersion: (versionId) => {
        if (!draft.loadedBlueprintId || !versionId) {
          return;
        }
        void navigate({
          to: "/studio",
          search: {
            blueprintId: draft.loadedBlueprintId,
            blueprintVersionId: versionId,
          },
        });
      },
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
      sources: attachedSources,
      previewSourceId: source.previewSourceId,
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
        source.previewSourceWorkbook?.originalName ??
        (source.previewSourceId
          ? source.getSourceById(source.previewSourceId)?.name ?? ""
          : ""),
      open: workbookPickerRequest !== null,
      request: workbookPickerRequest,
      openWorkbookPicker: (request) => {
        setWorkbookPickerRequest(request);
      },
      onOpenChange: (open) => {
        if (!open) {
          setWorkbookPickerRequest(null);
        }
      },
      onLoadMoreWorkbookSheets:
        source.workbookPreviewController.loadMoreWorkbookSheets,
      onSelect: (selection: WorkbookRangeSelection) => {
        const normalizedReference =
          normalizeWorkbookRef(selection.reference) ?? selection.reference;
        setWorkbookSelectionValuesBySourceAndRef((currentValues) => ({
          ...currentValues,
          [createWorkbookSelectionCacheKey(
            selection.sourceId,
            selection.reference,
          )]: selection.values,
          [createWorkbookSelectionCacheKey(
            selection.sourceId,
            normalizedReference,
          )]: selection.values,
        }));
        workbookPickerRequest?.onSelect(selection);
        setWorkbookPickerRequest(null);
      },
    },
    readiness,
  };
}
