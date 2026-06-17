import {
  createWorkbookCalculation as createWorkbookCalculationGenerated,
  createWorkbook as createWorkbookGenerated,
  deleteWorkbook as deleteWorkbookGenerated,
  getWorkbookCalculation as getWorkbookCalculationGenerated,
  getWorkbook as getWorkbookGenerated,
  getWorkbookSnapshot as getWorkbookSnapshotGenerated,
  getWorkbookSnapshotPreview as getWorkbookSnapshotPreviewGenerated,
  listWorkbookCalculations as listWorkbookCalculationsGenerated,
  listWorkbookSnapshots as listWorkbookSnapshotsGenerated,
  listWorkbooks as listWorkbooksGenerated,
  updateWorkbook as updateWorkbookGenerated,
  validateWorkbook as validateWorkbookGenerated,
} from "#/api/generated/workbook/workbook";
import {
  mapWorkbookCalculationResponse,
  mapWorkbookCalculationsResponse,
  mapWorkbookResponse,
  mapWorkbookSnapshotPreviewResponse,
  mapWorkbookSnapshotResponse,
  mapWorkbookSnapshotsResponse,
  mapWorkbooksResponse,
} from "./mappers";
import type {
  CreateWorkbookCalculationInput,
  CreateWorkbookInput,
  DeleteWorkbookInput,
  GetWorkbookSnapshotPreviewInput,
  ListWorkbookCalculationsInput,
  ListWorkbookSnapshotsInput,
  ListWorkbooksInput,
  UpdateWorkbookInput,
  ValidateWorkbookInput,
  Workbook,
  WorkbookCalculation,
  WorkbookCalculationsPage,
  WorkbookSnapshot,
  WorkbookSnapshotPreview,
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

export async function getWorkbookSnapshotPreview({
  workbookSnapshotId,
  ...input
}: GetWorkbookSnapshotPreviewInput): Promise<WorkbookSnapshotPreview> {
  return mapWorkbookSnapshotPreviewResponse(
    await getWorkbookSnapshotPreviewGenerated(workbookSnapshotId, input),
  );
}
