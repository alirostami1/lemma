import type { StudioController } from "./studio-controller-types";

const noop = () => {};

export type StudioControllerFixtureOverrides = {
  draftId?: string;
  commandBar?: Partial<StudioController["commandBar"]>;
  editor?: Partial<StudioController["editor"]>;
  publishDialog?: Partial<StudioController["publishDialog"]>;
  readiness?: Partial<StudioController["readiness"]>;
  savedBlueprints?: Partial<StudioController["savedBlueprints"]>;
  source?: Partial<Omit<StudioController["source"], "actions">> & {
    actions?: Partial<StudioController["source"]["actions"]>;
  };
  sourcePicker?: Partial<StudioController["sourcePicker"]>;
};

export function createReadyStudioControllerFixture(
  overrides: StudioControllerFixtureOverrides = {},
): StudioController {
  const draftId = overrides.draftId ?? "draft-1";
  const controller = {
    routeIntent: { draftId, type: "edit_draft" },
    state: {
      canGenerate: false,
      generateDisabledReason: null,
      phase: "editing_draft",
      saveError: null,
      saveState: "saved",
    },
    readiness: {
      canGenerate: false,
      canSave: true,
      issues: [],
    },
    commandBar: {
      blueprintDescription: "",
      blueprintName: "Current work",
      canRedo: false,
      canUndo: false,
      generationAction: {
        available: false,
        disabledReason: "Publish before generating questions.",
        onGenerate: null,
      },
      isPublishing: false,
      isSaving: false,
      onBlueprintDescriptionChange: noop,
      onBlueprintNameChange: noop,
      onOpenPublishDialog: noop,
      onOpenSavedBlueprints: noop,
      onRedo: noop,
      onReloadLatestDraft: noop,
      onReset: noop,
      onSaveDraft: noop,
      onUndo: noop,
      saveConflict: null,
      saveError: null,
      saveState: "saved",
    },
    draftLoadState: { status: "ready" },
    draftRecovery: {
      onDiscard: noop,
      onKeepCurrent: noop,
      onRestore: noop,
      open: false,
      snapshot: null,
    },
    editor: {
      authoringModel: {
        blocks: [],
        references: [],
        responseFields: [],
        schemaVersion: 1,
      },
      canUseWorkbookTools: true,
      documentIssues: [],
      onAuthoringModelChange: noop,
      referencePreviewCache: {},
      referenceRecoveryItems: [],
      sources: [],
      workbookSheetNamesBySourceId: {},
    },
    publishDialog: {
      isPublishing: false,
      isSavingBeforePublish: false,
      onOpenChange: noop,
      onPublish: noop,
      open: false,
      state: { currentName: "Current work", validationIssue: null },
    },
    resetConfirmation: { onCancel: noop, onConfirm: noop, open: false },
    savedBlueprints: {
      blueprintAction: { onEditAsDraft: noop },
      blueprints: [],
      draftLoadMoreErrorMessage: null,
      drafts: [],
      draftsErrorMessage: null,
      errorMessage: null,
      hasMoreBlueprints: false,
      hasMoreDrafts: false,
      isDraftsInitialLoading: false,
      isInitialLoading: false,
      isLoadingBlueprintsMore: false,
      isLoadingDraftsMore: false,
      loadMoreErrorMessage: null,
      onLoadMoreBlueprints: noop,
      onLoadMoreDrafts: noop,
      onOpenChange: noop,
      onOpenDraft: noop,
      onRetry: noop,
      open: false,
    },
    source: {
      actions: {
        addSource: noop,
        createSource: noop,
        reattachSource: async () => ({ sources: [], status: "changed" }),
        removeSource: () => ({ sources: [], status: "changed" }),
        replaceSources: noop,
        setPickerOpen: noop,
      },
      getSourceById: () => null,
      isLookupSourceLoading: false,
      isPickerOpen: false,
      lookupLocalWorkbook: null,
      lookupSourceWorkbook: null,
      sources: [],
      usageBySourceId: new Map(),
      workbookPreviewController: {
        hasMoreWorkbookSheets: false,
        isWorkbookPreviewPending: false,
        isLoadingMoreWorkbookSheets: false,
        loadMoreWorkbookSheets: noop,
        needsWorkbookPreviewCalculation: false,
        previewStatus: "idle",
        workbookPreview: null,
        workbookPreviewError: null,
        workbookSheets: [],
        workbookSnapshotId: null,
      },
    },
    sourcePicker: { onOpenChange: noop, open: false },
    workbookPicker: {
      fileName: "",
      hasMoreWorkbookSheets: false,
      isLoadingMoreWorkbookSheets: false,
      localWorkbook: null,
      onLoadMoreWorkbookSheets: noop,
      onOpenChange: noop,
      onSelect: noop,
      open: false,
      openWorkbookPicker: noop,
      request: null,
      workbookSheets: [],
      workbookSnapshotId: null,
    },
  } satisfies StudioController;

  return {
    ...controller,
    commandBar: {
      ...controller.commandBar,
      ...overrides.commandBar,
    },
    editor: {
      ...controller.editor,
      ...overrides.editor,
    },
    publishDialog: {
      ...controller.publishDialog,
      ...overrides.publishDialog,
    },
    readiness: {
      ...controller.readiness,
      ...overrides.readiness,
    },
    savedBlueprints: {
      ...controller.savedBlueprints,
      ...overrides.savedBlueprints,
    },
    source: {
      ...controller.source,
      ...overrides.source,
      actions: {
        ...controller.source.actions,
        ...overrides.source?.actions,
      },
    },
    sourcePicker: {
      ...controller.sourcePicker,
      ...overrides.sourcePicker,
    },
  };
}
