export type WorkbookStatus =
  | "pending_validation"
  | "valid"
  | "invalid"
  | "archived"
  | "deleted";

export type WorkbookEngine = "cached" | "libreoffice";

export type WorkbookUpdateStatus = "archived";

export type WorkbookCalculationStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export interface WorkbookInspection {
  cellCount: number;
  forbiddenFeatureFindings: string[];
  formulaCount: number;
  libreOfficeVersion: string | null;
  sheetCount: number;
}

export interface Workbook {
  checksumSha256: string;
  createdAt: Date;
  createdByUserId: string;
  engine: WorkbookEngine;
  engineVersion: string | null;
  fileId: string;
  id: string;
  inspection: WorkbookInspection | null;
  name: string;
  originalName: string;
  ownerUserId: string;
  status: WorkbookStatus;
  updatedAt: Date;
  validationError: string | null;
}

export interface WorkbookCalculation {
  attemptNumber: number;
  attempts: number;
  correlationId: string | null;
  createdAt: Date;
  createdByUserId: string;
  errorMessage: string | null;
  finishedAt: Date | null;
  id: string;
  ownerUserId: string;
  requestedCount: number;
  retryOfCalculationId: string | null;
  startedAt: Date | null;
  status: WorkbookCalculationStatus;
  updatedAt: Date;
}

export type WorkbookCellType =
  | "string"
  | "number"
  | "boolean"
  | "date_like"
  | "error"
  | "blank"
  | "formula_cached";

export interface WorkbookSnapshot {
  calculationId: string;
  createdAt: Date;
  id: string;
  questionIndex: number;
  snapshotIndex: number;
  sourceId: string;
  workbookId: string;
}

export interface WorkbookSnapshotMetadata {
  cellCount: number;
  sheetCount: number;
  status: "ready";
}

export interface WorkbookSnapshotSheet {
  columnCount: number;
  name: string;
  nonEmptyCellCount: number;
  rowCount: number;
  sheetIndex: number;
}

export interface WorkbookSnapshotCells {
  cellTypes: WorkbookCellType[][];
  columnCount: number;
  rowCount: number;
  rows: string[][];
  sheetIndex: number;
  sheetName: string;
  startColumn: number;
  startRow: number;
}

export interface WorkbookSnapshotRange extends WorkbookSnapshotCells {
  endCellAddress: string;
  ref: string;
  startCellAddress: string;
}

export type WorkbookSnapshotRangeBatchItem =
  | {
      ref: string;
      status: "ok";
      range: WorkbookSnapshotRange;
      errorMessage: null;
    }
  | {
      ref: string;
      status: "error";
      range: null;
      errorMessage: string;
    };

export interface WorkbookSnapshotRangeBatch {
  ranges: WorkbookSnapshotRangeBatchItem[];
}

export interface ListWorkbooksInput {
  cursor?: string;
  limit?: number;
  status?: WorkbookStatus;
}

export interface CreateWorkbookInput {
  fileId: string;
  name: string;
}

export interface UpdateWorkbookInput {
  name?: string;
  status?: WorkbookUpdateStatus;
  workbookId: string;
}

export interface DeleteWorkbookInput {
  workbookId: string;
}

export interface ValidateWorkbookInput {
  workbookId: string;
}

export interface ListWorkbookCalculationsInput {
  cursor?: string;
  limit?: number;
  status?: WorkbookCalculationStatus;
  workbookId: string;
}

export interface CreateWorkbookCalculationInput {
  correlationId?: string | null;
  requestedCount: number;
  workbookId: string;
}

export interface RetryWorkbookCalculationInput {
  workbookCalculationId: string;
}

export interface ListWorkbookSnapshotsInput {
  cursor?: string;
  limit?: number;
  workbookCalculationId: string;
}

export interface ListWorkbookSnapshotSheetsInput {
  cursor?: string;
  limit?: number;
  workbookSnapshotId: string;
}

export interface GetWorkbookSnapshotCellsInput {
  columnCount: number;
  rowCount: number;
  sheetIndex: number;
  startColumn: number;
  startRow: number;
  workbookSnapshotId: string;
}

export interface GetWorkbookSnapshotRangeInput {
  ref: string;
  workbookSnapshotId: string;
}

export interface GetWorkbookSnapshotRangeBatchInput {
  refs: string[];
  workbookSnapshotId: string;
}

export interface WorkbooksPage {
  nextCursor: string | null;
  workbooks: Workbook[];
}

export interface WorkbookCalculationsPage {
  nextCursor: string | null;
  workbookCalculations: WorkbookCalculation[];
}

export interface WorkbookSnapshotsPage {
  nextCursor: string | null;
  workbookSnapshots: WorkbookSnapshot[];
}

export interface WorkbookSnapshotSheetsPage {
  nextCursor: string | null;
  workbookSnapshotSheets: WorkbookSnapshotSheet[];
}
