import { describe, expect, it } from "vitest";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import { getTableRangePreviewViewModel } from "./table-range-preview-view-model";

describe("getTableRangePreviewViewModel", () => {
  it("requires a preview before the range can be applied", () => {
    expect(getTableRangePreviewViewModel(null)).toEqual({
      message: "Select a workbook to preview this range.",
      status: "not_ready",
    });
  });

  it("rejects unresolved previews", () => {
    expect(getTableRangePreviewViewModel(errorPreview())).toEqual({
      message: "This range is not ready to preview.",
      status: "not_ready",
    });
  });

  it("rejects non-rectangular values", () => {
    expect(
      getTableRangePreviewViewModel(resolvedPreview([[1], [1, 2]])),
    ).toEqual({
      message: "Selected range must be a rectangular 2D array.",
      status: "invalid",
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
      columnCount: 2,
      displayValue: "preview",
      rowCount: 2,
      status: "ready",
    });
  });
});

function resolvedPreview(rawValue: unknown): ReferencePreviewCache[string] {
  return {
    displayValue: "preview",
    rawValue,
    referenceId: "reference_1",
    status: "resolved",
    updatedAt: 1,
  };
}

function errorPreview(): ReferencePreviewCache[string] {
  return {
    displayValue: "not ready",
    referenceId: "reference_1",
    status: "error",
    updatedAt: 1,
  };
}
