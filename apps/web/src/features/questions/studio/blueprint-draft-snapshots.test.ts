import { describe, expect, it } from "vitest";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import {
  createResetStudioDraftSnapshotState,
  createSavedBlueprintDraftSnapshotState,
} from "./blueprint-draft-snapshots";

describe("blueprint draft snapshots", () => {
  it("creates a reset snapshot for a new draft", () => {
    const state = createResetStudioDraftSnapshotState();

    expect(state.draftStorageKey).toBe("new:default");
    expect(state.snapshot).toMatchObject({
      blueprintDescription: "",
      blueprintName: "Question blueprint",
      draftKey: "new:default",
      lastRemoteSaveSnapshotKey: null,
      loadedBlueprintId: null,
      loadedBlueprintVersionId: null,
      sources: [],
    });
    expect(state.draftKey).toBeTruthy();
  });

  it("creates a synced snapshot after remote save", () => {
    const authoringModel = createModel();
    const state = createSavedBlueprintDraftSnapshotState({
      authoringModel,
      blueprintDescription: "Description",
      blueprintId: "blueprint-1",
      blueprintName: " Blueprint ",
      blueprintVersionId: "version-1",
      sources: [
        {
          sourceId: "source_1",
          name: "Source 1",
          workbookId: "workbook-1",
        },
      ],
    });

    expect(state.draftKey).toBe("blueprint:blueprint-1:version:version-1");
    expect(state.syncedSnapshot).toMatchObject({
      authoringModel,
      blueprintDescription: "Description",
      blueprintName: " Blueprint ",
      draftKey: "blueprint:blueprint-1:version:version-1",
      loadedBlueprintId: "blueprint-1",
      loadedBlueprintVersionId: "version-1",
      sources: [
        {
          sourceId: "source_1",
          name: "Source 1",
          workbookId: "workbook-1",
        },
      ],
    });
    expect(state.syncedSnapshot.lastRemoteSaveSnapshotKey).toBe(
      state.remoteSnapshotKey,
    );
  });
});

function createModel(): ComposedEditorModel {
  return {
    schemaVersion: 1,
    blocks: [],
    references: [],
    responseFields: [],
  };
}
