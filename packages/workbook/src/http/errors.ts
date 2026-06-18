import {
  createHttpErrorHandler,
  DomainError,
  type ErrorMapper,
} from "@lemma/error";
import { jsonHttpError } from "@lemma/http";
import {
  type ForbiddenWorkbookActionError,
  WorkbookApplicationError,
  type WorkbookCalculationNotFoundError,
  type WorkbookEngineFailureError,
  type WorkbookFileNotFoundError,
  type WorkbookFileProviderFailureError,
  type WorkbookFileUnavailableError,
  type WorkbookNotFoundError,
  type WorkbookRepositoryFailureError,
  type WorkbookSnapshotNotFoundError,
} from "../application/errors.js";
import {
  InvalidWorkbookFieldError,
  InvalidWorkbookFileMetadataError,
  InvalidWorkbookInspectionError,
  InvalidWorkbookSnapshotDataError,
  InvalidWorkbookSnapshotReferenceError,
  InvalidWorkbookSparseValuesError,
  InvalidWorkbookStateTransitionError,
} from "../domain/index.js";
import type { WorkbookContext } from "./env.js";

type WorkbookApplicationErrorType =
  | ForbiddenWorkbookActionError
  | WorkbookCalculationNotFoundError
  | WorkbookEngineFailureError
  | WorkbookFileNotFoundError
  | WorkbookFileProviderFailureError
  | WorkbookFileUnavailableError
  | WorkbookNotFoundError
  | WorkbookRepositoryFailureError
  | WorkbookSnapshotNotFoundError;

type WorkbookDomainError =
  | InvalidWorkbookFieldError
  | InvalidWorkbookFileMetadataError
  | InvalidWorkbookInspectionError
  | InvalidWorkbookSnapshotDataError
  | InvalidWorkbookSnapshotReferenceError
  | InvalidWorkbookSparseValuesError
  | InvalidWorkbookStateTransitionError;

const applicationErrorMapper = {
  FORBIDDEN_WORKBOOK_ACTION: { code: "FORBIDDEN_WORKBOOK_ACTION", status: 403 },
  WORKBOOK_CALCULATION_NOT_FOUND: {
    code: "WORKBOOK_CALCULATION_NOT_FOUND",
    status: 404,
  },
  WORKBOOK_ENGINE_FAILURE: { code: "WORKBOOK_ENGINE_FAILURE", status: 502 },
  WORKBOOK_FILE_PROVIDER_FAILURE: {
    code: "WORKBOOK_FILE_PROVIDER_FAILURE",
    status: 502,
  },
  WORKBOOK_FILE_NOT_FOUND: { code: "WORKBOOK_FILE_NOT_FOUND", status: 404 },
  WORKBOOK_FILE_UNAVAILABLE: { code: "WORKBOOK_FILE_UNAVAILABLE", status: 502 },
  WORKBOOK_NOT_FOUND: { code: "WORKBOOK_NOT_FOUND", status: 404 },
  WORKBOOK_REPOSITORY_FAILURE: {
    code: "WORKBOOK_REPOSITORY_FAILURE",
    status: 502,
  },
  WORKBOOK_SNAPSHOT_NOT_FOUND: {
    code: "WORKBOOK_SNAPSHOT_NOT_FOUND",
    status: 404,
  },
} as const;

const domainErrorMapper = {
  INVALID_WORKBOOK_FIELD: { code: "BAD_REQUEST", status: 400 },
  INVALID_WORKBOOK_FILE_METADATA: { code: "BAD_REQUEST", status: 400 },
  INVALID_WORKBOOK_INSPECTION: { code: "BAD_REQUEST", status: 400 },
  INVALID_WORKBOOK_SNAPSHOT_DATA: { code: "BAD_REQUEST", status: 400 },
  INVALID_WORKBOOK_SNAPSHOT_REFERENCE: { code: "BAD_REQUEST", status: 400 },
  INVALID_WORKBOOK_SPARSE_VALUES: { code: "BAD_REQUEST", status: 400 },
  INVALID_WORKBOOK_STATE_TRANSITION: {
    code: "WORKBOOK_STATE_CONFLICT",
    status: 409,
  },
} as const satisfies ErrorMapper<WorkbookDomainError>;

const workbookDomainHttpError = createHttpErrorHandler(domainErrorMapper);

export function handleWorkbookError(
  c: WorkbookContext,
  error: unknown,
): Response {
  if (isWorkbookDomainError(error)) {
    const httpError = workbookDomainHttpError(error, c.get("requestId"));
    return jsonHttpError(c, httpError.body.error, httpError.status);
  }
  if (isWorkbookApplicationError(error)) {
    const mapped = applicationErrorMapper[error.applicationCode];
    return jsonHttpError(
      c,
      {
        code: mapped.code,
        message: error.message,
        requestId: c.get("requestId"),
        details: error.details,
      },
      mapped.status,
    );
  }
  if (error instanceof DomainError) {
    return jsonHttpError(
      c,
      {
        code: "BAD_REQUEST",
        message: error.message,
        requestId: c.get("requestId"),
        details: error.details,
      },
      400,
    );
  }
  throw error;
}

function isWorkbookDomainError(error: unknown): error is WorkbookDomainError {
  return (
    error instanceof InvalidWorkbookFieldError ||
    error instanceof InvalidWorkbookFileMetadataError ||
    error instanceof InvalidWorkbookInspectionError ||
    error instanceof InvalidWorkbookSnapshotDataError ||
    error instanceof InvalidWorkbookSnapshotReferenceError ||
    error instanceof InvalidWorkbookSparseValuesError ||
    error instanceof InvalidWorkbookStateTransitionError
  );
}

function isWorkbookApplicationError(
  error: unknown,
): error is WorkbookApplicationErrorType {
  return error instanceof WorkbookApplicationError;
}
