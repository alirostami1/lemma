import { describe, expect, it } from "vitest";
import type { QuestionGenerationRun } from "#/domains/questions/model";
import type { StudioDraftSnapshot } from "./studio-draft-store";
import {
  createDraftKeyFromSnapshot,
  getInitialStudioDraftSnapshot,
  getStudioState,
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
      generateDisabledReason:
        "Save this blueprint before generating questions.",
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
      phase: "editing_saved_blueprint",
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
    hasUnsavedChanges: false,
    isGenerationSubmitting: false,
    isLoadingBlueprint: false,
    isResetPending: false,
    loadError: null,
    loadedBlueprintId: "blueprint-1",
    localDraftError: null,
    localDraftStatus: "autosaved",
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
    authoringModel: {
      blocks: [],
      references: [],
      responseFields: [],
      schemaVersion: 1,
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

function createGenerationRun(
  status: QuestionGenerationRun["status"],
): QuestionGenerationRun {
  const at = new Date("2026-06-15T00:00:00.000Z");
  return {
    attemptNumber: 1,
    attempts: 1,
    blueprintId: "blueprint-1",
    createdAt: at,
    createdByUserId: "user-1",
    errorMessage: null,
    finishedAt: null,
    id: "run-1",
    ownerUserId: "user-1",
    requestedCount: 3,
    result: null,
    retryOfRunId: null,
    startedAt: at,
    status,
    targetQuestionSetId: "question-set-1",
    updatedAt: at,
    workbookCalculationId: null,
  };
}
