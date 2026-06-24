import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { createWorkbookSelectionCacheKey } from "#/domains/questions/reference-preview";
import { normalizeWorkbookRef } from "#/domains/questions/workbook-reference";
import type {
  WorkbookPickerRequest,
  WorkbookRangeSelection,
} from "#/features/questions/table-block-editor";
import { toEditorAttachedWorkbookSources } from "./source/studio-source-model";
import { useSourceController } from "./source/use-source-controller";
import {
  navigateToStudioBlueprint,
  navigateToStudioDraft,
  toStudioSearch,
} from "./studio-controller-helpers";
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
  const initialDraftId = input.draftId ?? "";
  const routeHasDraftId = initialDraftId.length > 0;
  const routeHasBlueprintId = initialBlueprintId.length > 0;
  const routeHasBlueprintOnly = routeHasBlueprintId && !routeHasDraftId;
  const routeHasBothParams = routeHasDraftId && routeHasBlueprintId;
  const draftInitialBlueprintId = routeHasDraftId ? "" : initialBlueprintId;
  const [workbookPickerRequest, setWorkbookPickerRequest] =
    useState<WorkbookPickerRequest | null>(null);
  const [
    workbookSelectionValuesBySourceAndRef,
    setWorkbookSelectionValuesBySourceAndRef,
  ] = useState<Record<string, string[][]>>({});
  const [isSavedBlueprintsOpen, setIsSavedBlueprintsOpen] = useState(false);

  const draft = useBlueprintDraftController({
    initialBlueprintId: draftInitialBlueprintId,
    initialDraftId,
  });

  useEffect(() => {
    if (routeHasBothParams) {
      void navigateToStudioDraft(navigate, initialDraftId, { replace: true });
    }
  }, [
    initialBlueprintId,
    initialDraftId,
    navigate,
    routeHasBothParams,
    routeHasDraftId,
    routeHasBlueprintId,
  ]);

  const draftStorage = useSourceController({
    loadWorkbookPickerPreview: workbookPickerRequest !== null,
    lookupSourceId: workbookPickerRequest?.sourceId ?? null,
    model: draft.authoringModel,
    onSourcesChange: draft.setSources,
    sources: draft.sources,
  });
  const editorSources = useMemo(
    () => toEditorAttachedWorkbookSources(draftStorage.sources),
    [draftStorage.sources],
  );
  const referencePreview = useReferencePreviewController({
    model: draft.authoringModel,
    sources: draftStorage.sources,
    workbookSelectionValuesBySourceAndRef,
  });
  const workbookSheetNamesBySourceId = useMemo(() => {
    const sheetNamesBySourceId: Record<string, readonly string[]> = {};

    for (const studioSource of draftStorage.sources) {
      const parsedWorkbook =
        "parsedWorkbook" in studioSource.backing
          ? studioSource.backing.parsedWorkbook
          : null;
      sheetNamesBySourceId[studioSource.sourceId] =
        parsedWorkbook?.sheets.map((sheet) => sheet.name) ?? [];
    }

    return sheetNamesBySourceId;
  }, [draftStorage.sources]);

  const attachedSources = editorSources;
  const canUseWorkbookTools = attachedSources.length > 0;
  const readiness = useMemo(
    () =>
      getStudioReadiness(draft.authoringModel, {
        attachedSources,
        questionName: draft.blueprintName,
      }),
    [attachedSources, draft.authoringModel, draft.blueprintName],
  );
  const save = useSaveBlueprintController({
    authoringModel: draft.authoringModel,
    blueprintDescription: draft.blueprintDescription,
    blueprintName: draft.blueprintName,
    hasUnsavedChanges: draft.hasUnsavedChanges,
    initialDraftId: draft.serverDraftId,
    loadedBlueprintId: draft.loadedBlueprintId,
    onBlueprintPublished: ({ draftId }) => {
      if (draftId) {
        draft.clearServerDraftId();
      }
    },
    onDraftSaved: ({ draftId }) => {
      void navigateToStudioDraft(navigate, draftId, { replace: true });
    },
    onSaved: (saved) => {
      draft.markSaved(saved);
      draft.clearServerDraftId();
      void navigateToStudioBlueprint(navigate, saved.blueprintId, {
        replace: true,
      });
    },
    onSourcesChange: draft.setSources,
    readiness,
    sources: draftStorage.sources,
  });
  const generation = useGenerateQuestionsController();
  const savedBlueprints = useSavedBlueprintsController({
    onGenerateBlueprint: generation.onGenerateBlueprint,
    onOpenBlueprint: (blueprintId) => {
      void navigateToStudioBlueprint(navigate, blueprintId, { replace: false });
    },
    onOpenDraft: (draftId) => {
      void navigateToStudioDraft(navigate, draftId, { replace: false });
    },
  });

  useEffect(() => {
    setWorkbookSelectionValuesBySourceAndRef((currentValues) => {
      const sourceIds = new Set(
        attachedSources.map((source) => source.sourceId),
      );
      let changed = false;
      const nextValues: Record<string, string[][]> = {};

      for (const [cacheKey, value] of Object.entries(currentValues)) {
        const delimiterIndex = cacheKey.indexOf("::");
        const sourceId =
          delimiterIndex >= 0 ? cacheKey.slice(0, delimiterIndex) : "";
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
  const currentGenerationSource = draft.loadedBlueprintId
    ? {
        id: draft.loadedBlueprintId,
        name: draft.blueprintName,
        sources: attachedSources,
      }
    : null;
  const studioState = getStudioState({
    activeGenerationRun: generation.generationStatus.run,
    hasUnsavedChanges: draft.hasUnsavedChanges,
    isGenerationSubmitting: generation.generateDialog.isSubmitting,
    isLoadingBlueprint: draft.isLoadingBlueprint,
    isResetPending: draft.resetConfirmation.open,
    loadError: draft.loadError,
    loadedBlueprintId: draft.loadedBlueprintId,
    localDraftError: draft.localDraftError,
    localDraftStatus: draft.localDraftStatus,
    readinessIssue: generateReadinessIssue,
    remoteSaveError: save.commandBarSave.saveError,
    remoteSaveIsSaving: save.commandBarSave.isSaving,
    restoredInitialLocalDraft: draft.restoredInitialLocalDraft,
  });

  return {
    blueprintOpenWarning: draft.blueprintOpenWarning,
    commandBar: {
      blueprintDescription: draft.blueprintDescription,
      blueprintName: draft.blueprintName,
      canGenerate: studioState.canGenerate,
      canRedo: draft.canRedo,
      canUndo: draft.canUndo,
      generateDisabledReason: studioState.generateDisabledReason,
      isSaving: save.commandBarSave.isSaving,
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
      onRedo: draft.redo,
      onReset: draft.requestReset,
      onSaveDraft: save.commandBarSave.onSaveDraft,
      onUndo: draft.undo,
      routeSearch: toStudioSearch(
        routeHasDraftId
          ? { draftId: initialDraftId, kind: "draft" }
          : routeHasBlueprintOnly
            ? { blueprintId: initialBlueprintId, kind: "blueprint" }
            : { kind: "blank" },
      ),
      saveError: studioState.saveError,
      saveState: studioState.saveState,
    },
    draftRecovery: draft.draftRecovery,
    editor: {
      authoringModel: draft.authoringModel,
      canUseWorkbookTools,
      onAuthoringModelChange: (model) => {
        draft.setAuthoringModel(model);
        save.clearMessages();
      },
      referencePreviewCache: referencePreview.referencePreviewCache,
      sources: editorSources,
      workbookSheetNamesBySourceId,
    },
    generateDialog: generation.generateDialog,
    generationStatus: generation.generationStatus,
    readiness,
    resetConfirmation: draft.resetConfirmation,
    saveDialog: save.saveDialog,
    savedBlueprints: {
      open: isSavedBlueprintsOpen,
      ...savedBlueprints,
      onOpenBlueprint: (id) => {
        savedBlueprints.onOpenBlueprint(id);
        setIsSavedBlueprintsOpen(false);
      },
      onOpenChange: setIsSavedBlueprintsOpen,
      onOpenDraft: (id) => {
        savedBlueprints.onOpenDraft(id);
        setIsSavedBlueprintsOpen(false);
      },
    },
    source: {
      ...draftStorage,
      actions: {
        ...draftStorage.actions,
      },
    },
    sourcePicker: {
      onOpenChange: draftStorage.actions.setPickerOpen,
      open: draftStorage.isPickerOpen,
    },
    state: studioState,
    workbookPicker: {
      fileName: workbookPickerRequest?.sourceId
        ? (draftStorage.getSourceById(workbookPickerRequest.sourceId)?.backing
            .originalName ??
          draftStorage.getSourceById(workbookPickerRequest.sourceId)?.name ??
          "")
        : (draftStorage.lookupSourceWorkbook?.originalName ?? ""),
      hasMoreWorkbookSheets:
        draftStorage.workbookPreviewController.hasMoreWorkbookSheets,
      isLoadingMoreWorkbookSheets:
        draftStorage.workbookPreviewController.isLoadingMoreWorkbookSheets,
      localWorkbook: draftStorage.lookupLocalWorkbook,
      onLoadMoreWorkbookSheets:
        draftStorage.workbookPreviewController.loadMoreWorkbookSheets,
      onOpenChange: (open) => {
        if (!open) {
          setWorkbookPickerRequest(null);
        }
      },
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
      open: workbookPickerRequest !== null,
      openWorkbookPicker: (request) => {
        setWorkbookPickerRequest(request);
      },
      request: workbookPickerRequest,
      workbookSheets: draftStorage.workbookPreviewController.workbookSheets,
      workbookSnapshotId:
        draftStorage.workbookPreviewController.workbookSnapshotId,
    },
  };
}
