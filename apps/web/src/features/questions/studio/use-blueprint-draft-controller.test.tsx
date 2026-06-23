// @vitest-environment jsdom

import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import type { StudioWorkbookSource } from "./source/studio-source-model";
import {
  createStudioDraftSnapshot,
  writeStudioDraftSnapshot,
} from "./studio-draft-store";
import {
  mergeHydratedStudioSourcesBySourceId,
  useBlueprintDraftController,
} from "./use-blueprint-draft-controller";

const sourceModelMocks = vi.hoisted(() => ({
  hydrateStudioSourcesFromDraftAssets: vi.fn(),
}));
const draftQueryState = vi.hoisted(
  () =>
    new Map<
      string,
      {
        data: { draft: QuestionBlueprintDraftDto } | null;
        isError: boolean;
        isLoading: boolean;
      }
    >(),
);

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("#/domains/questions", () => ({
  useQuestionBlueprintAuthoringQuery: () => ({
    data: null,
    isError: false,
    isLoading: false,
  }),
  useQuestionBlueprintDraftQuery: (draftId: string) =>
    draftQueryState.get(draftId) ?? {
      data: null,
      isError: false,
      isLoading: false,
    },
}));

vi.mock("./source/studio-source-model", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./source/studio-source-model")>();
  return {
    ...actual,
    hydrateStudioSourcesFromDraftAssets:
      sourceModelMocks.hydrateStudioSourcesFromDraftAssets,
  };
});

