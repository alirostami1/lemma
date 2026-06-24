// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import type {
  StudioBlueprintOpenWarningState,
  StudioDraftRecoveryState,
} from "./use-blueprint-draft-controller";
import type { useSaveBlueprintController } from "./use-save-blueprint-controller";
import { useStudioController } from "./use-studio-controller";

type UseSaveBlueprintControllerInput = Parameters<
  typeof useSaveBlueprintController
>[0];

const navigateMock = vi.hoisted(() => vi.fn());
const draftControllerArgs = vi.hoisted(() => ({
  last: null as {
    initialBlueprintId: string;
    initialDraftId: string;
  } | null,
}));
const saveControllerArgs = vi.hoisted(() => ({
  last: null as UseSaveBlueprintControllerInput | null,
}));
const savedBlueprintsControllerArgs = vi.hoisted(() => ({
  onGenerate: vi.fn(),
  onOpenBlueprint: vi.fn(),
  onOpenDraft: vi.fn(),
}));
const draftControllerHelpers = vi.hoisted(() => ({
  clearServerDraftId: vi.fn(),
  markSaved: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("./use-blueprint-draft-controller", () => ({
  useBlueprintDraftController: (input: {
    initialBlueprintId: string;
    initialDraftId?: string;
  }) => {
    draftControllerArgs.last = {
      initialBlueprintId: input.initialBlueprintId,
      initialDraftId: input.initialDraftId ?? "",
    };
    return {
      authoringModel: createModel(),
      blueprintDescription: "Current blueprint",
      blueprintName: "Current name",
      blueprintOpenWarning: {
        onCancel: vi.fn(),
        onContinue: vi.fn(),
        open: false,
        snapshot: null,
      } as StudioBlueprintOpenWarningState,
      canRedo: false,
      canUndo: false,
      clearServerDraftId: draftControllerHelpers.clearServerDraftId,
      currentDraftKey: "draft_key",
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
      loadedBlueprint: null,
      loadedBlueprintId: null,
      localDraftError: null,
      localDraftStatus: "idle",
      markSaved: draftControllerHelpers.markSaved,
      redo: vi.fn(),
      requestReset: vi.fn(),
      resetConfirmation: {
        onCancel: vi.fn(),
        onConfirm: vi.fn(),
        open: false,
      },
      restoredInitialLocalDraft: false,
      serverDraftId: null,
      setAuthoringModel: vi.fn(),
      setBlueprintDescription: vi.fn(),
      setBlueprintName: vi.fn(),
      setSources: vi.fn(),
      sources: [],
      undo: vi.fn(),
    };
  },
}));

vi.mock("./use-save-blueprint-controller", () => ({
  useSaveBlueprintController: (
    input: Parameters<typeof useSaveBlueprintController>[0],
  ) => {
    saveControllerArgs.last = input;
    return {
      clearMessages: vi.fn(),
      commandBarSave: {
        isSaving: false,
        onOpenSaveDialog: vi.fn(),
        onSaveDraft: vi.fn(),
        saveError: null,
      },
      saveDialog: {
        isSaving: false,
        onOpenChange: vi.fn(),
        onSave: vi.fn(),
        open: false,
        state: {
          currentName: "Current name",
          hasExistingBlueprint: false,
          isDirty: false,
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

vi.mock("./use-generate-questions-controller", () => ({
  useGenerateQuestionsController: () => ({
    ...({
      generateDialog: {
        countInput: "1",
        countIssue: null,
        existingQuestionSetIssue: null,
        isGenerateDisabled: false,
        isSubmitting: false,
        newQuestionSetDescription: "",
        newQuestionSetName: "",
        newQuestionSetNameIssue: null,
        onCountInputChange: vi.fn(),
        onNewQuestionSetDescriptionChange: vi.fn(),
        onNewQuestionSetNameChange: vi.fn(),
        onOpenChange: vi.fn(),
        onQuestionSetValueChange: vi.fn(),
        onSubmit: vi.fn(),
        open: false,
        questionSetMode: "create_new",
        questionSets: [],
        questionSetsErrorMessage: null,
        questionSetsLoading: false,
        selectedQuestionSetId: "",
        source: null,
        submitError: null,
      },
      generationStatus: {
        errorMessage: null,
        isRetrying: false,
        onRetry: vi.fn(),
        run: null,
      },
      onGenerateBlueprint: vi.fn(),
    } as const),
  }),
}));

vi.mock("./use-saved-blueprints-controller", () => ({
  useSavedBlueprintsController: (input: {
    onGenerateBlueprint: typeof savedBlueprintsControllerArgs.onGenerate;
    onOpenBlueprint(id: string): void;
    onOpenDraft(id: string): void;
  }) => {
    return {
      blueprints: [],
      draftLoadMoreErrorMessage: null,
      drafts: [],
      draftsErrorMessage: null,
      errorMessage: null,
      hasMoreDrafts: false,
      isDraftsInitialLoading: false,
      isInitialLoading: false,
      isLoadingDraftsMore: false,
      loadMoreErrorMessage: null,
      onGenerate: savedBlueprintsControllerArgs.onGenerate,
      onLoadMoreBlueprints: vi.fn(),
      onLoadMoreDrafts: vi.fn(),
      onOpenBlueprint: input.onOpenBlueprint,
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
  input: { blueprintId?: string; draftId?: string } = {},
) {
  return renderHook(() => useStudioController(input), {
    wrapper: createControllerWrapper(),
  });
}

describe("useStudioController", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    savedBlueprintsControllerArgs.onOpenBlueprint.mockReset();
    savedBlueprintsControllerArgs.onOpenDraft.mockReset();
    savedBlueprintsControllerArgs.onGenerate.mockReset();
    draftControllerHelpers.clearServerDraftId.mockReset();
    draftControllerHelpers.markSaved.mockReset();
    saveControllerArgs.last = null;
    draftControllerArgs.last = null;
  });

  afterEach(() => {
    navigateMock.mockClear();
  });

  it("prefers draft route params over blueprint route params", () => {
    renderStudioController({
      blueprintId: "blueprint-old",
      draftId: "draft-active",
    });

    expect(navigateMock).toHaveBeenCalledWith({
      replace: true,
      search: { draftId: "draft-active" },
      to: "/studio",
    });
    expect(draftControllerArgs.last).toEqual({
      initialBlueprintId: "",
      initialDraftId: "draft-active",
    });
  });

  it("replaces URL with draftId after saveDraft", () => {
    renderStudioController({});

    expect(saveControllerArgs.last).not.toBeNull();
    if (!saveControllerArgs.last) {
      throw new Error("Expected save controller arguments.");
    }

    saveControllerArgs.last.onDraftSaved({ draftId: "draft-branch" });

    expect(navigateMock).toHaveBeenCalledWith({
      replace: true,
      search: { draftId: "draft-branch" },
      to: "/studio",
    });
  });

  it("replaces URL with blueprintId when saved", () => {
    renderStudioController({});

    if (!saveControllerArgs.last) {
      throw new Error("Expected save controller arguments.");
    }

    const onSaved = saveControllerArgs.last.onSaved;
    onSaved({
      blueprintDescription: "desc",
      blueprintId: "blueprint-1",
      blueprintName: "Blueprint",
      sources: [],
    });

    expect(navigateMock).toHaveBeenCalledWith({
      replace: true,
      search: { blueprintId: "blueprint-1" },
      to: "/studio",
    });
    expect(draftControllerHelpers.markSaved).toHaveBeenCalledOnce();
  });

  it("clears server draft id on publish callback", () => {
    renderStudioController({});

    if (!saveControllerArgs.last) {
      throw new Error("Expected save controller arguments.");
    }

    const onBlueprintPublished = saveControllerArgs.last.onBlueprintPublished;
    if (!onBlueprintPublished) {
      throw new Error("Expected onBlueprintPublished callback.");
    }

    onBlueprintPublished({ blueprintId: "blueprint-1", draftId: "draft-1" });

    expect(draftControllerHelpers.clearServerDraftId).toHaveBeenCalled();
  });

  it("navigates with replace false when opening draft/blueprint from open dialog", () => {
    const { result } = renderStudioController({ blueprintId: "blueprint-1" });

    result.current.savedBlueprints.onOpenDraft("draft-open");
    result.current.savedBlueprints.onOpenBlueprint("blueprint-open");

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

  it("saves a new draft URL and uses draft-only search", () => {
    renderStudioController({});

    if (!saveControllerArgs.last) {
      throw new Error("Expected save controller arguments.");
    }

    saveControllerArgs.last.onDraftSaved({ draftId: "draft-new" });

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
    schemaVersion: 1,
  };
}
