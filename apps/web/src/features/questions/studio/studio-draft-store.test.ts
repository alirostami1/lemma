// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import {
  createStudioDraftKey,
  createStudioDraftSnapshot,
  readLatestStudioDraftSnapshot,
  readStudioDraftSnapshot,
  writeStudioDraftSnapshot,
  writeStudioDraftSnapshotWithAssets,
} from "./studio-draft-store";

const draftAssetMocks = vi.hoisted(() => ({
  saveStudioDraftWorkbookFile: vi.fn(),
}));

vi.mock("./studio-draft-assets-store", () => ({
  saveStudioDraftWorkbookFile: draftAssetMocks.saveStudioDraftWorkbookFile,
}));

describe("studio draft store", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    draftAssetMocks.saveStudioDraftWorkbookFile.mockReset();
  });

  it("writes and reads saved blueprint draft snapshots", () => {
    const baseTimestamp = Date.now();
    const snapshot = createStudioDraftSnapshot({
      authoringModel: createModel(),
      blueprintDescription: "Description",
      blueprintName: "Blueprint",
      draftKey: createStudioDraftKey({
        loadedBlueprintId: "blueprint_1",
      }),
      lastRemoteSaveSnapshotKey: "remote-key",
      loadedBlueprintId: "blueprint_1",
      sources: [persistedSource("source_1", "workbook_1")],
      timestamp: baseTimestamp - 120_000,
    });

    expect(writeStudioDraftSnapshot(snapshot).ok).toBe(true);
    expect(snapshot.draftKey).toBe("blueprint:blueprint_1");
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
      error: "invalid_snapshot",
      ok: false,
    });
    expect(
      window.localStorage.getItem(
        "lemma:studio-draft:v1:blueprint:blueprint_1",
      ),
    ).toBeNull();
  });

  it("reads the latest draft snapshot", () => {
    const baseTimestamp = Date.now();
    const first = createStudioDraftSnapshot({
      authoringModel: createModel(),
      blueprintDescription: "",
      blueprintName: "First",
      draftKey: "new:first",
      lastRemoteSaveSnapshotKey: null,
      loadedBlueprintId: null,
      sources: [persistedSource("source_1", "workbook_1")],
      timestamp: baseTimestamp - 200_000,
    });
    const latest = createStudioDraftSnapshot({
      authoringModel: createModel(),
      blueprintDescription: "",
      blueprintName: "Latest",
      draftKey: "new:latest",
      lastRemoteSaveSnapshotKey: null,
      loadedBlueprintId: null,
      sources: [persistedSource("source_2", "workbook_2")],
      timestamp: baseTimestamp,
    });

    writeStudioDraftSnapshot(first);
    writeStudioDraftSnapshot(latest);

    expect(readLatestStudioDraftSnapshot()).toEqual({
      ok: true,
      value: latest,
    });
  });

  it("stores local workbook source metadata without file contents", () => {
    const snapshot = createStudioDraftSnapshot({
      authoringModel: createModel(),
      blueprintDescription: "",
      blueprintName: "Draft",
      draftKey: "new:local",
      lastRemoteSaveSnapshotKey: null,
      loadedBlueprintId: null,
      sources: [localSource("source_1")],
      timestamp: Date.now(),
    });

    expect(writeStudioDraftSnapshot(snapshot).ok).toBe(true);

    const raw = window.localStorage.getItem("lemma:studio-draft:v1:new:local");
    expect(raw).toContain('"kind":"local_file"');
    expect(raw).not.toContain("xlsx-bytes");
    expect(raw).not.toContain("1200");
    expect(raw).not.toContain("rawValue");
    expect(raw).not.toContain("parsedWorkbook");
  });

  it("stores draft-file source metadata without file contents", () => {
    const snapshot = createStudioDraftSnapshot({
      authoringModel: createModel(),
      blueprintDescription: "",
      blueprintName: "Draft",
      draftKey: "new:draft-file",
      lastRemoteSaveSnapshotKey: null,
      loadedBlueprintId: null,
      sources: [draftFileSource("source_2", "file_2")],
      timestamp: Date.now(),
    });

    expect(writeStudioDraftSnapshot(snapshot).ok).toBe(true);

    const raw = window.localStorage.getItem(
      "lemma:studio-draft:v1:new:draft-file",
    );
    expect(raw).toContain('"kind":"draft_file"');
    expect(raw).not.toContain("fileBlob");
    expect(raw).not.toContain("parsedWorkbook");
    expect(raw).not.toContain("rawValue");
  });

  it("reads draft-file source metadata without file contents", () => {
    const snapshot = createStudioDraftSnapshot({
      authoringModel: createModel(),
      blueprintDescription: "",
      blueprintName: "Draft",
      draftKey: "new:draft-file-read",
      lastRemoteSaveSnapshotKey: null,
      loadedBlueprintId: null,
      sources: [draftFileSource("source_2", "file_2")],
      timestamp: Date.now(),
    });

    expect(writeStudioDraftSnapshot(snapshot).ok).toBe(true);

    const readResult = readStudioDraftSnapshot("new:draft-file-read");
    expect(readResult).toEqual({
      ok: true,
      value: {
        ...snapshot,
        sources: [
          {
            ...snapshot.sources[0],
            backing: {
              ...snapshot.sources[0]?.backing,
              parsedWorkbook: null,
              previewError: null,
              previewStatus: "idle",
              workbookId: null,
            },
          },
        ],
      },
    });
  });

  it("writes local workbook assets before marking draft safe", async () => {
    draftAssetMocks.saveStudioDraftWorkbookFile.mockResolvedValue({
      ok: true,
      value: undefined,
    });
    const snapshot = createStudioDraftSnapshot({
      authoringModel: createModel(),
      blueprintDescription: "",
      blueprintName: "Draft",
      draftKey: "new:asset-safe",
      lastRemoteSaveSnapshotKey: null,
      loadedBlueprintId: null,
      sources: [localSource("source_1")],
      timestamp: Date.now(),
    });

    await expect(
      writeStudioDraftSnapshotWithAssets({ snapshot }),
    ).resolves.toEqual({
      assets: { status: "safe" },
      ok: true,
      value: snapshot,
    });
    expect(draftAssetMocks.saveStudioDraftWorkbookFile).toHaveBeenCalledWith({
      draftKey: "new:asset-safe",
      file: expect.any(File),
      sourceId: "source_1",
    });
    expect(readStudioDraftSnapshot("new:asset-safe").ok).toBe(true);
  });

  it("writes metadata and reports unsafe assets when draft asset write fails", async () => {
    draftAssetMocks.saveStudioDraftWorkbookFile.mockResolvedValue({
      error: "write_failed",
      ok: false,
    });
    const snapshot = createStudioDraftSnapshot({
      authoringModel: createModel(),
      blueprintDescription: "",
      blueprintName: "Draft",
      draftKey: "new:asset-unsafe",
      lastRemoteSaveSnapshotKey: null,
      loadedBlueprintId: null,
      sources: [localSource("source_1")],
      timestamp: Date.now(),
    });

    await expect(
      writeStudioDraftSnapshotWithAssets({ snapshot }),
    ).resolves.toEqual({
      assets: {
        error: "asset_write_failed",
        status: "unsafe",
        unsafeSourceIds: ["source_1"],
      },
      ok: true,
      value: snapshot,
    });
    expect(
      window.localStorage.getItem("lemma:studio-draft:v1:new:asset-unsafe"),
    ).not.toBeNull();
    const readResult = readStudioDraftSnapshot("new:asset-unsafe");
    expect(readResult.ok && readResult.value?.sources[0]?.backing.kind).toBe(
      "restoring_local_file",
    );
  });

  it("returns failure when local draft metadata cannot be written", async () => {
    draftAssetMocks.saveStudioDraftWorkbookFile.mockResolvedValue({
      ok: true,
      value: undefined,
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });
    const snapshot = createStudioDraftSnapshot({
      authoringModel: createModel(),
      blueprintDescription: "",
      blueprintName: "Draft",
      draftKey: "new:storage-failed",
      lastRemoteSaveSnapshotKey: null,
      loadedBlueprintId: null,
      sources: [localSource("source_1")],
      timestamp: Date.now(),
    });

    await expect(
      writeStudioDraftSnapshotWithAssets({ snapshot }),
    ).resolves.toEqual({
      error: "storage_unavailable",
      ok: false,
    });
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
    name: sourceId.replace(/^source_/u, "Source "),
    sourceId,
    type: "workbook" as const,
  };
}

