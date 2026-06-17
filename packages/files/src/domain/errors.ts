import { DomainError } from "@lemma/error";

export class InvalidDomainValueError extends DomainError {
  readonly domainCode = "INVALID_DOMAIN_VALUE";
}

export class FileNotFoundError extends DomainError {
  readonly domainCode = "FILE_NOT_FOUND";

  constructor(message = "file not found") {
    super(message);
  }
}

export class FileUploadNotFoundError extends DomainError {
  readonly domainCode = "FILE_UPLOAD_NOT_FOUND";

  constructor(message = "file upload not found") {
    super(message);
  }
}

export class FileNotVisibleError extends DomainError {
  readonly domainCode = "FILE_NOT_VISIBLE";

  constructor(message = "file is not visible") {
    super(message);
  }
}

export class ForbiddenFileActionError extends DomainError {
  readonly domainCode = "FORBIDDEN_FILE_ACTION";

  constructor(message = "forbidden file action") {
    super(message);
  }
}

export class InvalidFileStateError extends DomainError {
  readonly domainCode = "INVALID_FILE_STATE";

  constructor(message = "invalid file state") {
    super(message);
  }
}

export class InvalidFileDataError extends DomainError {
  readonly domainCode = "INVALID_FILE_DATA";
  readonly details?: unknown;

  constructor(message = "invalid file data", details?: unknown) {
    super(message);
    this.details = details;
  }
}

export class FileUploadExpiredError extends DomainError {
  readonly domainCode = "FILE_UPLOAD_EXPIRED";

  constructor(message = "file upload has expired") {
    super(message);
  }
}

export class FileStorageObjectMismatchError extends DomainError {
  readonly domainCode = "FILE_STORAGE_OBJECT_MISMATCH";
  readonly details?: unknown;

  constructor(
    message = "uploaded object does not match file",
    details?: unknown,
  ) {
    super(message);
    this.details = details;
  }
}

export class FileStorageProviderError extends DomainError {
  readonly domainCode = "FILE_STORAGE_PROVIDER_ERROR";

  constructor(
    message = "storage provider operation failed",
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}