describe("useBlueprintDraftController draft asset hydration", () => {
  beforeEach(() => {
    window.localStorage.clear();
    sourceModelMocks.hydrateStudioSourcesFromDraftAssets.mockReset();
    draftQueryState.clear();
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("does not restore browser-local workbook files as authoritative sources", async () => {
    writeRestoringSnapshot();
    sourceModelMocks.hydrateStudioSourcesFromDraftAssets.mockResolvedValue([
      parsedLocalSource(),
    ]);

    const { result } = renderHook(() =>
      useBlueprintDraftController({ initialBlueprintId: "" }),
    );

    await waitFor(() => expect(result.current.sources).toEqual([]));
    await settleMicrotasks();

    expect(
      sourceModelMocks.hydrateStudioSourcesFromDraftAssets,
    ).not.toHaveBeenCalled();
  });

  it("does not create missing-file state from browser cache miss", async () => {
    writeRestoringSnapshot();
    sourceModelMocks.hydrateStudioSourcesFromDraftAssets.mockResolvedValue([
      missingSource("Workbook file missing. Reattach the file to continue."),
    ]);

    const { result } = renderHook(() =>
      useBlueprintDraftController({ initialBlueprintId: "" }),
    );

    await waitFor(() => expect(result.current.sources).toEqual([]));
    await settleMicrotasks();

    expect(
      sourceModelMocks.hydrateStudioSourcesFromDraftAssets,
    ).not.toHaveBeenCalled();
  });

  it("ignores browser asset hydration failures", async () => {
    writeRestoringSnapshot();
    sourceModelMocks.hydrateStudioSourcesFromDraftAssets.mockRejectedValue(
      new Error("hydrate exploded"),
    );

    const { result } = renderHook(() =>
      useBlueprintDraftController({ initialBlueprintId: "" }),
    );

    await waitFor(() => expect(result.current.sources).toEqual([]));
    await settleMicrotasks();

    expect(
      sourceModelMocks.hydrateStudioSourcesFromDraftAssets,
    ).not.toHaveBeenCalled();
  });

  it("does not start IndexedDB hydration for old local snapshots", async () => {
    writeRestoringSnapshot();
    const { result } = renderHook(() =>
      useBlueprintDraftController({ initialBlueprintId: "" }),
    );
    await waitFor(() => expect(result.current.sources).toEqual([]));
    await settleMicrotasks();

    expect(
      sourceModelMocks.hydrateStudioSourcesFromDraftAssets,
    ).not.toHaveBeenCalled();
    expect(result.current.sources[0]?.backing.kind).not.toBe(
      "restoring_local_file",
    );
  });
});

describe("useBlueprintDraftController draft loading", () => {
  beforeEach(() => {
    draftQueryState.clear();
  });

  it("loads a draft by initialDraftId", async () => {
    draftQueryState.set("draft_a", {
      data: {
        draft: {
          blueprintId: null,
          createdAt: "2026-06-20T00:00:00.000Z",
          createdByUserId: "owner-1",
          description: null,
          document: {
            blocks: [],
            references: [],
            responseFields: [],
            schemaVersion: 1,
          },
          id: "draft_a",
          lastSavedAt: "2026-06-21T00:00:00.000Z",
          name: "Draft A",
          ownerUserId: "owner-1",
          sources: [],
          status: "draft",
          updatedAt: "2026-06-21T00:00:00.000Z",
        },
      },
      isError: false,
      isLoading: false,
    });

    const { result } = renderHook(() =>
      useBlueprintDraftController({
        initialBlueprintId: "",
        initialDraftId: "draft_a",
      }),
    );

    await waitFor(() => expect(result.current.blueprintName).toBe("Draft A"));
    expect(result.current.serverDraftId).toBe("draft_a");
    expect(result.current.loadedBlueprintId).toBeNull();
  });

  it("switches from draft A to draft B", async () => {
    draftQueryState.set("draft_a", {
      data: {
        draft: draftTemplate("draft_a", "Draft A"),
      },
      isError: false,
      isLoading: false,
    });
    draftQueryState.set("draft_b", {
      data: {
        draft: draftTemplate("draft_b", "Draft B"),
      },
      isError: false,
      isLoading: false,
    });

    const { result, rerender } = renderHook(
      (props: { draftId: string }) =>
        useBlueprintDraftController({
          initialBlueprintId: "",
          initialDraftId: props.draftId,
        }),
      {
        initialProps: {
          draftId: "draft_a",
        },
      },
    );

    await waitFor(() => expect(result.current.blueprintName).toBe("Draft A"));

    rerender({ draftId: "draft_b" });

    await waitFor(() => expect(result.current.blueprintName).toBe("Draft B"));
    expect(result.current.serverDraftId).toBe("draft_b");
  });

  it("prefers draft route over blueprint route", async () => {
    draftQueryState.set("draft_a", {
      data: {
        draft: draftTemplate("draft_a", "Draft A", "blueprint_a"),
      },
      isError: false,
      isLoading: false,
    });

    const { result } = renderHook(() =>
      useBlueprintDraftController({
        initialBlueprintId: "blueprint_x",
        initialDraftId: "draft_a",
      }),
    );

    await waitFor(() => expect(result.current.blueprintName).toBe("Draft A"));
    expect(result.current.loadedBlueprintId).toBe("blueprint_a");
  });

  it("shows draft load failure message", async () => {
    draftQueryState.set("draft_missing", {
      data: null,
      isError: true,
      isLoading: false,
    });

    const { result } = renderHook(() =>
      useBlueprintDraftController({
        initialBlueprintId: "",
        initialDraftId: "draft_missing",
      }),
    );

    await waitFor(() =>
      expect(result.current.loadError).toBe("Draft could not be loaded."),
    );
  });

  it("uses server draft when draftId is present even with local draft snapshot", async () => {
    writeStudioDraftSnapshot(
      createStudioDraftSnapshot({
        authoringModel: createModel(),
        blueprintDescription: "",
        blueprintName: "Local draft",
        draftKey: "new:default",
        lastRemoteSaveSnapshotKey: null,
        loadedBlueprintId: null,
        sources: [parsedLocalSource("draft-source")],
        timestamp: Date.now(),
      }),
    );
    draftQueryState.set("draft_local", {
      data: {
        draft: draftTemplate("draft_local", "Server draft"),
      },
      isError: false,
      isLoading: false,
    });

    const { result } = renderHook(() =>
      useBlueprintDraftController({
        initialBlueprintId: "blueprint-x",
        initialDraftId: "draft_local",
      }),
    );

    await waitFor(() =>
      expect(result.current.blueprintName).toBe("Server draft"),
    );
    expect(result.current.sources).toEqual([]);
    expect(result.current.loadedBlueprintId).toBeNull();
  });
});

describe("mergeHydratedStudioSourcesBySourceId", () => {
  it("replaces restoring source with hydrated local file", () => {
    expect(
      mergeHydratedStudioSourcesBySourceId({
        currentSources: [restoringSource("source_1")],
        hydratedSources: [parsedLocalSource("source_1")],
      })[0]?.backing.kind,
    ).toBe("local_file");
  });

  it("replaces restoring source with hydrated missing file", () => {
    expect(
      mergeHydratedStudioSourcesBySourceId({
        currentSources: [restoringSource("source_1")],
        hydratedSources: [missingSource("missing")],
      })[0]?.backing.kind,
    ).toBe("missing_local_file");
  });

  it("preserves non-restoring sources and source order", () => {
    const savedSource = persistedSource("source_2");
    const merged = mergeHydratedStudioSourcesBySourceId({
      currentSources: [restoringSource("source_1"), savedSource],
      hydratedSources: [parsedLocalSource("source_1")],
    });

    expect(merged.map((source) => source.sourceId)).toEqual([
      "source_1",
      "source_2",
    ]);
    expect(merged[0]?.backing.kind).toBe("local_file");
    expect(merged[1]).toBe(savedSource);
  });

  it("does not re-add a removed source", () => {
    expect(
      mergeHydratedStudioSourcesBySourceId({
        currentSources: [],
        hydratedSources: [parsedLocalSource("source_1")],
      }),
    ).toEqual([]);
  });

  it("does not overwrite a source no longer restoring", () => {
    const currentSource = parsedLocalSource("source_1", "current.xlsx");
    const merged = mergeHydratedStudioSourcesBySourceId({
      currentSources: [currentSource],
      hydratedSources: [parsedLocalSource("source_1", "stale.xlsx")],
    });

    expect(merged[0]).toBe(currentSource);
  });
});

function writeRestoringSnapshot() {
  writeStudioDraftSnapshot(
    createStudioDraftSnapshot({
      authoringModel: createModel(),
      blueprintDescription: "",
      blueprintName: "Draft",
      draftKey: "new:default",
      lastRemoteSaveSnapshotKey: null,
      loadedBlueprintId: null,
      sources: [parsedLocalSource()],
      timestamp: Date.now(),
    }),
  );
}

function parsedLocalSource(
  sourceId = "source_1",
  fileName = "budget.xlsx",
): StudioWorkbookSource {
  const file = new File(["xlsx-bytes"], fileName, {
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
      parsedWorkbook: {
        byteSize: file.size,
        cellsByKey: new Map(),
        fileName: file.name,
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
      parseStatus: "parsed",
      uploadError: null,
      uploadStatus: "not_uploaded",
      workbookId: null,
    },
    createdAt: new Date("2026-06-21T00:00:00.000Z"),
    name: "Budget",
    sourceId,
    type: "workbook",
  };
}

function missingSource(parseError: string): StudioWorkbookSource {
  return {
    backing: {
      byteSize: 10,
      kind: "missing_local_file",
      lastModified: 123,
      originalName: "budget.xlsx",
      parseError,
      workbookId: null,
    },
    createdAt: new Date("2026-06-21T00:00:00.000Z"),
    name: "Budget",
    sourceId: "source_1",
    type: "workbook",
  };
}

function restoringSource(sourceId: string): StudioWorkbookSource {
  return {
    backing: {
      byteSize: 10,
      kind: "restoring_local_file",
      lastModified: 123,
      originalName: "budget.xlsx",
      workbookId: null,
    },
    createdAt: new Date("2026-06-21T00:00:00.000Z"),
    name: "Budget",
    sourceId,
    type: "workbook",
  };
}

function persistedSource(sourceId: string): StudioWorkbookSource {
  return {
    backing: {
      byteSize: null,
      kind: "persisted_workbook",
      originalName: "saved.xlsx",
      parsedWorkbook: null,
      workbookId: "workbook_1",
    },
    createdAt: new Date("2026-06-21T00:00:00.000Z"),
    name: "Saved",
    sourceId,
    type: "workbook",
  };
}

function draftTemplate(
  id: string,
  name: string,
  blueprintId: string | null = null,
): QuestionBlueprintDraftDto {
  return {
    blueprintId,
    createdAt: "2026-06-20T00:00:00.000Z",
    createdByUserId: "owner-1",
    description: null,
    document: {
      blocks: [],
      references: [],
      responseFields: [],
      schemaVersion: 1,
    },
    id,
    lastSavedAt: "2026-06-21T00:00:00.000Z",
    name,
    ownerUserId: "owner-1",
    sources: [],
    status: "draft",
    updatedAt: "2026-06-21T00:00:00.000Z",
  };
}

function createModel(): ComposedEditorModel {
  return {
    blocks: [],
    references: [],
    responseFields: [],
    schemaVersion: 1,
  };
}

type QuestionBlueprintDraftDto = {
  id: string;
  ownerUserId: string;
  createdByUserId: string;
  blueprintId: string | null;
  name: string;
  description: string | null;
  document: {
    schemaVersion: number;
    blocks: unknown[];
    responseFields: unknown[];
    references: unknown[];
  };
  sources: unknown[];
  status: "draft" | "publishing" | "published" | "discarded";
  lastSavedAt: string;
  createdAt: string;
  updatedAt: string;
};

async function settleMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}
