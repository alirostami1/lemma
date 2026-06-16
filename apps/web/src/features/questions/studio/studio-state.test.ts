import { describe, expect, it } from "vitest";
import type { QuestionGenerationRun } from "#/domains/questions/model";
import {
  createDraftKeyFromSnapshot,
  getInitialStudioDraftSnapshot,
  getStudioState,
  shouldWarnBeforeOpeningBlueprint,
} from "./studio-state";
import type { StudioDraftSnapshot } from "./studio-draft-store";

describe("studio state", () => {
  it("opens the latest local draft when no blueprint route is requested", () => {
    const latestDraft = createSnapshot({ loadedBlueprintId: null });

    expect(
      getInitialStudioDraftSnapshot({
        routeBlueprintId: "",
        latestDraft,
      }),
    ).toBe(latestDraft);
    expect(
      getInitialStudioDraftSnapshot({
        routeBlueprintId: "blueprint-1",
        latestDraft,
      }),
    ).toBeNull();
  });

  it("warns before a blueprint route overwrites local draft changes", () => {
    const unsyncedSameBlueprint = createSnapshot({
      loadedBlueprintId: "blueprint-1",
      lastRemoteSaveSnapshotKey: null,
    });
    const syncedSameBlueprint = {
      ...unsyncedSameBlueprint,
      lastRemoteSaveSnapshotKey: createDraftKeyFromSnapshot(
        unsyncedSameBlueprint,
      ),
    };
    const otherBlueprint = createSnapshot({
      loadedBlueprintId: "blueprint-2",
      lastRemoteSaveSnapshotKey: createDraftKeyFromSnapshot(
        syncedSameBlueprint,
      ),
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
      generateDisabledReason: "Save changes before generating.",
      phase: "dirty",
      saveState: "autosaved",
    });

    expect(
      getStudioState({
        ...baseStudioStateInput(),
        activeGenerationRun: createGenerationRun("materializing"),
      }),
    ).toMatchObject({
      canGenerate: true,
      phase: "generating",
      saveState: "saved",
    });

    expect(
      getStudioState({
        ...baseStudioStateInput(),
        loadError: "Blueprint could not be loaded.",
      }),
    ).toMatchObject({
      phase: "editing_persisted_version",
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

function baseStudioStateInput(): Parameters<typeof getStudioState>[0] {
  return {
    activeGenerationRun: null,
    currentGenerationSourceExists: true,
    hasLoadedBlueprint: true,
    hasUnsavedChanges: false,
    isGenerationSubmitting: false,
    isLoadingBlueprint: false,
    isResetPending: false,
    loadError: null,
    localDraftError: null,
    localDraftStatus: "autosaved",
    loadedBlueprintId: "blueprint-1",
    readinessIssue: null,
    remoteSaveError: null,
    remoteSaveIsSaving: false,
    restoredInitialLocalDraft: false,
  };
}

function createSnapshot(
  input: Partial<StudioDraftSnapshot>,
): StudioDraftSnapshot {
  return {
    schemaVersion: 1,
    draftKey: "blueprint:blueprint-1",
    loadedBlueprintId: "blueprint-1",
    loadedBlueprintVersionId: "version-1",
    selectedWorkbookId: "",
    blueprintName: "Blueprint",
    blueprintDescription: "",
    authoringModel: {
      schemaVersion: 1,
      blocks: [],
      responseFields: [],
      references: [],
    },
    lastLocalSaveTimestamp: 100,
    lastRemoteSaveSnapshotKey: null,
    ...input,
  };
}

function createGenerationRun(
  status: QuestionGenerationRun["status"],
): QuestionGenerationRun {
  const at = new Date("2026-06-15T00:00:00.000Z");
  return {
    id: "run-1",
    ownerUserId: "user-1",
    createdByUserId: "user-1",
    blueprintId: "blueprint-1",
    blueprintVersionId: "version-1",
    targetQuestionSetId: "question-set-1",
    requestedCount: 3,
    source: null,
    status,
    result: null,
    errorMessage: null,
    attempts: 1,
    startedAt: at,
    finishedAt: null,
    createdAt: at,
    updatedAt: at,
  };
}
