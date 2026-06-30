import { describe, expect, it } from "vitest";
import type { StudioDraftSnapshot } from "./studio-draft-store";
import {
  createDraftKeyFromSnapshot,
  getInitialStudioDraftSnapshot,
  getStudioState,
  hasUnsavedChangesFromKeys,
  shouldWarnBeforeOpeningBlueprint,
} from "./studio-state";

describe("studio state", () => {
  it("opens the latest local draft when no blueprint route is requested", () => {
    const latestDraft = createSnapshot({ loadedBlueprintId: null });

    expect(
      getInitialStudioDraftSnapshot({
        latestDraft,
        routeBlueprintId: "",
      }),
    ).toBe(latestDraft);
    expect(
      getInitialStudioDraftSnapshot({
        latestDraft,
        routeBlueprintId: "blueprint-1",
      }),
    ).toBeNull();
  });

  it("warns before a blueprint route overwrites local draft changes", () => {
    const unsyncedSameBlueprint = createSnapshot({
      lastRemoteSaveSnapshotKey: null,
      loadedBlueprintId: "blueprint-1",
    });
    const syncedSameBlueprint = {
      ...unsyncedSameBlueprint,
      lastRemoteSaveSnapshotKey: createDraftKeyFromSnapshot(
        unsyncedSameBlueprint,
      ),
    };
    const otherBlueprint = createSnapshot({
      lastRemoteSaveSnapshotKey:
        createDraftKeyFromSnapshot(syncedSameBlueprint),
      loadedBlueprintId: "blueprint-2",
    });

    expect(
      shouldWarnBeforeOpeningBlueprint({
        nextBlueprintId: "blueprint-1",
        snapshot: syncedSameBlueprint,
      }),
    ).toBe(false);
    expect(
      shouldWarnBeforeOpeningBlueprint({
        nextBlueprintId: "blueprint-1",
        snapshot: unsyncedSameBlueprint,
      }),
    ).toBe(true);
    expect(
      shouldWarnBeforeOpeningBlueprint({
        nextBlueprintId: "blueprint-1",
        snapshot: otherBlueprint,
      }),
    ).toBe(true);
  });

  it("treats an untargeted draft as clean when its saved key matches", () => {
    expect(
      hasUnsavedChangesFromKeys({
        currentDraftKey: "saved-key",
        lastSavedDraftKey: "saved-key",
      }),
    ).toBe(false);
  });

  it("derives save, generate, and phase state from one model", () => {
    expect(
      getStudioState({
        ...baseStudioStateInput(),
        hasUnsavedChanges: true,
        localDraftStatus: "autosaved",
        restoredInitialLocalDraft: true,
      }),
    ).toMatchObject({
      phase: "editing_local_draft",
      saveState: "autosaved",
    });

    expect(
      getStudioState({
        ...baseStudioStateInput(),
        hasUnsavedChanges: true,
        localDraftStatus: "autosaved",
      }),
    ).toMatchObject({
      canGenerate: false,
      generateDisabledReason: "Publish before generating questions.",
      phase: "dirty",
      saveState: "autosaved",
    });

    expect(
      getStudioState({
        ...baseStudioStateInput(),
        loadError: "Blueprint could not be loaded.",
      }),
    ).toMatchObject({
      phase: "editing_draft",
      saveError: "Blueprint could not be loaded.",
      saveState: "failed",
    });

    expect(
      getStudioState({
        ...baseStudioStateInput(),
        isResetPending: true,
      }),
    ).toMatchObject({
      phase: "reset_pending",
    });
  });
});

function baseStudioStateInput() {
  return {
    hasUnsavedChanges: false,
    isLoadingBlueprint: false,
    isResetPending: false,
    loadError: null,
    loadedBlueprintId: "blueprint-1",
    localDraftError: null,
    localDraftStatus: "autosaved" as const,
    remoteSaveError: null,
    remoteSaveIsSaving: false,
    restoredInitialLocalDraft: false,
  };
}

function createSnapshot(
  input: Partial<StudioDraftSnapshot>,
): StudioDraftSnapshot {
  return {
    authoringModel: {
      blocks: [],
      references: [],
      responseFields: [],
      schemaVersion: 2,
    },
    blueprintDescription: "",
    blueprintName: "Blueprint",
    draftKey: "blueprint:blueprint-1",
    lastLocalSaveTimestamp: 100,
    lastRemoteSaveSnapshotKey: null,
    loadedBlueprintId: "blueprint-1",
    schemaVersion: 2,
    sources: [],
    ...input,
  };
}
