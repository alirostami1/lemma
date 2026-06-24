import {
  createHttpErrorHandler,
  DomainError,
  type ErrorMapper,
} from "@lemma/error";
import type { Context } from "hono";
import {
  FileNotFoundError,
  FileNotVisibleError,
  FileStorageObjectMismatchError,
  FileStorageProviderError,
  FileUploadExpiredError,
  FileUploadNotFoundError,
  ForbiddenFileActionError,
  InvalidDomainValueError,
  InvalidFileDataError,
  InvalidFileStateError,
} from "../domain/index.js";
import type { FilesAppEnv } from "./env.js";

type FilesDomainError =
  | FileNotFoundError
  | FileNotVisibleError
  | FileStorageObjectMismatchError
  | FileStorageProviderError
  | FileUploadExpiredError
  | FileUploadNotFoundError
  | ForbiddenFileActionError
  | InvalidDomainValueError
  | InvalidFileDataError
  | InvalidFileStateError;

const errorMapper = {
  FILE_NOT_FOUND: { code: "FILE_NOT_FOUND", status: 404 },
  FILE_NOT_VISIBLE: { code: "FILE_NOT_FOUND", status: 404 },
  FILE_STORAGE_OBJECT_MISMATCH: { code: "BAD_REQUEST", status: 400 },
  FILE_STORAGE_PROVIDER_ERROR: {
    code: "FILE_STORAGE_PROVIDER_ERROR",
    status: 502,
  },
  FILE_UPLOAD_EXPIRED: { code: "FILE_UPLOAD_EXPIRED", status: 409 },
  FILE_UPLOAD_NOT_FOUND: { code: "FILE_UPLOAD_NOT_FOUND", status: 404 },
  FORBIDDEN_FILE_ACTION: { code: "FORBIDDEN_FILE_ACTION", status: 403 },
  INVALID_DOMAIN_VALUE: { code: "BAD_REQUEST", status: 400 },
  INVALID_FILE_DATA: { code: "BAD_REQUEST", status: 400 },
  INVALID_FILE_STATE: { code: "FILE_STATE_CONFLICT", status: 409 },
} as const satisfies ErrorMapper<FilesDomainError>;

const filesHttpError = createHttpErrorHandler(errorMapper);

export function handleFilesError(
  c: Context<FilesAppEnv>,
  error: unknown,
): Response {
  if (isFilesDomainError(error)) {
    const httpError = filesHttpError(error, c.get("requestId"));
    return c.json(httpError.body, httpError.status);
  }

  if (error instanceof DomainError) {
    return c.json(
      {
        error: {
          code: "BAD_REQUEST",
          details: error.details,
          message: error.message,
          requestId: c.get("requestId"),
        },
      },
      400,
    );
  }

  throw error;
}

function isFilesDomainError(error: unknown): error is FilesDomainError {
  return (
    error instanceof FileNotFoundError ||
    error instanceof FileNotVisibleError ||
    error instanceof FileStorageObjectMismatchError ||
    error instanceof FileStorageProviderError ||
    error instanceof FileUploadExpiredError ||
    error instanceof FileUploadNotFoundError ||
    error instanceof ForbiddenFileActionError ||
    error instanceof InvalidDomainValueError ||
    error instanceof InvalidFileDataError ||
    error instanceof InvalidFileStateError
  );
}
