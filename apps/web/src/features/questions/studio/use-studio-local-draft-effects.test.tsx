// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import type { StudioSource } from "./source/studio-source-model";
import { useStudioLocalDraftEffects } from "./use-studio-local-draft-effects";

const draftStoreMocks = vi.hoisted(() => ({
  writeStudioDraftSnapshotWithAssets: vi.fn(),
}));

const draftAssetMocks = vi.hoisted(() => ({
  deleteStudioDraftWorkbookFile: vi.fn(),
  pruneStudioDraftWorkbookFiles: vi.fn(),
}));

vi.mock("./studio-draft-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./studio-draft-store")>();
  return {
    ...actual,
    writeStudioDraftSnapshotWithAssets:
      draftStoreMocks.writeStudioDraftSnapshotWithAssets,
  };
});

vi.mock("./studio-draft-assets-store", () => ({
  deleteStudioDraftWorkbookFile: draftAssetMocks.deleteStudioDraftWorkbookFile,
  pruneStudioDraftWorkbookFiles: draftAssetMocks.pruneStudioDraftWorkbookFiles,
}));

describe("useStudioLocalDraftEffects", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    draftStoreMocks.writeStudioDraftSnapshotWithAssets.mockReset();
    draftAssetMocks.deleteStudioDraftWorkbookFile.mockResolvedValue({
      ok: true,
      value: undefined,
    });
    draftAssetMocks.pruneStudioDraftWorkbookFiles.mockResolvedValue({
      ok: true,
      value: undefined,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("keeps leave protection without global error when asset backup is unsafe", async () => {
    const addEventListener = vi.spyOn(window, "addEventListener");
    const setLocalDraftStatus = vi.fn();
    const setLocalDraftError = vi.fn();
    const setLastLocalSavedDraftKey = vi.fn();
    draftStoreMocks.writeStudioDraftSnapshotWithAssets.mockResolvedValue({
      assets: {
        error: "asset_write_failed",
        status: "unsafe",
        unsafeSourceIds: ["source_1"],
      },
      ok: true,
      value: {},
    });

    renderHook(() =>
      useStudioLocalDraftEffects({
        authoringModel: createModel(),
        blueprintDescription: "",
        blueprintName: "Draft",
        currentDraftKey: "current",
        draftStorageKey: "new:default",
        hasUserEdited: true,
        isDraftRouteActive: false,
        isRecoveryResolved: true,
        isRemoteLoadPending: false,
        lastLocalSavedDraftKey: null,
        lastRemoteSaveSnapshotKey: null,
        lastSavedDraftKey: null,
        serverDraftId: null,
        loadedBlueprintId: null,
        setIsRecoveryResolved: vi.fn(),
        setLastLocalSavedDraftKey,
        setLocalDraftError,
        setLocalDraftStatus,
        setRecoverySnapshot: vi.fn(),
        sources: [localSource()],
      }),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
      await Promise.resolve();
    });

    const beforeUnloadCall = addEventListener.mock.calls.find(
      ([eventType]) => eventType === "beforeunload",
    );
    expect(typeof beforeUnloadCall?.[1]).toBe("function");
    expect(setLastLocalSavedDraftKey).toHaveBeenCalledWith("current");
    expect(setLocalDraftStatus).toHaveBeenCalledWith("autosaved");
    expect(setLocalDraftError).toHaveBeenCalledWith(null);
  });

  it("does not attach leave protection for a clean loaded server draft", () => {
    const addEventListener = vi.spyOn(window, "addEventListener");

    renderHook(() =>
      useStudioLocalDraftEffects({
        authoringModel: createModel(),
        blueprintDescription: "",
        blueprintName: "Draft",
        currentDraftKey: "current",
        draftStorageKey: "new:default",
        hasUserEdited: false,
        isDraftRouteActive: true,
        isRecoveryResolved: true,
        isRemoteLoadPending: false,
        lastLocalSavedDraftKey: "current",
        lastRemoteSaveSnapshotKey: "current",
        lastSavedDraftKey: "current",
        serverDraftId: "blueprint-1",
        loadedBlueprintId: "blueprint-1",
        setIsRecoveryResolved: vi.fn(),
        setLastLocalSavedDraftKey: vi.fn(),
        setLocalDraftError: vi.fn(),
        setLocalDraftStatus: vi.fn(),
        setRecoverySnapshot: vi.fn(),
        sources: [],
      }),
    );

    expect(
      addEventListener.mock.calls.some(
        ([eventType]) => eventType === "beforeunload",
      ),
    ).toBe(false);
  });

  it("attaches leave protection for an unsaved server draft", () => {
    const addEventListener = vi.spyOn(window, "addEventListener");

    renderHook(() =>
      useStudioLocalDraftEffects({
        authoringModel: createModel(),
        blueprintDescription: "",
        blueprintName: "Draft",
        currentDraftKey: "current",
        draftStorageKey: "new:default",
        hasUserEdited: false,
        isDraftRouteActive: true,
        isRecoveryResolved: true,
        isRemoteLoadPending: false,
        lastLocalSavedDraftKey: "current",
        lastRemoteSaveSnapshotKey: "remote-previous",
        lastSavedDraftKey: "previous",
        serverDraftId: "blueprint-1",
        loadedBlueprintId: "blueprint-1",
        setIsRecoveryResolved: vi.fn(),
        setLastLocalSavedDraftKey: vi.fn(),
        setLocalDraftError: vi.fn(),
        setLocalDraftStatus: vi.fn(),
        setRecoverySnapshot: vi.fn(),
        sources: [],
      }),
    );

    expect(
      addEventListener.mock.calls.some(
        ([eventType]) => eventType === "beforeunload",
      ),
    ).toBe(true);
  });

  it("attaches leave protection for unsaved local files even with clean saved keys", () => {
    const addEventListener = vi.spyOn(window, "addEventListener");

    renderHook(() =>
      useStudioLocalDraftEffects({
        authoringModel: createModel(),
        blueprintDescription: "",
        blueprintName: "Draft",
        currentDraftKey: "current",
        draftStorageKey: "new:default",
        hasUserEdited: false,
        isDraftRouteActive: true,
        isRecoveryResolved: true,
        isRemoteLoadPending: false,
        lastLocalSavedDraftKey: "current",
        lastRemoteSaveSnapshotKey: "remote-current",
        lastSavedDraftKey: "current",
        serverDraftId: null,
        loadedBlueprintId: null,
        setIsRecoveryResolved: vi.fn(),
        setLastLocalSavedDraftKey: vi.fn(),
        setLocalDraftError: vi.fn(),
        setLocalDraftStatus: vi.fn(),
        setRecoverySnapshot: vi.fn(),
        sources: [localSource()],
      }),
    );

    expect(
      addEventListener.mock.calls.some(
        ([eventType]) => eventType === "beforeunload",
      ),
    ).toBe(true);
  });

  it("removes leave protection after local draft becomes safe", () => {
    const addEventListener = vi.spyOn(window, "addEventListener");
    const removeEventListener = vi.spyOn(window, "removeEventListener");

    const props = {
      authoringModel: createModel(),
      blueprintDescription: "",
      blueprintName: "Draft",
      currentDraftKey: "current",
      draftStorageKey: "new:default",
      hasUserEdited: false,
      isDraftRouteActive: true,
      isRecoveryResolved: true,
      isRemoteLoadPending: false,
      lastLocalSavedDraftKey: "previous",
      lastRemoteSaveSnapshotKey: null,
      lastSavedDraftKey: "current",
      serverDraftId: null,
      loadedBlueprintId: null,
      setIsRecoveryResolved: vi.fn(),
      setLastLocalSavedDraftKey: vi.fn(),
      setLocalDraftError: vi.fn(),
      setLocalDraftStatus: vi.fn(),
      setRecoverySnapshot: vi.fn(),
      sources: [],
    };

    const hook = renderHook((input) => useStudioLocalDraftEffects(input), {
      initialProps: props,
    });
    expect(
      addEventListener.mock.calls.some(
        ([eventType]) => eventType === "beforeunload",
      ),
    ).toBe(true);

    hook.rerender({
      ...props,
      lastLocalSavedDraftKey: "current",
    });
    expect(
      removeEventListener.mock.calls.some(
        ([eventType]) => eventType === "beforeunload",
      ),
    ).toBe(true);
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

function localSource(): StudioSource {
  const file = new File(["xlsx-bytes"], "budget.xlsx", {
    lastModified: 123,
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  return {
    backing: {
      byteSize: file.size,
      file,
      kind: "local_file",
      lastModified: file.lastModified,
      originalName: file.name,
      parsedWorkbook: null,
      parseError: null,
      parseStatus: "parsed",
      uploadError: null,
      uploadStatus: "not_uploaded",
      workbookId: null,
    },
    createdAt: new Date("2026-06-21T00:00:00.000Z"),
    name: "Budget",
    sourceId: "source_1",
    type: "workbook",
  };
}
