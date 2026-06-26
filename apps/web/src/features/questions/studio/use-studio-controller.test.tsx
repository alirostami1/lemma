// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import type { StudioDraftRecoveryState } from "./use-blueprint-draft-controller";
import { useStudioController } from "./use-studio-controller";
import type { UseStudioDraftSaveControllerInput } from "./use-studio-draft-save-controller";

const navigateMock = vi.hoisted(() => vi.fn());
const draftControllerArgs = vi.hoisted(() => ({
  last: null as {
    initialDraftId: string;
  } | null,
}));
const saveControllerArgs = vi.hoisted(() => ({
  last: null as UseStudioDraftSaveControllerInput | null,
}));
const draftControllerHelpers = vi.hoisted(() => ({
  markServerDraftSaved: vi.fn(),
}));
const saveControllerHelpers = vi.hoisted(() => ({
  markDraftChanged: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("./use-blueprint-draft-controller", () => ({
  useBlueprintDraftController: (input: { initialDraftId?: string }) => {
    draftControllerArgs.last = {
      initialDraftId: input.initialDraftId ?? "",
    };
    return {
      authoringModel: createModel(),
      blueprintDescription: "Current blueprint",
      blueprintName: "Current name",
      canRedo: true,
      canUndo: true,
      currentDraftKey: "draft_key",
      draftLoadState: { status: "ready" },
      draftRecovery: {
        onDiscard: vi.fn(),
        onKeepCurrent: vi.fn(),
        onRestore: vi.fn(),
        open: false,
        snapshot: null,
      } as StudioDraftRecoveryState,
      draftStorageKey: "draft_key",
      hasUnsavedChanges: false,
      isLoadingBlueprint: false,
      loadError: null,
      loadedBlueprintId: null,
      localDraftError: null,
      localDraftStatus: "idle",
      markServerDraftSaved: draftControllerHelpers.markServerDraftSaved,
      redo: vi.fn(),
      requestReset: vi.fn(),
      resetConfirmation: {
        onCancel: vi.fn(),
        onConfirm: vi.fn(),
        open: false,
      },
      restoredInitialLocalDraft: false,
      serverDraftId: null,
      serverDraftRevision: null,
      setAuthoringModel: vi.fn(),
      setBlueprintDescription: vi.fn(),
      setBlueprintName: vi.fn(),
      setSources: vi.fn(),
      sources: [],
      undo: vi.fn(),
    };
  },
}));

vi.mock("./use-studio-draft-save-controller", () => ({
  useStudioDraftSaveController: (input: UseStudioDraftSaveControllerInput) => {
    saveControllerArgs.last = input;
    return {
      clearMessages: vi.fn(),
      commandBarSave: {
        isSaving: false,
        isPublishing: false,
        onOpenPublishDialog: vi.fn(),
        onSaveDraft: vi.fn(),
        saveError: null,
      },
      conflict: null,
      markDraftChanged: saveControllerHelpers.markDraftChanged,
      onReloadLatestDraft: vi.fn(),
      publishDialog: {
        isSavingBeforePublish: false,
        isPublishing: false,
        onOpenChange: vi.fn(),
        onPublish: vi.fn(),
        open: false,
        state: {
          currentName: "Current name",
          validationIssue: null,
        },
      },
      saveDocumentIssue: null,
    };
  },
}));

vi.mock("./use-source-controller", () => ({
  useSourceController: () => ({
    actions: {
      addSource: vi.fn(),
      createSource: vi.fn(),
      reattachSource: vi.fn(),
      removeSource: vi.fn(),
      replaceSources: vi.fn(),
      setPickerOpen: vi.fn(),
    },
    getSourceById: vi.fn(),
    isLookupSourceLoading: false,
    isPickerOpen: false,
    lookupLocalWorkbook: null,
    lookupSourceWorkbook: null,
    sources: [],
    usageBySourceId: new Map(),
    workbookPreviewController: {
      canLoadMoreWorkbookSheets: false,
      hasMoreWorkbookSheets: false,
      isLoadingMoreWorkbookSheets: false,
      loadMoreWorkbookSheets: vi.fn(),
      lookupWorkbookId: null,
      workbookSheets: [],
      workbookSnapshotId: null,
    },
  }),
}));

vi.mock("./use-reference-preview-controller", () => ({
  useReferencePreviewController: () => ({
    referencePreviewCache: {},
  }),
}));

vi.mock("./use-saved-blueprints-controller", () => ({
  useSavedBlueprintsController: (input: {
    onEditBlueprintAsDraft(blueprint: { id: string }): void;
    onOpenDraft(id: string): void;
  }) => {
    return {
      blueprints: [],
      blueprintAction: {
        onEditAsDraft: (id: string) => input.onEditBlueprintAsDraft({ id }),
      },
      draftLoadMoreErrorMessage: null,
      drafts: [],
      draftsErrorMessage: null,
      errorMessage: null,
      hasMoreDrafts: false,
      isDraftsInitialLoading: false,
      isInitialLoading: false,
      isLoadingDraftsMore: false,
      loadMoreErrorMessage: null,
      onLoadMoreBlueprints: vi.fn(),
      onLoadMoreDrafts: vi.fn(),
      onOpenDraft: input.onOpenDraft,
      onRetry: vi.fn(),
    };
  },
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
}

function createControllerWrapper() {
  const queryClient = createQueryClient();

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function renderStudioController(
  input: { blueprintId?: string; draftId?: string; new?: string } = {},
) {
  return renderHook(() => useStudioController(input), {
    wrapper: createControllerWrapper(),
  });
}

describe("useStudioController", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    draftControllerHelpers.markServerDraftSaved.mockReset();
    saveControllerHelpers.markDraftChanged.mockReset();
    saveControllerArgs.last = null;
    draftControllerArgs.last = null;
  });

  afterEach(() => {
    navigateMock.mockClear();
    vi.restoreAllMocks();
  });

  it("uses draftId when editor controller receives draft and blueprint params", () => {
    renderStudioController({
      blueprintId: "blueprint-old",
      draftId: "draft-active",
    });

    expect(draftControllerArgs.last).toEqual({
      initialDraftId: "draft-active",
    });
  });

  it("loads draft route as editor path", () => {
    renderStudioController({ draftId: "draft-active" });

    expect(draftControllerArgs.last).toEqual({
      initialDraftId: "draft-active",
    });
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("marks draft clean, updates cache, and replaces URL after saveDraft", () => {
    const setQueryData = vi.spyOn(QueryClient.prototype, "setQueryData");
    const invalidateQueries = vi.spyOn(
      QueryClient.prototype,
      "invalidateQueries",
    );
    renderStudioController({ draftId: "draft-active" });

    expect(saveControllerArgs.last).not.toBeNull();
    if (!saveControllerArgs.last) {
      throw new Error("Expected save controller arguments.");
    }

    const savedDraft = createDraft({ blueprintId: null, id: "draft-branch" });
    const saved = {
      authoringModel: createModel(),
      draft: savedDraft,
      sources: [],
    };
    saveControllerArgs.last.onDraftSaved(saved);

    expect(draftControllerHelpers.markServerDraftSaved).toHaveBeenCalledWith(
      saved,
    );
    expect(setQueryData).toHaveBeenCalledWith(
      ["questions", "question-blueprint-drafts", "detail", "draft-branch"],
      { draft: savedDraft },
    );
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["questions", "question-blueprint-drafts"],
    });
    expect(navigateMock).toHaveBeenCalledWith({
      replace: true,
      search: { draftId: "draft-branch" },
      to: "/studio",
    });
  });

  it("invalidates published draft data and redirects to the published blueprint", () => {
    const invalidateQueries = vi.spyOn(
      QueryClient.prototype,
      "invalidateQueries",
    );
    renderStudioController({ draftId: "draft-active" });

    if (!saveControllerArgs.last) {
      throw new Error("Expected save controller arguments.");
    }

    const onDraftPublished = saveControllerArgs.last.onDraftPublished;
    if (!onDraftPublished) {
      throw new Error("Expected onDraftPublished callback.");
    }

    onDraftPublished({
      draft: {
        baseVersionId: null,
        blueprintId: "blueprint-1",
        createdAt: new Date("2026-06-24T00:00:00.000Z"),
        createdByUserId: "user-1",
        description: null,
        discardedAt: null,
        document: createDocument(),
        id: "draft-1",
        lastSavedAt: new Date("2026-06-24T00:00:00.000Z"),
        name: "Published blueprint",
        ownerUserId: "user-1",
        publishedAt: new Date("2026-06-24T00:00:00.000Z"),
        publishedVersionId: "version-1",
        revision: 4,
        sources: [],
        status: "published",
        updatedAt: new Date("2026-06-24T00:00:00.000Z"),
      },
      questionBlueprint: {
        archivedAt: null,
        createdAt: new Date("2026-06-24T00:00:00.000Z"),
        createdByUserId: "user-1",
        currentVersionId: "version-1",
        description: null,
        document: {
          blocks: [],
          responseFields: [],
          schemaVersion: 1,
        },
        id: "blueprint-1",
        name: "Published blueprint",
        ownerUserId: "user-1",
        sources: [],
        status: "active",
        updatedAt: new Date("2026-06-24T00:00:00.000Z"),
        visibility: "private",
      },
      questionBlueprintVersion: {
        blueprintId: "blueprint-1",
        createdAt: new Date("2026-06-24T00:00:00.000Z"),
        createdByUserId: "user-1",
        description: null,
        document: createDocument(),
        id: "version-1",
        name: "Published blueprint",
        ownerUserId: "user-1",
        parentVersionId: null,
        publishedAt: new Date("2026-06-24T00:00:00.000Z"),
        sources: [],
        versionNumber: 1,
      },
    });

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["questions", "question-blueprint-drafts", "detail", "draft-1"],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["questions", "question-blueprints", "detail", "blueprint-1"],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: [
        "questions",
        "question-blueprints",
        "detail",
        "blueprint-1",
        "authoring",
      ],
    });
    expect(navigateMock).toHaveBeenCalledWith({
      params: { questionBlueprintId: "blueprint-1" },
      to: "/question-blueprints/$questionBlueprintId",
    });
  });

  it("navigates with replace false when opening draft or blueprint edit action from open dialog", () => {
    const { result } = renderStudioController({ draftId: "draft-active" });

    result.current.savedBlueprints.onOpenDraft("draft-open");
    result.current.savedBlueprints.blueprintAction.onEditAsDraft(
      "blueprint-open",
    );

    expect(navigateMock).toHaveBeenCalledWith({
      replace: false,
      search: { draftId: "draft-open" },
      to: "/studio",
    });
    expect(navigateMock).toHaveBeenCalledWith({
      replace: false,
      search: { blueprintId: "blueprint-open" },
      to: "/studio",
    });
  });

  it("invalidates pending publish attempt when draft content changes", () => {
    const { result } = renderStudioController({ draftId: "draft-active" });

    result.current.commandBar.onBlueprintNameChange("Changed draft");
    result.current.commandBar.onBlueprintDescriptionChange(
      "Changed description",
    );
    result.current.editor.onAuthoringModelChange(createModel());

    expect(saveControllerHelpers.markDraftChanged).toHaveBeenCalledTimes(3);
  });

  it("keeps Generate disabled for saved edit drafts before publish", () => {
    const { result } = renderStudioController({ draftId: "draft-active" });

    expect(result.current.commandBar.canGenerate).toBe(false);
    expect(result.current.commandBar.generateDisabledReason).toBe(
      "Publish before generating questions.",
    );
  });

  it("invalidates pending publish attempt when sources change", () => {
    const { result } = renderStudioController({ draftId: "draft-active" });

    result.current.source.actions.createSource({
      backing: {
        byteSize: 128,
        kind: "persisted_workbook",
        originalName: "source.xlsx",
        parsedWorkbook: null,
        workbookId: "workbook-1",
      },
      createdAt: new Date("2026-06-24T00:00:00.000Z"),
      name: "Source",
      sourceId: "source-1",
      type: "workbook",
    });

    expect(saveControllerHelpers.markDraftChanged).toHaveBeenCalledOnce();
  });

  it("invalidates pending publish attempt when undo or redo changes the draft", () => {
    const { result } = renderStudioController({ draftId: "draft-active" });

    result.current.commandBar.onUndo();
    result.current.commandBar.onRedo();

    expect(saveControllerHelpers.markDraftChanged).toHaveBeenCalledTimes(2);
  });

  it("invalidates pending publish attempt when keyboard undo or redo changes the draft", () => {
    renderStudioController({ draftId: "draft-active" });

    fireEvent.keyDown(window, { ctrlKey: true, key: "z" });
    fireEvent.keyDown(window, { ctrlKey: true, key: "y" });

    expect(saveControllerHelpers.markDraftChanged).toHaveBeenCalledTimes(2);
  });

  it("invalidates pending publish attempt when reset is confirmed", () => {
    const { result } = renderStudioController({ draftId: "draft-active" });

    result.current.resetConfirmation.onConfirm();

    expect(saveControllerHelpers.markDraftChanged).toHaveBeenCalledOnce();
  });

  it("saves a new draft URL and uses draft-only search", () => {
    renderStudioController({ draftId: "draft-active" });

    if (!saveControllerArgs.last) {
      throw new Error("Expected save controller arguments.");
    }

    saveControllerArgs.last.onDraftSaved({
      authoringModel: createModel(),
      draft: createDraft({ blueprintId: null, id: "draft-new" }),
      sources: [],
    });

    expect(navigateMock).toHaveBeenCalledWith({
      replace: true,
      search: { draftId: "draft-new" },
      to: "/studio",
    });
  });
});

function createModel(): ComposedEditorModel {
  return {
    blocks: [],
    references: [],
    responseFields: [],
    schemaVersion: 1 as const,
  };
}

function createDocument() {
  return {
    blocks: [],
    references: [],
    responseFields: [],
    schemaVersion: 1 as const,
  };
}

function createDraft(input: { blueprintId: string | null; id: string }) {
  return {
    baseVersionId: null,
    blueprintId: input.blueprintId,
    createdAt: new Date("2026-06-24T00:00:00.000Z"),
    createdByUserId: "user-1",
    description: null,
    discardedAt: null,
    document: createDocument(),
    id: input.id,
    lastSavedAt: new Date("2026-06-24T00:00:00.000Z"),
    name: "Saved draft",
    ownerUserId: "user-1",
    publishedAt: null,
    publishedVersionId: null,
    revision: 2,
    sources: [],
    status: "draft" as const,
    updatedAt: new Date("2026-06-24T00:00:00.000Z"),
  };
}
