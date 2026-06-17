import { DomainError } from "@lemma/error";

export class InvalidWorkbookFieldError extends DomainError {
  readonly domainCode = "INVALID_WORKBOOK_FIELD";
}

export class InvalidWorkbookStateTransitionError extends DomainError {
  readonly domainCode = "INVALID_WORKBOOK_STATE_TRANSITION";
  constructor(message = "invalid workbook state transition") {
    super(message);
  }
}

export class InvalidWorkbookFileMetadataError extends DomainError {
  readonly domainCode = "INVALID_WORKBOOK_FILE_METADATA";
  readonly details?: unknown;
  constructor(message = "invalid workbook file metadata", details?: unknown) {
    super(message);
    this.details = details;
  }
}

export class InvalidWorkbookInspectionError extends DomainError {
  readonly domainCode = "INVALID_WORKBOOK_INSPECTION";
  constructor(message = "invalid workbook inspection") {
    super(message);
  }
}

export class InvalidWorkbookSparseValuesError extends DomainError {
  readonly domainCode = "INVALID_WORKBOOK_SPARSE_VALUES";
  constructor(message = "invalid workbook sparse values") {
    super(message);
  }
}

export class InvalidWorkbookSnapshotReferenceError extends DomainError {
  readonly domainCode = "INVALID_WORKBOOK_SNAPSHOT_REFERENCE";
  constructor(message = "invalid workbook snapshot reference") {
    super(message);
  }
}

export class InvalidWorkbookSnapshotDataError extends DomainError {
  readonly domainCode = "INVALID_WORKBOOK_SNAPSHOT_DATA";
  constructor(message = "invalid workbook snapshot data") {
    super(message);
  }
}
