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

export interface WorkbookSparseValues {
  sheets: WorkbookSparseValuesSheet[];
}

export interface WorkbookSparseValuesSheet {
  name: string;
  cells: Record<string, string>;
  rowCount: number;
  columnCount: number;
}

export interface WorkbookSnapshot {
  id: string;
  workbookId: string;
  calculationId: string;
  snapshotIndex: number;
  values: WorkbookSparseValues;
  createdAt: Date;
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
