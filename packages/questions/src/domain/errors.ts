import { DomainError } from "@lemma/error";

export class InvalidQuestionFieldError extends DomainError {
  readonly domainCode = "INVALID_QUESTION_FIELD";
}

export class InvalidQuestionStateTransitionError extends DomainError {
  readonly domainCode = "INVALID_QUESTION_STATE_TRANSITION";
  constructor(message = "invalid question state") {
    super(message);
  }
}

export class InvalidQuestionBodyError extends DomainError {
  readonly domainCode = "INVALID_QUESTION_BODY";
  readonly details?: unknown;
  constructor(message = "invalid question body", details?: unknown) {
    super(message);
    this.details = details;
  }
}

export class InvalidQuestionBlueprintDocumentError extends DomainError {
  readonly domainCode = "INVALID_QUESTION_BLUEPRINT_DOCUMENT";
  readonly details?: unknown;
  constructor(
    message = "invalid question blueprint document",
    details?: unknown,
  ) {
    super(message);
    this.details = details;
  }
}

export class InvalidQuestionSourcePlanError extends DomainError {
  readonly domainCode = "INVALID_QUESTION_SOURCE_PLAN";
  readonly details?: unknown;
  constructor(message = "invalid question source plan", details?: unknown) {
    super(message);
    this.details = details;
  }
}

export class InvalidQuestionAnswerError extends DomainError {
  readonly domainCode = "INVALID_QUESTION_ANSWER";
  readonly details?: unknown;
  constructor(message = "invalid question answer", details?: unknown) {
    super(message);
    this.details = details;
  }
}

export class InvalidQuestionSolutionError extends DomainError {
  readonly domainCode = "INVALID_QUESTION_SOLUTION";
  readonly details?: unknown;
  constructor(message = "invalid question solution", details?: unknown) {
    super(message);
    this.details = details;
  }
}

export class InvalidQuestionProducerError extends DomainError {
  readonly domainCode = "INVALID_QUESTION_PRODUCER";
  readonly details?: unknown;
  constructor(message = "invalid question producer", details?: unknown) {
    super(message);
    this.details = details;
  }
}

export class InvalidQuestionGenerationRunResultError extends DomainError {
  readonly domainCode = "INVALID_QUESTION_GENERATION_RUN_RESULT";
  readonly details?: unknown;
  constructor(
    message = "invalid question generation run result",
    details?: unknown,
  ) {
    super(message);
    this.details = details;
  }
}
