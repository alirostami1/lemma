// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import {
  createStudioDraftKey,
  createStudioDraftSnapshot,
  readLatestStudioDraftSnapshot,
  readStudioDraftSnapshot,
  writeStudioDraftSnapshot,
} from "./studio-draft-store";

describe("studio draft store", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("writes and reads versioned draft snapshots", () => {
    const baseTimestamp = Date.now();
    const snapshot = createStudioDraftSnapshot({
      draftKey: createStudioDraftKey({
        loadedBlueprintId: "blueprint_1",
        initialWorkbookId: "",
      }),
      loadedBlueprintId: "blueprint_1",
      selectedWorkbookId: "workbook_1",
      blueprintName: "Blueprint",
      blueprintDescription: "Description",
      authoringModel: createModel(),
      lastRemoteSaveSnapshotKey: "remote-key",
      timestamp: baseTimestamp - 120_000,
    });

    expect(writeStudioDraftSnapshot(snapshot).ok).toBe(true);
    expect(readStudioDraftSnapshot(snapshot.draftKey)).toEqual({
      ok: true,
      value: snapshot,
    });
  });

  it("discards incompatible snapshots", () => {
    window.localStorage.setItem(
      "lemma:studio-draft:v1:blueprint:blueprint_1",
      JSON.stringify({ schemaVersion: 0 }),
    );

    expect(readStudioDraftSnapshot("blueprint:blueprint_1")).toEqual({
      ok: false,
      error: "invalid_snapshot",
    });
    expect(
      window.localStorage.getItem("lemma:studio-draft:v1:blueprint:blueprint_1"),
    ).toBeNull();
  });

  it("reads the latest draft snapshot", () => {
    const baseTimestamp = Date.now();
    const first = createStudioDraftSnapshot({
      draftKey: "new:first",
      loadedBlueprintId: null,
      selectedWorkbookId: "workbook_1",
      blueprintName: "First",
      blueprintDescription: "",
      authoringModel: createModel(),
      lastRemoteSaveSnapshotKey: null,
      timestamp: baseTimestamp - 200_000,
    });
    const latest = createStudioDraftSnapshot({
      draftKey: "new:latest",
      loadedBlueprintId: null,
      selectedWorkbookId: "workbook_2",
      blueprintName: "Latest",
      blueprintDescription: "",
      authoringModel: createModel(),
      lastRemoteSaveSnapshotKey: null,
      timestamp: baseTimestamp,
    });

    writeStudioDraftSnapshot(first);
    writeStudioDraftSnapshot(latest);

    expect(readLatestStudioDraftSnapshot()).toEqual({
      ok: true,
      value: latest,
    });
  });
});

function createModel(): ComposedEditorModel {
  return {
    schemaVersion: 1,
    blocks: [],
    responseFields: [],
    references: [],
  };
}
