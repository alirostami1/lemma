import {
  formatSpreadsheetRange,
  type SpreadsheetCellRange,
} from "@lemma/ui/components/spreadsheet";
import type {
  WorkbookDimensionBounds,
  WorkbookRangeSelection,
  WorkbookSelectionRequirement,
} from "#/features/questions/table-block-editor";

export type WorkbookSelectionValidationResult =
  | { ok: true }
  | { ok: false; message: string };

export function buildWorkbookRangeSelection(
  sheetName: string,
  rows: string[][],
  range: SpreadsheetCellRange,
): WorkbookRangeSelection {
  const values: string[][] = [];

  for (
    let rowIndex = range.startRowIndex;
    rowIndex <= range.endRowIndex;
    rowIndex++
  ) {
    const row: string[] = [];
    for (
      let columnIndex = range.startColumnIndex;
      columnIndex <= range.endColumnIndex;
      columnIndex++
    ) {
      row.push(rows[rowIndex]?.[columnIndex] ?? "");
    }
    values.push(row);
  }

  return {
    reference: formatSpreadsheetRange(sheetName, range),
    values,
  };
}

export function formatWorkbookRangeDisplayValue(values: string[][]) {
  const rowCount = values.length;
  const columnCount = values[0]?.length ?? 0;
  const sampleRows = values
    .slice(0, 2)
    .map((row) => row.slice(0, 2).join(" | "));
  const sample = sampleRows.join(" / ");
  const extraRows = rowCount > 2 ? " ..." : "";
  const extraColumns = columnCount > 2 ? " ..." : "";

  return `${rowCount} row${rowCount === 1 ? "" : "s"} x ${columnCount} column${columnCount === 1 ? "" : "s"}${sample ? ` · ${sample}${extraRows || extraColumns}` : ""}`;
}

export function validateWorkbookRangeSelection(
  selection: WorkbookRangeSelection,
  requirement: WorkbookSelectionRequirement = {},
): WorkbookSelectionValidationResult {
  const rowCount = selection.values.length;
  const columnCount = selection.values[0]?.length ?? 0;
  const selectionType = requirement.selectionType ?? "any";
  const messages: string[] = [];

  if (selectionType === "cell" && (rowCount !== 1 || columnCount !== 1)) {
    messages.push("Select exactly one cell.");
  }

  if (selectionType === "range" && rowCount * columnCount <= 1) {
    messages.push("Select more than one cell.");
  }

  addDimensionMessages(messages, "row", rowCount, requirement.rows);
  addDimensionMessages(messages, "column", columnCount, requirement.columns);

  if (messages.length === 0) {
    return { ok: true };
  }

  return {
    ok: false,
    message: `${messages.join(" ")} Current selection is ${formatDimensionCount(
      rowCount,
      "row",
    )} by ${formatDimensionCount(columnCount, "column")}.`,
  };
}

function addDimensionMessages(
  messages: string[],
  label: "row" | "column",
  count: number,
  bounds?: WorkbookDimensionBounds,
) {
  if (bounds?.min !== undefined && count < bounds.min) {
    messages.push(
      `Select at least ${formatDimensionCount(bounds.min, label)}.`,
    );
  }
  if (bounds?.max !== undefined && count > bounds.max) {
    messages.push(`Select at most ${formatDimensionCount(bounds.max, label)}.`);
  }
}

export function describeWorkbookSelectionRequirement(
  requirement: WorkbookSelectionRequirement,
) {
  const selectionType = requirement.selectionType ?? "any";
  const parts: string[] = [];

  if (selectionType === "cell") {
    parts.push("single cell");
  } else if (selectionType === "range") {
    parts.push("range");
  } else {
    parts.push("cell or range");
  }

  const rowDescription = describeDimensionBounds("row", requirement.rows);
  const columnDescription = describeDimensionBounds(
    "column",
    requirement.columns,
  );

  if (rowDescription) {
    parts.push(rowDescription);
  }
  if (columnDescription) {
    parts.push(columnDescription);
  }

  return parts.join(", ");
}

function describeDimensionBounds(
  label: "row" | "column",
  bounds?: WorkbookDimensionBounds,
) {
  if (!bounds) {
    return "";
  }
  if (bounds.min !== undefined && bounds.max !== undefined) {
    if (bounds.min === bounds.max) {
      return `exactly ${formatDimensionCount(bounds.min, label)}`;
    }
    return `${formatDimensionCount(bounds.min, label)} to ${formatDimensionCount(
      bounds.max,
      label,
    )}`;
  }
  if (bounds.min !== undefined) {
    return `at least ${formatDimensionCount(bounds.min, label)}`;
  }
  if (bounds.max !== undefined) {
    return `at most ${formatDimensionCount(bounds.max, label)}`;
  }
  return "";
}

function formatDimensionCount(count: number, label: "row" | "column") {
  return `${count} ${label}${count === 1 ? "" : "s"}`;
}
