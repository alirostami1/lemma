import type { OperationLineage } from "@lemma/domain";
import type { CurrentUser } from "@lemma/identity/application";

export type ListCommand = {
  currentUser: CurrentUser;
  limit?: number;
  cursor?: string;
};

export type CreateWorkbookCommand = ListCommand & {
  name: string;
  fileId: string;
  lineage: OperationLineage;
};

export type WorkbookByIdCommand = ListCommand & {
  workbookId: string;
};

export type UpdateWorkbookCommand = WorkbookByIdCommand & {
  patch: { name?: string; status?: string };
};

export type ValidateWorkbookCommand = {
  currentUser: CurrentUser;
  workbookId: string;
  lineage: OperationLineage;
};

export type ListWorkbookCalculationsCommand = ListCommand & {
  workbookId?: string;
  status?: string;
};

export type CreateWorkbookCalculationCommand = WorkbookByIdCommand & {
  requestedCount: number;
  correlationId?: string | null;
  lineage: OperationLineage;
};

export type WorkbookCalculationByIdCommand = ListCommand & {
  workbookCalculationId: string;
};

export type RetryWorkbookCalculationCommand = WorkbookCalculationByIdCommand & {
  lineage: OperationLineage;
};

export type ProcessWorkbookCalculationCommand = {
  workbookCalculationId: string;
  lineage: OperationLineage;
};

export type ListWorkbookSnapshotsCommand = ListCommand & {
  workbookCalculationId: string;
};

export type WorkbookSnapshotByIdCommand = ListCommand & {
  workbookSnapshotId: string;
};

export type WorkbookSnapshotMetadataCommand = WorkbookSnapshotByIdCommand;

export type ListWorkbookSnapshotSheetsCommand = WorkbookSnapshotByIdCommand & {
  limit?: number;
  cursor?: string;
};

export type WorkbookSnapshotCellsCommand = WorkbookSnapshotByIdCommand & {
  sheetIndex: number;
  startRow: number;
  startColumn: number;
  rowCount: number;
  columnCount: number;
};

export type WorkbookSnapshotRangeCommand = WorkbookSnapshotByIdCommand & {
  ref: string;
};

export type WorkbookSnapshotRangeBatchCommand = WorkbookSnapshotByIdCommand & {
  refs: string[];
};

export type ResolveWorkbookSnapshotValueCommand =
  WorkbookSnapshotByIdCommand & {
    source:
      | { type: "cell"; ref: string }
      | { type: "range"; ref: string }
      | { type: "literal"; value: unknown };
  };