function localSource(sourceId: string) {
  return {
    backing: {
      byteSize: 10,
      file: new File(["xlsx-bytes"], `${sourceId}.xlsx`, {
        lastModified: 123,
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      kind: "local_file" as const,
      lastModified: 123,
      originalName: `${sourceId}.xlsx`,
      parsedWorkbook: {
        byteSize: 10,
        cellsByKey: new Map([
          [
            "Sheet1!A1",
            {
              address: "A1",
              displayValue: "1200",
              formula: null,
              hasCachedValue: true,
              rawValue: 1200,
              sheetName: "Sheet1",
              type: "number" as const,
            },
          ],
        ]),
        fileName: `${sourceId}.xlsx`,
        parsedAt: new Date("2026-06-21T00:00:00.000Z"),
        sheetCount: 1,
        sheets: [
          {
            columnCount: 1,
            name: "Sheet1",
            rowCount: 1,
            usedRange: "Sheet1!A1",
          },
        ],
      },
      parseError: null,
      parseStatus: "parsed" as const,
      uploadError: null,
      uploadStatus: "not_uploaded" as const,
      workbookId: null,
    },
    createdAt: new Date("2026-06-21T00:00:00.000Z"),
    name: sourceId.replace(/^source_/u, "Source "),
    sourceId,
    type: "workbook" as const,
  };
}

function draftFileSource(sourceId: string, fileId: string) {
  return {
    backing: {
      byteSize: 10,
      checksumSha256: "abcd",
      fileId,
      kind: "draft_file" as const,
      originalName: `${sourceId}.xlsx`,
      parsedWorkbook: null,
      previewError: null,
      previewStatus: "idle" as const,
      workbookId: null,
    },
    createdAt: new Date("2026-06-21T00:00:00.000Z"),
    name: sourceId.replace(/^source_/u, "Source "),
    sourceId,
    type: "workbook" as const,
  };
}
