import { describe, expect, it } from "vitest";
import { getStudioSourceViewState } from "./source/source-state";

describe("getStudioSourceViewState", () => {
  it("returns empty state with no sources", () => {
    expect(
      getStudioSourceViewState({
        sources: [],
        previewSourceId: null,
        previewSourceWorkbook: null,
        isPreviewSourceLoading: false,
        previewStatus: "idle",
        previewError: null,
        sourceUsageCounts: {},
      }),
    ).toEqual({
      status: "empty",
      title: "No sources attached",
      description: "Attach a source to this blueprint.",
      previewSourceId: null,
      sources: [],
    });
  });

  it("returns loading when the preview source record is still loading", () => {
    expect(
      getStudioSourceViewState({
        sources: [
          {
            sourceId: "source_1",
            name: "Source 1",
            workbookId: "workbook_1",
          },
        ],
        previewSourceId: "source_1",
        previewSourceWorkbook: null,
        isPreviewSourceLoading: true,
        previewStatus: "idle",
        previewError: null,
        sourceUsageCounts: {},
      }),
    ).toEqual({
      status: "loading",
      title: "Source 1",
      description: "Loading attached source.",
      previewSourceId: "source_1",
      sources: [
        expect.objectContaining({
          sourceId: "source_1",
          name: "Source 1",
          workbookId: "workbook_1",
          isPreview: true,
          canRemove: true,
        }),
      ],
    });
  });

  it("returns ready for a local source without workbook data", () => {
    expect(
      getStudioSourceViewState({
        sources: [
          {
            sourceId: "source_1",
            name: "Source 1",
            workbookId: "local:source_1",
          },
        ],
        previewSourceId: "source_1",
        previewSourceWorkbook: null,
        isPreviewSourceLoading: false,
        previewStatus: "idle",
        previewError: null,
        sourceUsageCounts: {},
      }),
    ).toEqual({
      status: "ready",
      title: "Source 1",
      description: "Local source.",
      previewSourceId: "source_1",
      sources: [
        expect.objectContaining({
          sourceId: "source_1",
          name: "Source 1",
          workbookId: "local:source_1",
          isPreview: true,
          canRemove: true,
        }),
      ],
    });
  });

  it("returns error when the preview source cannot be found", () => {
    expect(
      getStudioSourceViewState({
        sources: [
          {
            sourceId: "source_1",
            name: "Source 1",
            workbookId: "workbook_1",
          },
        ],
        previewSourceId: "source_1",
        previewSourceWorkbook: null,
        isPreviewSourceLoading: false,
        previewStatus: "idle",
        previewError: null,
        sourceUsageCounts: {},
      }),
    ).toEqual({
      status: "error",
      title: "Source 1",
      description: "Attached source could not be found.",
      issue: "Replace the source or remove it from this blueprint.",
      previewSourceId: "source_1",
      sources: [
        expect.objectContaining({
          sourceId: "source_1",
          name: "Source 1",
          workbookId: "workbook_1",
          isPreview: true,
          canRemove: true,
        }),
      ],
    });
  });

  it("returns blocked removal signal when a source is in use", () => {
    expect(
      getStudioSourceViewState({
        sources: [
          {
            sourceId: "source_1",
            name: "Source 1",
            workbookId: "workbook_1",
          },
        ],
        previewSourceId: "source_1",
        previewSourceWorkbook: {
          id: "workbook_1",
          ownerUserId: "user_1",
          createdByUserId: "user_1",
          name: "Workbook 1",
          originalName: "Workbook 1.xlsx",
          fileId: "file_1",
          checksumSha256: "",
          engine: "cached",
          engineVersion: null,
          status: "valid",
          inspection: null,
          validationError: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        isPreviewSourceLoading: false,
        previewStatus: "idle",
        previewError: null,
        sourceUsageCounts: { source_1: 2 },
      }),
    ).toEqual({
      status: "ready",
      title: "Source 1",
      description: "Ready source.",
      previewSourceId: "source_1",
      sources: [
        expect.objectContaining({
          sourceId: "source_1",
          name: "Source 1",
          workbookId: "workbook_1",
          isPreview: true,
          canRemove: false,
          removeIssue: "Used by 2 references.",
        }),
      ],
    });
  });
});
