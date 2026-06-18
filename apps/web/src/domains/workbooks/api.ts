import {
  createWorkbookCalculation as createWorkbookCalculationGenerated,
  createWorkbook as createWorkbookGenerated,
  deleteWorkbook as deleteWorkbookGenerated,
  getWorkbookCalculation as getWorkbookCalculationGenerated,
  getWorkbook as getWorkbookGenerated,
  getWorkbookSnapshotCells as getWorkbookSnapshotCellsGenerated,
  getWorkbookSnapshot as getWorkbookSnapshotGenerated,
  getWorkbookSnapshotMetadata as getWorkbookSnapshotMetadataGenerated,
  getWorkbookSnapshotRange as getWorkbookSnapshotRangeGenerated,
  listWorkbookCalculations as listWorkbookCalculationsGenerated,
  listWorkbookSnapshotSheets as listWorkbookSnapshotSheetsGenerated,
  listWorkbookSnapshots as listWorkbookSnapshotsGenerated,
  listWorkbooks as listWorkbooksGenerated,
  updateWorkbook as updateWorkbookGenerated,
  validateWorkbook as validateWorkbookGenerated,
} from "#/api/generated/workbook/workbook";
import {
  mapWorkbookCalculationResponse,
  mapWorkbookCalculationsResponse,
  mapWorkbookResponse,
  mapWorkbookSnapshotCellsResponse,
  mapWorkbookSnapshotMetadataResponse,
  mapWorkbookSnapshotRangeResponse,
  mapWorkbookSnapshotResponse,
  mapWorkbookSnapshotSheetsResponse,
  mapWorkbookSnapshotsResponse,
  mapWorkbooksResponse,
} from "./mappers";
import type {
  CreateWorkbookCalculationInput,
  CreateWorkbookInput,
  DeleteWorkbookInput,
  GetWorkbookSnapshotCellsInput,
  GetWorkbookSnapshotRangeInput,
  ListWorkbookCalculationsInput,
  ListWorkbookSnapshotSheetsInput,
  ListWorkbookSnapshotsInput,
  ListWorkbooksInput,
  UpdateWorkbookInput,
  ValidateWorkbookInput,
  Workbook,
  WorkbookCalculation,
  WorkbookCalculationsPage,
  WorkbookSnapshot,
  WorkbookSnapshotCells,
  WorkbookSnapshotMetadata,
  WorkbookSnapshotRange,
  WorkbookSnapshotSheetsPage,
  WorkbookSnapshotsPage,
  WorkbooksPage,
} from "./model";

export async function listWorkbooks(
  input?: ListWorkbooksInput,
): Promise<WorkbooksPage> {
  return mapWorkbooksResponse(await listWorkbooksGenerated(input));
}

export async function getWorkbook(workbookId: string): Promise<Workbook> {
  return mapWorkbookResponse(await getWorkbookGenerated(workbookId));
}

export async function createWorkbook(
  input: CreateWorkbookInput,
): Promise<Workbook> {
  return mapWorkbookResponse(await createWorkbookGenerated(input));
}

export async function updateWorkbook({
  workbookId,
  ...input
}: UpdateWorkbookInput): Promise<Workbook> {
  return mapWorkbookResponse(await updateWorkbookGenerated(workbookId, input));
}

export async function deleteWorkbook({
  workbookId,
}: DeleteWorkbookInput): Promise<void> {
  await deleteWorkbookGenerated(workbookId);
}

export async function validateWorkbook({
  workbookId,
}: ValidateWorkbookInput): Promise<Workbook> {
  return mapWorkbookResponse(await validateWorkbookGenerated(workbookId));
}

export async function listWorkbookCalculations({
  workbookId,
  ...input
}: ListWorkbookCalculationsInput): Promise<WorkbookCalculationsPage> {
  return mapWorkbookCalculationsResponse(
    await listWorkbookCalculationsGenerated(workbookId, input),
  );
}

export async function createWorkbookCalculation({
  workbookId,
  ...input
}: CreateWorkbookCalculationInput): Promise<WorkbookCalculation> {
  return mapWorkbookCalculationResponse(
    await createWorkbookCalculationGenerated(workbookId, input),
  );
}

export async function getWorkbookCalculation(
  workbookCalculationId: string,
): Promise<WorkbookCalculation> {
  return mapWorkbookCalculationResponse(
    await getWorkbookCalculationGenerated(workbookCalculationId),
  );
}

export async function listWorkbookSnapshots({
  workbookCalculationId,
  ...input
}: ListWorkbookSnapshotsInput): Promise<WorkbookSnapshotsPage> {
  return mapWorkbookSnapshotsResponse(
    await listWorkbookSnapshotsGenerated(workbookCalculationId, input),
  );
}

export async function getWorkbookSnapshot(
  workbookSnapshotId: string,
): Promise<WorkbookSnapshot> {
  return mapWorkbookSnapshotResponse(
    await getWorkbookSnapshotGenerated(workbookSnapshotId),
  );
}

export async function getWorkbookSnapshotMetadata(
  workbookSnapshotId: string,
): Promise<WorkbookSnapshotMetadata> {
  return mapWorkbookSnapshotMetadataResponse(
    await getWorkbookSnapshotMetadataGenerated(workbookSnapshotId),
  );
}

export async function listWorkbookSnapshotSheets({
  workbookSnapshotId,
  ...input
}: ListWorkbookSnapshotSheetsInput): Promise<WorkbookSnapshotSheetsPage> {
  return mapWorkbookSnapshotSheetsResponse(
    await listWorkbookSnapshotSheetsGenerated(workbookSnapshotId, input),
  );
}

export async function getWorkbookSnapshotCells({
  workbookSnapshotId,
  sheetIndex,
  ...input
}: GetWorkbookSnapshotCellsInput): Promise<WorkbookSnapshotCells> {
  return mapWorkbookSnapshotCellsResponse(
    await getWorkbookSnapshotCellsGenerated(
      workbookSnapshotId,
      String(sheetIndex),
      input,
    ),
  );
}

export async function getWorkbookSnapshotRange({
  workbookSnapshotId,
  ...input
}: GetWorkbookSnapshotRangeInput): Promise<WorkbookSnapshotRange> {
  return mapWorkbookSnapshotRangeResponse(
    await getWorkbookSnapshotRangeGenerated(workbookSnapshotId, input),
  );
}
