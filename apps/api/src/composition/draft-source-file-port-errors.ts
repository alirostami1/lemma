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
} from "@lemma/files/domain";
import {
  DraftSourceEditorUploadInvalidError,
  DraftSourceEditorUploadNotFoundError,
  DraftSourceEditorUploadStorageError,
  DraftSourceFileInvalidError,
} from "@lemma/questions/application";

export type DraftSourceFilePortOperation =
  | "editorUploadCreation"
  | "editorFileLookup"
  | "editorUploadCompletion"
  | "editorUploadLookup";

export function mapDraftSourceFilePortError(
  error: unknown,
  operation: DraftSourceFilePortOperation,
): Error {
  if (operation === "editorFileLookup") {
    return mapEditorFileLookupError(error);
  }
  if (isUploadNotFoundError(error, operation)) {
    return new DraftSourceEditorUploadNotFoundError();
  }
  if (error instanceof FileStorageProviderError) {
    return new DraftSourceEditorUploadStorageError();
  }
  if (isInvalidEditorUploadError(error)) {
    return new DraftSourceEditorUploadInvalidError();
  }
  return unexpectedFilePortError(error);
}

function mapEditorFileLookupError(error: unknown): Error {
  if (
    error instanceof FileNotFoundError ||
    error instanceof FileNotVisibleError ||
    error instanceof ForbiddenFileActionError
  ) {
    return new DraftSourceFileInvalidError("Draft source file is unavailable.");
  }
  if (
    error instanceof InvalidDomainValueError ||
    error instanceof InvalidFileDataError ||
    error instanceof InvalidFileStateError
  ) {
    return new DraftSourceFileInvalidError("Draft source file is invalid.");
  }
  return unexpectedFilePortError(error);
}

function isUploadNotFoundError(
  error: unknown,
  operation: DraftSourceFilePortOperation,
): boolean {
  return (
    error instanceof FileUploadNotFoundError ||
    (operation === "editorUploadLookup" && error instanceof FileNotFoundError)
  );
}

function isInvalidEditorUploadError(error: unknown): boolean {
  return (
    error instanceof FileUploadExpiredError ||
    error instanceof FileStorageObjectMismatchError ||
    error instanceof ForbiddenFileActionError ||
    error instanceof InvalidDomainValueError ||
    error instanceof InvalidFileDataError ||
    error instanceof InvalidFileStateError
  );
}

function unexpectedFilePortError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error("unexpected file port error");
}
