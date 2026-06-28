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

export class QuestionBlueprintDraftRevisionConflictError extends QuestionsApplicationError {
  readonly applicationCode = "DRAFT_REVISION_CONFLICT";
  constructor(message = "question blueprint draft revision conflict") {
    super(message);
  }
}

export class QuestionBlueprintBaseVersionConflictError extends QuestionsApplicationError {
  readonly applicationCode = "BLUEPRINT_BASE_VERSION_CONFLICT";
  constructor(message = "question blueprint base version conflict") {
    super(message);
  }
}

export class DraftSourceNotFoundError extends QuestionsApplicationError {
  readonly applicationCode = "DRAFT_SOURCE_NOT_FOUND";
  constructor(message = "draft source not found") {
    super(message);
  }
}

export class DraftSourceKindUnsupportedError extends QuestionsApplicationError {
  readonly applicationCode = "DRAFT_SOURCE_KIND_UNSUPPORTED";
  constructor(message = "draft source kind is unsupported") {
    super(message);
  }
}

export class DraftSourceFileForbiddenError extends QuestionsApplicationError {
  readonly applicationCode = "DRAFT_SOURCE_FILE_FORBIDDEN";
  constructor(message = "draft source file is forbidden") {
    super(message);
  }
}

export class DraftSourceFileInvalidError extends QuestionsApplicationError {
  readonly applicationCode = "DRAFT_SOURCE_FILE_INVALID";
  constructor(message = "draft source file is invalid") {
    super(message);
  }
}

export class DraftSourceNotReadyError extends QuestionsApplicationError {
  readonly applicationCode = "DRAFT_SOURCE_NOT_READY";
  constructor(message = "draft source is not ready") {
    super(message);
  }
}

export class InvalidDraftSourceReferenceError extends QuestionsApplicationError {
  readonly applicationCode = "INVALID_DRAFT_SOURCE_REFERENCE";
  constructor(message = "invalid draft source reference") {
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

export class SourceDocumentHeadUpdateFailedError extends QuestionsApplicationError {
  readonly applicationCode = "SOURCE_DOCUMENT_HEAD_UPDATE_FAILED";
  constructor(message = "source document head update failed") {
    super(message);
  }
}

export class QuestionsRepositoryDataError extends QuestionsApplicationError {
  readonly applicationCode = "QUESTIONS_REPOSITORY_DATA_ERROR";
  constructor(message = "persisted questions data is invalid") {
    super(message);
  }
}

export class UnsupportedQuestionValueExpressionError extends QuestionsApplicationError {
  readonly applicationCode = "UNSUPPORTED_QUESTION_VALUE_EXPRESSION";
  constructor(message = "unsupported question value expression") {
    super(message);
  }
}
