import type { WorkbookPreviewSheet } from "./workbook-reference";

export type WorkbookPreview = {
  fileName: string;
  sheets: Array<WorkbookPreviewSheet & { columnCount?: number }>;
};
