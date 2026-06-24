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
      message: "Select a workbook to preview this range.",
      status: "not_ready",
    };
  }

  if (preview.status !== "resolved") {
    return {
      message: "This range is not ready to preview.",
      status: "not_ready",
    };
  }

  const values = preview.rawValue;
  if (!Array.isArray(values)) {
    return {
      message: "Selected range must be a rectangular 2D array.",
      status: "invalid",
    };
  }

  if (values.length === 0) {
    return { message: "Selected range is empty.", status: "empty" };
  }

  const columnCount = values.reduce(
    (max, row) => (Array.isArray(row) ? Math.max(max, row.length) : max),
    0,
  );
  if (columnCount === 0) {
    return { message: "Selected range is empty.", status: "empty" };
  }

  const rectangular = values.every(
    (row) => Array.isArray(row) && row.length === columnCount,
  );
  if (!rectangular) {
    return {
      message: "Selected range must be a rectangular 2D array.",
      status: "invalid",
    };
  }

  return {
    columnCount,
    displayValue: preview.displayValue,
    rowCount: values.length,
    status: "ready",
  };
}
