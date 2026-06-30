import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { questionKeys } from "#/domains/questions/keys";
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
import { getStudioEditorReadinessViewModel } from "./studio-editor-readiness-view-model";
import { getStudioReadiness } from "./studio-readiness";
import { parseStudioRouteIntent } from "./studio-route-intent";
import { getStudioState } from "./studio-state";
import { useBlueprintDraftController } from "./use-blueprint-draft-controller";
import { useReferencePreviewController } from "./use-reference-preview-controller";
import { useSavedBlueprintsController } from "./use-saved-blueprints-controller";
import { useStudioDraftSaveController } from "./use-studio-draft-save-controller";
import { useStudioUndoRedoHotkeys } from "./use-studio-undo-redo-hotkeys";

export type { StudioRouteSearch } from "./studio-controller-types";

export function useStudioController(
  input: StudioRouteSearch = {},
): StudioController {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const routeIntent = parseStudioRouteIntent(input);
  const initialDraftId =
    routeIntent.type === "edit_draft" ? routeIntent.draftId : "";
  const [workbookPickerRequest, setWorkbookPickerRequest] =
    useState<WorkbookPickerRequest | null>(null);
  const [
    workbookSelectionValuesBySourceAndRef,
    setWorkbookSelectionValuesBySourceAndRef,
  ] = useState<Record<string, string[][]>>({});
  const [isSavedBlueprintsOpen, setIsSavedBlueprintsOpen] = useState(false);

  const draft = useBlueprintDraftController({
    initialDraftId,
  });

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
        sources: draftStorage.sources,
      }),
    [
      attachedSources,
      draft.authoringModel,
      draft.blueprintName,
      draftStorage.sources,
    ],
  );
  const editorReadiness = useMemo(
    () => getStudioEditorReadinessViewModel(readiness),
    [readiness],
  );
  const save = useStudioDraftSaveController({
    authoringModel: draft.authoringModel,
    blueprintDescription: draft.blueprintDescription,
    blueprintName: draft.blueprintName,
    initialDraftId: draft.serverDraftId,
    initialDraftRevision: draft.serverDraftRevision,
    onDraftPublished: (published) => {
      const publishedBlueprintId = published.questionBlueprint.id;

      void queryClient.invalidateQueries({
        queryKey: questionKeys.questionBlueprintDrafts(),
      });
      void queryClient.invalidateQueries({
        queryKey: questionKeys.questionBlueprintDraftDetail(published.draft.id),
      });
      void queryClient.invalidateQueries({
        queryKey: questionKeys.questionBlueprints(),
      });
      void queryClient.invalidateQueries({
        queryKey: questionKeys.questionBlueprintDetail(publishedBlueprintId),
      });
      void queryClient.invalidateQueries({
        queryKey: questionKeys.questionBlueprintAuthoring(publishedBlueprintId),
      });
      void navigate({
        params: { questionBlueprintId: publishedBlueprintId },
        to: "/question-blueprints/$questionBlueprintId",
      });
    },
    onDraftSaved: (saved) => {
      draft.markServerDraftSaved(saved);
      queryClient.setQueryData(
        questionKeys.questionBlueprintDraftDetail(saved.draft.id),
        { draft: saved.draft },
      );
      void queryClient.invalidateQueries({
        queryKey: questionKeys.questionBlueprintDrafts(),
      });
      void navigateToStudioDraft(navigate, saved.draft.id, { replace: true });
    },
    onSourcesChange: draft.setSources,
    readiness,
    sources: draftStorage.sources,
  });
  const savedBlueprints = useSavedBlueprintsController({
    onEditBlueprintAsDraft: (blueprint) => {
      void navigateToStudioBlueprint(navigate, blueprint.id, {
        replace: false,
      });
    },
    onOpenDraft: (draftId) => {
      void navigateToStudioDraft(navigate, draftId, { replace: false });
    },
  });

  function handleUndo() {
    save.markDraftChanged();
    draft.undo();
  }

  function handleRedo() {
    save.markDraftChanged();
    draft.redo();
  }

  useStudioUndoRedoHotkeys({
    canRedo: draft.canRedo,
    canUndo: draft.canUndo,
    redo: handleRedo,
    undo: handleUndo,
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

  const studioState = getStudioState({
    hasUnsavedChanges: draft.hasUnsavedChanges,
    isLoadingBlueprint: draft.isLoadingBlueprint,
    isResetPending: draft.resetConfirmation.open,
    loadError: draft.loadError,
    loadedBlueprintId: draft.loadedBlueprintId,
    localDraftError: draft.localDraftError,
    localDraftStatus: draft.localDraftStatus,
    remoteSaveError: save.commandBarSave.saveError,
    remoteSaveIsSaving: save.commandBarSave.isSaving,
    restoredInitialLocalDraft: draft.restoredInitialLocalDraft,
  });

  return {
    draftLoadState: draft.draftLoadState,
    commandBar: {
      blueprintDescription: draft.blueprintDescription,
      blueprintName: draft.blueprintName,
      canGenerate: studioState.canGenerate,
      canRedo: draft.canRedo,
      canUndo: draft.canUndo,
      generateDisabledReason: studioState.generateDisabledReason,
      isSaving: save.commandBarSave.isSaving,
      isPublishing: save.commandBarSave.isPublishing,
      onBlueprintDescriptionChange: (description) => {
        save.markDraftChanged();
        draft.setBlueprintDescription(description);
      },
      onBlueprintNameChange: (name) => {
        save.markDraftChanged();
        draft.setBlueprintName(name);
      },
      onOpenPublishDialog: save.commandBarSave.onOpenPublishDialog,
      onReloadLatestDraft: save.onReloadLatestDraft,
      onOpenSavedBlueprints: () => setIsSavedBlueprintsOpen(true),
      onRedo: handleRedo,
      onReset: draft.requestReset,
      onSaveDraft: save.commandBarSave.onSaveDraft,
      onUndo: handleUndo,
      routeSearch: toStudioSearch(
        routeIntent.type === "edit_draft"
          ? { draftId: initialDraftId, kind: "draft" }
          : { kind: "blank" },
      ),
      saveError: studioState.saveError,
      saveConflict: save.conflict,
      saveState: studioState.saveState,
    },
    draftRecovery: draft.draftRecovery,
    editor: {
      authoringModel: draft.authoringModel,
      canUseWorkbookTools,
      documentIssues: editorReadiness.documentIssues,
      onAuthoringModelChange: (model) => {
        save.markDraftChanged();
        draft.setAuthoringModel(model);
      },
      referencePreviewCache: referencePreview.referencePreviewCache,
      referenceRecoveryItems: editorReadiness.referenceRecoveryItems,
      sources: editorSources,
      workbookSheetNamesBySourceId,
    },
    readiness,
    routeIntent,
    resetConfirmation: {
      ...draft.resetConfirmation,
      onConfirm: () => {
        save.markDraftChanged();
        draft.resetConfirmation.onConfirm();
      },
    },
    publishDialog: save.publishDialog,
    savedBlueprints: {
      open: isSavedBlueprintsOpen,
      ...savedBlueprints,
      blueprintAction: {
        ...savedBlueprints.blueprintAction,
        onEditAsDraft: (id) => {
          savedBlueprints.blueprintAction.onEditAsDraft(id);
          setIsSavedBlueprintsOpen(false);
        },
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
        createSource: (source) => {
          save.markDraftChanged();
          draftStorage.actions.createSource(source);
        },
        reattachSource: async (sourceId, file) => {
          const result = await draftStorage.actions.reattachSource(
            sourceId,
            file,
          );
          if (result.status === "changed") {
            save.markDraftChanged();
          }
          return result;
        },
        removeSource: (sourceId) => {
          const result = draftStorage.actions.removeSource(sourceId);
          if (result.status === "changed") {
            save.markDraftChanged();
          }
          return result;
        },
        replaceSources: (sources) => {
          save.markDraftChanged();
          draftStorage.actions.replaceSources(sources);
        },
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
