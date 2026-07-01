import { describe, expect, it } from "vitest";
import {
  createDefaultTableEditorModel,
  type SelectedTableCoordinateSummary,
} from "#/domains/questions/authoring";
import { describeTableSelectionFromSummary } from "./table-selection";
import { getTableSelectionActionState } from "./table-selection-actions";

const selectedSummary: SelectedTableCoordinateSummary = {
  coordinateKeys: new Set(["row_1:column_1"]),
  coordinates: [{ columnId: "column_1", rowId: "row_1" }],
  count: 1,
  hasRangeBackedReferences: true,
};

describe("table selection action state", () => {
  it("disables shared actions when no valid coordinate is selected", () => {
    const state = getTableSelectionActionState({
      model: createDefaultTableEditorModel(),
      selection: { rowId: "missing_row", type: "row" },
    });

    expect(state).toEqual({
      actionDisabled: true,
      hasRangeBackedReferences: false,
      hasSelectedCells: false,
    });
  });

  it("uses the precomputed selected coordinate summary", () => {
    const state = getTableSelectionActionState({
      model: createDefaultTableEditorModel(),
      selectedCoordinateSummary: selectedSummary,
      selection: { type: "table" },
    });

    expect(state).toEqual({
      actionDisabled: false,
      hasRangeBackedReferences: true,
      hasSelectedCells: true,
    });
  });

  it("describes toolbar selections from a precomputed summary", () => {
    expect(
      describeTableSelectionFromSummary(
        {
          activeCell: { columnId: "column_10", rowId: "row_10" },
          ranges: [
            {
              end: { columnId: "column_100", rowId: "row_100" },
              start: { columnId: "column_1", rowId: "row_1" },
            },
          ],
          type: "cells",
        },
        { count: 10_000 },
      ),
    ).toBe("10000 selected cells");
  });
});
