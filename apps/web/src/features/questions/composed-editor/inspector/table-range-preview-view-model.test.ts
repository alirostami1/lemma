import { describe, expect, it } from "vitest";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import { getTableRangePreviewViewModel } from "./table-range-preview-view-model";

describe("getTableRangePreviewViewModel", () => {
  it("requires a preview before the range can be applied", () => {
    expect(getTableRangePreviewViewModel(null)).toEqual({
      status: "not_ready",
      message: "Select a workbook to preview this range.",
    });
  });

  it("rejects unresolved previews", () => {
    expect(getTableRangePreviewViewModel(errorPreview())).toEqual({
      status: "not_ready",
      message: "This range is not ready to preview.",
    });
  });

  it("rejects non-rectangular values", () => {
    expect(
      getTableRangePreviewViewModel(resolvedPreview([[1], [1, 2]])),
    ).toEqual({
      status: "invalid",
      message: "Selected range must be a rectangular 2D array.",
    });
  });

  it("returns dimensions for valid rectangular ranges", () => {
    expect(
      getTableRangePreviewViewModel(
        resolvedPreview([
          [1, 2],
          [3, 4],
        ]),
      ),
    ).toEqual({
      status: "ready",
      rowCount: 2,
      columnCount: 2,
      displayValue: "preview",
    });
  });
});

function resolvedPreview(rawValue: unknown): ReferencePreviewCache[string] {
  return {
    referenceId: "reference_1",
    status: "resolved",
    displayValue: "preview",
    rawValue,
    updatedAt: 1,
  };
}

function errorPreview(): ReferencePreviewCache[string] {
  return {
    referenceId: "reference_1",
    status: "error",
    displayValue: "not ready",
    updatedAt: 1,
  };
}
