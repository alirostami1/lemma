import { describe, expect, it } from "vitest";
import { getStudioSourceViewState } from "./source/source-state";

describe("getStudioSourceViewState", () => {
  it("returns empty state with no selected source", () => {
    expect(
      getStudioSourceViewState({
        sourceRequirement: { status: "not_required", workbookRefs: [] },
        selectedWorkbookId: null,
        selectedWorkbook: null,
        isWorkbooksLoading: false,
        previewStatus: "idle",
        previewError: null,
      }),
    ).toEqual({
      status: "not_required_empty",
      title: "No source attached",
      description:
        "Attach a source inside this blueprint if it needs workbook-backed references.",
      canRemove: false,
    });
  });

  it("returns loading when the selected source record is still loading", () => {
    expect(
      getStudioSourceViewState({
        sourceRequirement: { status: "required", workbookRefs: ["Sheet1!A1"] },
        selectedWorkbookId: "workbook_1",
        selectedWorkbook: null,
        isWorkbooksLoading: true,
        previewStatus: "idle",
        previewError: null,
      }),
    ).toEqual({
      status: "loading",
      title: "Loading source",
      description: "Loading attached source.",
      canRemove: true,
    });
  });

  it("returns error when the selected source cannot be found", () => {
    expect(
      getStudioSourceViewState({
        sourceRequirement: { status: "required", workbookRefs: ["Sheet1!A1"] },
        selectedWorkbookId: "workbook_1",
        selectedWorkbook: null,
        isWorkbooksLoading: false,
        previewStatus: "idle",
        previewError: null,
      }),
    ).toEqual({
      status: "error",
      title: "Source not found",
      description: "Attached source could not be found.",
      issue: "Replace the source or remove it from this blueprint.",
      canRemove: true,
    });
  });

  it("returns targeted error when a version-bound source cannot be found", () => {
    expect(
      getStudioSourceViewState({
        sourceRequirement: { status: "required", workbookRefs: ["Sheet1!A1"] },
        selectedWorkbookId: "workbook_1",
        selectedWorkbook: null,
        isWorkbooksLoading: false,
        previewStatus: "idle",
        previewError: null,
        isVersionBoundSource: true,
      }),
    ).toEqual({
      status: "error",
      title: "Version source not found",
      description: "This blueprint version's saved source could not be found.",
      issue: "Reattach the source and save a new blueprint version.",
      canRemove: true,
    });
  });
});
