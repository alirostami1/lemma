export abstract class QuestionsApplicationError<
  Code extends Uppercase<string> = Uppercase<string>,
> extends Error {
  abstract readonly applicationCode: Code;
  readonly details?: unknown;
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class QuestionSetNotFoundError extends QuestionsApplicationError {
  readonly applicationCode = "QUESTION_SET_NOT_FOUND";
  constructor(message = "question set not found") {
    super(message);
  }
}

export class QuestionBlueprintNotFoundError extends QuestionsApplicationError {
  readonly applicationCode = "QUESTION_BLUEPRINT_NOT_FOUND";
  constructor(message = "question blueprint not found") {
    super(message);
  }
}

export class QuestionBlueprintDraftNotFoundError extends QuestionsApplicationError {
  readonly applicationCode = "QUESTION_BLUEPRINT_DRAFT_NOT_FOUND";
  constructor(message = "question blueprint draft not found") {
    super(message);
  }
}

export class QuestionNotFoundError extends QuestionsApplicationError {
  readonly applicationCode = "QUESTION_NOT_FOUND";
  constructor(message = "question not found") {
    super(message);
  }
}

export class QuestionGenerationRunNotFoundError extends QuestionsApplicationError {
  readonly applicationCode = "QUESTION_GENERATION_RUN_NOT_FOUND";
  constructor(message = "question generation run not found") {
    super(message);
  }
}

export class ForbiddenQuestionActionError extends QuestionsApplicationError {
  readonly applicationCode = "FORBIDDEN_QUESTION_ACTION";
  constructor(message = "forbidden question action") {
    super(message);
  }
}

export class InvalidQuestionBlueprintError extends QuestionsApplicationError {
  readonly applicationCode = "INVALID_QUESTION_BLUEPRINT";
  readonly details?: unknown;
  constructor(message = "invalid question blueprint", details?: unknown) {
    super(message);
    this.details = details;
  }
}

export class WorkbookQuestionReferenceError extends QuestionsApplicationError {
  readonly applicationCode = "WORKBOOK_QUESTION_REFERENCE_ERROR";
  constructor(
    message = "workbook question reference failed",
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

export class UnsupportedQuestionValueExpressionError extends QuestionsApplicationError {
  readonly applicationCode = "UNSUPPORTED_QUESTION_VALUE_EXPRESSION";
  constructor(message = "unsupported question value expression") {
    super(message);
  }
}
