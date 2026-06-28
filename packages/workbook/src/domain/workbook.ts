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

export type CreateWorkbookFromFileInput = {
  id: WorkbookId;
  ownerUserId: UserId;
  createdByUserId: UserId;
  name: string;
  fileId: FileId;
  checksumSha256: string;
  originalName: string;
  byteSize: number;
  contentType: string;
  engine: WorkbookEngineName;
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
    checksumSha256: input.checksumSha256,
    createdAt: at,
    createdByUserId: input.createdByUserId,
    engine: input.engine,
    engineVersion: null,
    fileId: input.fileId,
    id: input.id,
    inspection: null,
    name: workbookName(input.name),
    originalName: input.originalName,
    ownerUserId: input.ownerUserId,
    status: "pending_validation",
    updatedAt: at,
    validationError: null,
  };
}

export function createWorkbookFromFile(
  input: CreateWorkbookFromFileInput,
  at: Date,
): Workbook {
  assertWorkbookFileMetadata({
    byteSize: input.byteSize,
    contentType: input.contentType,
    originalName: input.originalName,
  });
  assertWorkbookChecksumSha256(input.checksumSha256);
  return createWorkbook(input, at);
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
    engineVersion,
    inspection,
    status: "valid",
    updatedAt: at,
    validationError: null,
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
    updatedAt: at,
    validationError: null,
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
    updatedAt: at,
    validationError,
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

export function assertWorkbookChecksumSha256(value: string): string {
  if (!/^[a-f0-9]{64}$/u.test(value)) {
    throw new InvalidWorkbookFileMetadataError(
      "Workbook checksum must be lowercase SHA-256.",
    );
  }
  return value;
}
