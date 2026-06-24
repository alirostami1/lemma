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
      sources: [persistedSource("source_1", "workbook-1")],
    });

    expect(state.draftKey).toBe("blueprint:blueprint-1");
    expect(state.syncedSnapshot).toMatchObject({
      authoringModel,
      blueprintDescription: "Description",
      blueprintName: " Blueprint ",
      draftKey: "blueprint:blueprint-1",
      loadedBlueprintId: "blueprint-1",
      sources: [
        {
          backing: {
            byteSize: null,
            kind: "persisted_workbook",
            originalName: "source_1.xlsx",
            parsedWorkbook: null,
            workbookId: "workbook-1",
          },
          createdAt: expect.any(Date),
          name: "Source 1",
          sourceId: "source_1",
          type: "workbook",
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
    blocks: [],
    references: [],
    responseFields: [],
    schemaVersion: 1,
  };
}

function persistedSource(sourceId: string, workbookId: string) {
  return {
    backing: {
      byteSize: null,
      kind: "persisted_workbook" as const,
      originalName: `${sourceId}.xlsx`,
      parsedWorkbook: null,
      workbookId,
    },
    createdAt: new Date("2026-06-21T00:00:00.000Z"),
    name: "Source 1",
    sourceId,
    type: "workbook" as const,
  };
}
