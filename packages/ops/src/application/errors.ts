export class OpsApplicationError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ForbiddenOpsActionError extends OpsApplicationError {
  constructor(message = "You cannot manage operations.") {
    super(message, "FORBIDDEN_OPS_ACTION");
  }
}

export class OpsOutboxEventNotFoundError extends OpsApplicationError {
  constructor(message = "Outbox event was not found.") {
    super(message, "OPS_OUTBOX_EVENT_NOT_FOUND");
  }
}

export class InvalidOpsRequestError extends OpsApplicationError {
  constructor(message = "Ops request is invalid.") {
    super(message, "INVALID_OPS_REQUEST");
  }
}
