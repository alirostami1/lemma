// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import type { StudioSource } from "./source/studio-source-model";
import { useStudioLocalDraftEffects } from "./use-studio-local-draft-effects";

const draftStoreMocks = vi.hoisted(() => ({
  readStudioDraftSnapshot: vi.fn(),
  writeStudioDraftSnapshot: vi.fn(),
}));

vi.mock("./studio-draft-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./studio-draft-store")>();
  return {
    ...actual,
    readStudioDraftSnapshot: draftStoreMocks.readStudioDraftSnapshot,
    writeStudioDraftSnapshot: draftStoreMocks.writeStudioDraftSnapshot,
  };
});

describe("useStudioLocalDraftEffects", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    draftStoreMocks.readStudioDraftSnapshot.mockReset();
    draftStoreMocks.writeStudioDraftSnapshot.mockReset();
    draftStoreMocks.readStudioDraftSnapshot.mockReturnValue({
      ok: true,
      value: null,
    });
    draftStoreMocks.writeStudioDraftSnapshot.mockReturnValue({
      ok: true,
      value: {},
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("surfaces product copy when saved changes cannot be loaded", () => {
    const setLocalDraftError = vi.fn();
    const setLocalDraftStatus = vi.fn();

    draftStoreMocks.readStudioDraftSnapshot.mockReturnValue({
      error: "storage_unavailable",
      ok: false,
    });

    renderHook(() =>
      useStudioLocalDraftEffects({
        authoringModel: createModel(),
        blueprintDescription: "",
        blueprintName: "Blueprint",
        currentDraftKey: "current",
        draftStorageKey: "new:default",
        hasUserEdited: false,
        isDraftRouteActive: false,
        isRecoveryResolved: false,
        isRemoteLoadPending: false,
        lastLocalSavedDraftKey: null,
        lastRemoteSaveSnapshotKey: null,
        lastSavedDraftKey: null,
        loadedBlueprintId: null,
        serverDraftId: null,
        setIsRecoveryResolved: vi.fn(),
        setLastLocalSavedDraftKey: vi.fn(),
        setLocalDraftError,
        setLocalDraftStatus,
        setRecoverySnapshot: vi.fn(),
        sources: [],
      }),
    );

    expect(setLocalDraftStatus).toHaveBeenCalledWith("failed");
    expect(setLocalDraftError).toHaveBeenCalledWith(
      "Saved changes could not be loaded.",
    );
  });

  it("surfaces product copy when changes cannot be autosaved", async () => {
    const setLocalDraftError = vi.fn();
    const setLocalDraftStatus = vi.fn();

    draftStoreMocks.writeStudioDraftSnapshot.mockReturnValue({
      error: "storage_unavailable",
      ok: false,
    });

    renderHook(() =>
      useStudioLocalDraftEffects({
        authoringModel: createModel(),
        blueprintDescription: "",
        blueprintName: "Blueprint",
        currentDraftKey: "current",
        draftStorageKey: "new:default",
        hasUserEdited: true,
        isDraftRouteActive: false,
        isRecoveryResolved: true,
        isRemoteLoadPending: false,
        lastLocalSavedDraftKey: null,
        lastRemoteSaveSnapshotKey: null,
        lastSavedDraftKey: null,
        loadedBlueprintId: null,
        serverDraftId: null,
        setIsRecoveryResolved: vi.fn(),
        setLastLocalSavedDraftKey: vi.fn(),
        setLocalDraftError,
        setLocalDraftStatus,
        setRecoverySnapshot: vi.fn(),
        sources: [],
      }),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
      await Promise.resolve();
    });

    expect(setLocalDraftStatus).toHaveBeenCalledWith("failed");
    expect(setLocalDraftError).toHaveBeenCalledWith(
      "Changes could not be autosaved.",
    );
  });

  it("keeps leave protection without global error when restoring local files are still unsafe", () => {
    const addEventListener = vi.spyOn(window, "addEventListener");
    const setLocalDraftError = vi.fn();

    renderHook(() =>
      useStudioLocalDraftEffects({
        authoringModel: createModel(),
        blueprintDescription: "",
        blueprintName: "Saved work",
        currentDraftKey: "current",
        draftStorageKey: "new:default",
        hasUserEdited: false,
        isDraftRouteActive: false,
        isRecoveryResolved: true,
        isRemoteLoadPending: false,
        lastLocalSavedDraftKey: "current",
        lastRemoteSaveSnapshotKey: "current",
        lastSavedDraftKey: "current",
        loadedBlueprintId: null,
        serverDraftId: null,
        setIsRecoveryResolved: vi.fn(),
        setLastLocalSavedDraftKey: vi.fn(),
        setLocalDraftError,
        setLocalDraftStatus: vi.fn(),
        setRecoverySnapshot: vi.fn(),
        sources: [restoringSource()],
      }),
    );

    expect(
      addEventListener.mock.calls.some(
        ([eventType]) => eventType === "beforeunload",
      ),
    ).toBe(true);
    expect(setLocalDraftError).not.toHaveBeenCalled();
  });

  it("does not attach leave protection for a clean loaded server draft", () => {
    const addEventListener = vi.spyOn(window, "addEventListener");

    renderHook(() =>
      useStudioLocalDraftEffects({
        authoringModel: createModel(),
        blueprintDescription: "",
        blueprintName: "Blueprint",
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
        blueprintName: "Blueprint",
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
        blueprintName: "Saved work",
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
      blueprintName: "Saved work",
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
    schemaVersion: 2,
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

function restoringSource(): StudioSource {
  return {
    backing: {
      byteSize: 4,
      kind: "restoring_local_file",
      lastModified: 123,
      originalName: "budget.xlsx",
      workbookId: null,
    },
    createdAt: new Date("2026-06-21T00:00:00.000Z"),
    name: "Budget",
    sourceId: "source_1",
    type: "workbook",
  };
}
