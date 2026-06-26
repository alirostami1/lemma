// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import {
  useBlueprintDraftResetAction,
  useStudioDraftMarkServerSavedAction,
} from "./use-blueprint-draft-actions";

const draftStoreMocks = vi.hoisted(() => ({
  deleteStudioDraftSnapshot: vi.fn(),
  writeStudioDraftSnapshot: vi.fn(),
}));

vi.mock("./studio-draft-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./studio-draft-store")>();
  return {
    ...actual,
    deleteStudioDraftSnapshot: draftStoreMocks.deleteStudioDraftSnapshot,
    writeStudioDraftSnapshot: draftStoreMocks.writeStudioDraftSnapshot,
  };
});

describe("useBlueprintDraftResetAction", () => {
  it("uses product copy when reset cannot persist saved changes", () => {
    draftStoreMocks.writeStudioDraftSnapshot.mockReturnValue({
      error: "storage_unavailable",
      ok: false,
    });

    const setLocalDraftError = vi.fn();
    const setLocalDraftStatus = vi.fn();
    const navigate = vi.fn();
    const { result } = renderHook(() =>
      useBlueprintDraftResetAction({
        checkedRecoveryDraftKeyRef: { current: null },
        draftStorageKey: "blueprint:old",
        navigate,
        replaceCurrentSnapshot: vi.fn(),
        setAuthoringModel: vi.fn(),
        setBlueprintDescription: vi.fn(),
        setBlueprintName: vi.fn(),
        setDraftStorageKey: vi.fn(),
        setHasUserEdited: vi.fn(),
        setIsRecoveryResolved: vi.fn(),
        setIsResetConfirmationOpen: vi.fn(),
        setLastLocalSavedDraftKey: vi.fn(),
        setLastRemoteSaveSnapshotKey: vi.fn(),
        setLastSavedDraftKey: vi.fn(),
        setLoadError: vi.fn(),
        setLoadedBlueprintId: vi.fn(),
        setLocalDraftError,
        setLocalDraftStatus,
        setRecoverySnapshot: vi.fn(),
        setSources: vi.fn(),
      }),
    );

    act(() => {
      result.current();
    });

    expect(setLocalDraftStatus).toHaveBeenCalledWith("failed");
    expect(setLocalDraftError).toHaveBeenCalledWith(
      "Saved changes could not be reset.",
    );
    expect(navigate).toHaveBeenCalled();
  });
});

describe("useStudioDraftMarkServerSavedAction", () => {
  it("uses product copy when saved changes cannot be synced locally", () => {
    draftStoreMocks.writeStudioDraftSnapshot.mockReturnValue({
      error: "storage_unavailable",
      ok: false,
    });

    const setLocalDraftError = vi.fn();
    const setLocalDraftStatus = vi.fn();
    const { result } = renderHook(() =>
      useStudioDraftMarkServerSavedAction({
        draftStorageKey: "blueprint:old",
        replaceCurrentSnapshot: vi.fn(),
        setAuthoringModel: vi.fn(),
        setBlueprintDescription: vi.fn(),
        setBlueprintName: vi.fn(),
        setDraftStorageKey: vi.fn(),
        setHasUserEdited: vi.fn(),
        setLastLocalSavedDraftKey: vi.fn(),
        setLastRemoteSaveSnapshotKey: vi.fn(),
        setLastSavedDraftKey: vi.fn(),
        setLoadedBlueprintId: vi.fn(),
        setLocalDraftError,
        setLocalDraftStatus,
        setServerDraftId: vi.fn(),
        setServerDraftRevision: vi.fn(),
        setSources: vi.fn(),
      }),
    );

    act(() => {
      result.current({
        authoringModel: createModel(),
        draft: {
          baseVersionId: null,
          blueprintId: "blueprint-1",
          createdAt: new Date("2026-06-20T00:00:00.000Z"),
          createdByUserId: "owner-1",
          description: null,
          discardedAt: null,
          document: {
            blocks: [],
            references: [],
            responseFields: [],
            schemaVersion: 1,
          },
          id: "draft-1",
          lastSavedAt: new Date("2026-06-21T00:00:00.000Z"),
          name: "Blueprint",
          ownerUserId: "owner-1",
          publishedAt: null,
          publishedVersionId: null,
          revision: 2,
          sources: [],
          status: "draft",
          updatedAt: new Date("2026-06-21T00:00:00.000Z"),
        },
        sources: [],
      });
    });

    expect(setLocalDraftStatus).toHaveBeenCalledWith("failed");
    expect(setLocalDraftError).toHaveBeenCalledWith(
      "Saved changes could not be synced.",
    );
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
