import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";

export type TableRangePreviewViewModel =
  | {
      status: "empty" | "invalid" | "not_ready";
      message: string;
    }
  | {
      status: "ready";
      rowCount: number;
      columnCount: number;
      displayValue: string;
    };

export function getTableRangePreviewViewModel(
  preview: ReferencePreviewCache[string] | null,
): TableRangePreviewViewModel {
  if (!preview) {
    return {
      status: "not_ready",
      message: "Select a workbook to preview this range.",
    };
  }

  if (preview.status !== "resolved") {
    return {
      status: "not_ready",
      message: "This range is not ready to preview.",
    };
  }

  const values = preview.rawValue;
  if (!Array.isArray(values)) {
    return {
      status: "invalid",
      message: "Selected range must be a rectangular 2D array.",
    };
  }

  if (values.length === 0) {
    return { status: "empty", message: "Selected range is empty." };
  }

  const columnCount = values.reduce(
    (max, row) => (Array.isArray(row) ? Math.max(max, row.length) : max),
    0,
  );
  if (columnCount === 0) {
    return { status: "empty", message: "Selected range is empty." };
  }

  const rectangular = values.every(
    (row) => Array.isArray(row) && row.length === columnCount,
  );
  if (!rectangular) {
    return {
      status: "invalid",
      message: "Selected range must be a rectangular 2D array.",
    };
  }

  return {
    status: "ready",
    rowCount: values.length,
    columnCount,
    displayValue: preview.displayValue,
  };
}
