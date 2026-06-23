export abstract class WorkbookApplicationError<
  Code extends Uppercase<string> = Uppercase<string>,
> extends Error {
  abstract readonly applicationCode: Code;
  readonly details?: unknown;
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class WorkbookNotFoundError extends WorkbookApplicationError {
  readonly applicationCode = "WORKBOOK_NOT_FOUND";
  constructor(message = "workbook not found") {
    super(message);
  }
}

export class WorkbookCalculationNotFoundError extends WorkbookApplicationError {
  readonly applicationCode = "WORKBOOK_CALCULATION_NOT_FOUND";
  constructor(message = "workbook calculation not found") {
    super(message);
  }
}

export class WorkbookSnapshotNotFoundError extends WorkbookApplicationError {
  readonly applicationCode = "WORKBOOK_SNAPSHOT_NOT_FOUND";
  constructor(message = "workbook snapshot not found") {
    super(message);
  }
}

export class ForbiddenWorkbookActionError extends WorkbookApplicationError {
  readonly applicationCode = "FORBIDDEN_WORKBOOK_ACTION";
  constructor(message = "forbidden workbook action") {
    super(message);
  }
}

export class InvalidWorkbookCalculationRequestError extends WorkbookApplicationError {
  readonly applicationCode = "INVALID_WORKBOOK_CALCULATION_REQUEST";
  constructor(message = "invalid workbook calculation request") {
    super(message);
  }
}

export class WorkbookFileNotFoundError extends WorkbookApplicationError {
  readonly applicationCode = "WORKBOOK_FILE_NOT_FOUND";
  constructor(message = "workbook file not found") {
    super(message);
  }
}

export class WorkbookFileUnavailableError extends WorkbookApplicationError {
  readonly applicationCode = "WORKBOOK_FILE_UNAVAILABLE";
  constructor(message = "workbook file unavailable", options?: ErrorOptions) {
    super(message, options);
  }
}

export class WorkbookFileProviderFailureError extends WorkbookApplicationError {
  readonly applicationCode = "WORKBOOK_FILE_PROVIDER_FAILURE";
  constructor(
    message = "workbook file provider failed",
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

export class WorkbookRepositoryFailureError extends WorkbookApplicationError {
  readonly applicationCode = "WORKBOOK_REPOSITORY_FAILURE";
  constructor(message = "workbook repository failed", options?: ErrorOptions) {
    super(message, options);
  }
}

export class WorkbookEngineFailureError extends WorkbookApplicationError {
  readonly applicationCode = "WORKBOOK_ENGINE_FAILURE";
  constructor(
    message = "workbook engine failed",
    readonly code = "engine_failure",
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

export class WorkbookCalculationFailedError extends WorkbookApplicationError {
  readonly applicationCode = "WORKBOOK_CALCULATION_FAILED";

  constructor(
    message = "Workbook calculation failed.",
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}
