import {
  InvalidWorkbookFileMetadataError,
  InvalidWorkbookStateTransitionError,
} from "./errors.js";
import type { FileId, UserId, WorkbookId } from "./ids.js";
import {
  WORKBOOK_XLSX_CONTENT_TYPE,
  type WorkbookEngineName,
  type WorkbookInspection,
  type WorkbookName,
  type WorkbookStatus,
  workbookName,
} from "./workbook-values.js";

export type Workbook = {
  id: WorkbookId;
  ownerUserId: UserId;
  createdByUserId: UserId;
  name: WorkbookName;
  fileId: FileId;
  checksumSha256: string;
  originalName: string;
  engine: WorkbookEngineName;
  engineVersion: string | null;
  status: WorkbookStatus;
  inspection: WorkbookInspection | null;
  validationError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function createWorkbook(
  input: {
    id: WorkbookId;
    ownerUserId: UserId;
    createdByUserId: UserId;
    name: string;
    fileId: FileId;
    checksumSha256: string;
    originalName: string;
    engine: WorkbookEngineName;
  },
  at: Date,
): Workbook {
  return {
    id: input.id,
    ownerUserId: input.ownerUserId,
    createdByUserId: input.createdByUserId,
    name: workbookName(input.name),
    fileId: input.fileId,
    checksumSha256: input.checksumSha256,
    originalName: input.originalName,
    engine: input.engine,
    engineVersion: null,
    status: "pending_validation",
    inspection: null,
    validationError: null,
    createdAt: at,
    updatedAt: at,
  };
}

export function updateWorkbook(
  workbook: Workbook,
  patch: { name?: string; status?: WorkbookStatus },
  at: Date,
): Workbook {
  assertWorkbookCanBeModified(workbook);
  if (patch.status === "deleted") {
    throw new InvalidWorkbookStateTransitionError(
      "Use deleteWorkbook to delete workbook.",
    );
  }
  return {
    ...workbook,
    name: patch.name !== undefined ? workbookName(patch.name) : workbook.name,
    status: patch.status ?? workbook.status,
    updatedAt: at,
  };
}

export function markWorkbookValid(
  workbook: Workbook,
  inspection: WorkbookInspection,
  engineVersion: string | null,
  at: Date,
): Workbook {
  assertWorkbookCanBeModified(workbook);
  return {
    ...workbook,
    inspection,
    engineVersion,
    status: "valid",
    validationError: null,
    updatedAt: at,
  };
}

export function requestWorkbookValidation(
  workbook: Workbook,
  at: Date,
): Workbook {
  assertWorkbookCanBeModified(workbook);
  return {
    ...workbook,
    status: "pending_validation",
    validationError: null,
    updatedAt: at,
  };
}

export function markWorkbookInvalid(
  workbook: Workbook,
  validationError: string,
  inspection: WorkbookInspection | null,
  at: Date,
): Workbook {
  assertWorkbookCanBeModified(workbook);
  return {
    ...workbook,
    inspection,
    status: "invalid",
    validationError,
    updatedAt: at,
  };
}

export function archiveWorkbook(workbook: Workbook, at: Date): Workbook {
  assertWorkbookCanBeModified(workbook);
  return { ...workbook, status: "archived", updatedAt: at };
}

export function deleteWorkbook(workbook: Workbook, at: Date): Workbook {
  if (workbook.status === "deleted") {
    return workbook;
  }
  return { ...workbook, status: "deleted", updatedAt: at };
}

export function assertWorkbookIsUsable(workbook: Workbook): void {
  if (workbook.status !== "valid") {
    throw new InvalidWorkbookStateTransitionError(
      "Only valid workbooks can be calculated.",
    );
  }
}

function assertWorkbookCanBeModified(workbook: Workbook): void {
  if (workbook.status === "deleted") {
    throw new InvalidWorkbookStateTransitionError(
      "Deleted workbooks cannot be modified.",
    );
  }
}

export function assertWorkbookFileMetadata(input: {
  contentType: string;
  originalName: string;
  byteSize: number;
}): void {
  if (input.byteSize <= 0) {
    throw new InvalidWorkbookFileMetadataError(
      "Workbook file must not be empty.",
    );
  }
  if (
    input.contentType !== WORKBOOK_XLSX_CONTENT_TYPE ||
    !input.originalName.toLowerCase().endsWith(".xlsx")
  ) {
    throw new InvalidWorkbookFileMetadataError(
      "Workbook file must be a .xlsx file.",
    );
  }
}
