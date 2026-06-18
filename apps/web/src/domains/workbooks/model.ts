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
  sheetCount: number;
  cellCount: number;
  formulaCount: number;
  forbiddenFeatureFindings: string[];
  libreOfficeVersion: string | null;
}

export interface Workbook {
  id: string;
  ownerUserId: string;
  createdByUserId: string;
  name: string;
  fileId: string;
  checksumSha256: string;
  originalName: string;
  engine: WorkbookEngine;
  engineVersion: string | null;
  status: WorkbookStatus;
  inspection: WorkbookInspection | null;
  validationError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkbookCalculation {
  id: string;
  ownerUserId: string;
  createdByUserId: string;
  workbookId: string;
  requestedCount: number;
  status: WorkbookCalculationStatus;
  correlationId: string | null;
  errorMessage: string | null;
  attempts: number;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
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
  id: string;
  workbookId: string;
  calculationId: string;
  snapshotIndex: number;
  createdAt: Date;
}

export interface WorkbookSnapshotMetadata {
  status: "ready";
  sheetCount: number;
  cellCount: number;
}

export interface WorkbookSnapshotSheet {
  sheetIndex: number;
  name: string;
  rowCount: number;
  columnCount: number;
  nonEmptyCellCount: number;
}

export interface WorkbookSnapshotCells {
  sheetIndex: number;
  sheetName: string;
  startRow: number;
  startColumn: number;
  rowCount: number;
  columnCount: number;
  rows: string[][];
  cellTypes: WorkbookCellType[][];
}

export interface WorkbookSnapshotRange extends WorkbookSnapshotCells {
  ref: string;
  startCellAddress: string;
  endCellAddress: string;
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
  limit?: number;
  cursor?: string;
  status?: WorkbookStatus;
}

export interface CreateWorkbookInput {
  name: string;
  fileId: string;
}

export interface UpdateWorkbookInput {
  workbookId: string;
  name?: string;
  status?: WorkbookUpdateStatus;
}

export interface DeleteWorkbookInput {
  workbookId: string;
}

export interface ValidateWorkbookInput {
  workbookId: string;
}

export interface ListWorkbookCalculationsInput {
  workbookId: string;
  limit?: number;
  cursor?: string;
  status?: WorkbookCalculationStatus;
}

export interface CreateWorkbookCalculationInput {
  workbookId: string;
  requestedCount: number;
  correlationId?: string | null;
}

export interface ListWorkbookSnapshotsInput {
  workbookCalculationId: string;
  limit?: number;
  cursor?: string;
}

export interface ListWorkbookSnapshotSheetsInput {
  workbookSnapshotId: string;
  limit?: number;
  cursor?: string;
}

export interface GetWorkbookSnapshotCellsInput {
  workbookSnapshotId: string;
  sheetIndex: number;
  startRow: number;
  startColumn: number;
  rowCount: number;
  columnCount: number;
}

export interface GetWorkbookSnapshotRangeInput {
  workbookSnapshotId: string;
  ref: string;
}

export interface GetWorkbookSnapshotRangeBatchInput {
  workbookSnapshotId: string;
  refs: string[];
}

export interface WorkbooksPage {
  workbooks: Workbook[];
  nextCursor: string | null;
}

export interface WorkbookCalculationsPage {
  workbookCalculations: WorkbookCalculation[];
  nextCursor: string | null;
}

export interface WorkbookSnapshotsPage {
  workbookSnapshots: WorkbookSnapshot[];
  nextCursor: string | null;
}

export interface WorkbookSnapshotSheetsPage {
  workbookSnapshotSheets: WorkbookSnapshotSheet[];
  nextCursor: string | null;
}
