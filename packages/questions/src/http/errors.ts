import {
  createHttpErrorHandler,
  DomainError,
  type ErrorMapper,
} from "@lemma/error";
import { jsonHttpError } from "@lemma/http";
import type { Context } from "hono";
import {
  type DraftSourceEditorUploadInvalidError,
  type DraftSourceEditorUploadNotFoundError,
  type DraftSourceEditorUploadStorageError,
  type DraftSourceFileForbiddenError,
  type DraftSourceFileInvalidError,
  type DraftSourceKindUnsupportedError,
  type DraftSourceNotFoundError,
  type DraftSourceNotReadyError,
  type ForbiddenQuestionActionError,
  type InvalidDraftSourceReferenceError,
  type InvalidQuestionBlueprintError,
  type QuestionBlueprintBaseVersionConflictError,
  type QuestionBlueprintDraftNotFoundError,
  type QuestionBlueprintDraftRevisionConflictError,
  type QuestionBlueprintNotFoundError,
  type QuestionGenerationRunNotFoundError,
  type QuestionNotFoundError,
  type QuestionSetNotFoundError,
  QuestionsApplicationError,
  type SourceDocumentRevisionConflictError,
  type UnsupportedQuestionValueExpressionError,
  type WorkbookEditorOutputStaleError,
  type WorkbookQuestionReferenceError,
  type WorkbookSourceEditInvalidatesReferencesError,
} from "../application/errors.js";
import {
  InvalidQuestionAnswerError,
  InvalidQuestionBlueprintDocumentError,
  InvalidQuestionBodyError,
  InvalidQuestionFieldError,
  InvalidQuestionGenerationRunResultError,
  InvalidQuestionProducerError,
  InvalidQuestionSolutionError,
  InvalidQuestionSourcePlanError,
  InvalidQuestionStateTransitionError,
} from "../domain/index.js";
import type { QuestionsAppEnv } from "./env.js";

type QuestionsDomainError =
  | InvalidQuestionAnswerError
  | InvalidQuestionBodyError
  | InvalidQuestionFieldError
  | InvalidQuestionGenerationRunResultError
  | InvalidQuestionProducerError
  | InvalidQuestionSolutionError
  | InvalidQuestionSourcePlanError
  | InvalidQuestionStateTransitionError
  | InvalidQuestionBlueprintDocumentError;

type QuestionsApplicationErrorType =
  | DraftSourceEditorUploadInvalidError
  | DraftSourceEditorUploadNotFoundError
  | DraftSourceEditorUploadStorageError
  | DraftSourceFileForbiddenError
  | DraftSourceFileInvalidError
  | DraftSourceKindUnsupportedError
  | DraftSourceNotFoundError
  | DraftSourceNotReadyError
  | ForbiddenQuestionActionError
  | InvalidDraftSourceReferenceError
  | InvalidQuestionBlueprintError
  | QuestionBlueprintBaseVersionConflictError
  | QuestionBlueprintDraftRevisionConflictError
  | QuestionGenerationRunNotFoundError
  | QuestionNotFoundError
  | QuestionSetNotFoundError
  | QuestionBlueprintNotFoundError
  | QuestionBlueprintDraftNotFoundError
  | SourceDocumentRevisionConflictError
  | UnsupportedQuestionValueExpressionError
  | WorkbookEditorOutputStaleError
  | WorkbookSourceEditInvalidatesReferencesError
  | WorkbookQuestionReferenceError;

const applicationErrorMapper = {
  BLUEPRINT_BASE_VERSION_CONFLICT: {
    code: "BLUEPRINT_BASE_VERSION_CONFLICT",
    status: 409,
  },
  DRAFT_SOURCE_FILE_FORBIDDEN: {
    code: "DRAFT_SOURCE_FILE_FORBIDDEN",
    status: 403,
  },
  DRAFT_SOURCE_FILE_INVALID: { code: "DRAFT_SOURCE_FILE_INVALID", status: 400 },
  DRAFT_SOURCE_KIND_UNSUPPORTED: {
    code: "DRAFT_SOURCE_KIND_UNSUPPORTED",
    status: 400,
  },
  DRAFT_SOURCE_NOT_FOUND: { code: "DRAFT_SOURCE_NOT_FOUND", status: 404 },
  DRAFT_SOURCE_NOT_READY: { code: "DRAFT_SOURCE_NOT_READY", status: 409 },
  DRAFT_REVISION_CONFLICT: { code: "DRAFT_REVISION_CONFLICT", status: 409 },
  DRAFT_SOURCE_EDITOR_UPLOAD_INVALID: {
    code: "DRAFT_SOURCE_EDITOR_UPLOAD_INVALID",
    status: 400,
  },
  DRAFT_SOURCE_EDITOR_UPLOAD_NOT_FOUND: {
    code: "DRAFT_SOURCE_EDITOR_UPLOAD_NOT_FOUND",
    status: 404,
  },
  DRAFT_SOURCE_EDITOR_UPLOAD_STORAGE_ERROR: {
    code: "DRAFT_SOURCE_EDITOR_UPLOAD_STORAGE_ERROR",
    status: 502,
  },
  FORBIDDEN_QUESTION_ACTION: { code: "FORBIDDEN_QUESTION_ACTION", status: 403 },
  INVALID_DRAFT_SOURCE_REFERENCE: {
    code: "INVALID_DRAFT_SOURCE_REFERENCE",
    status: 400,
  },
  INVALID_QUESTION_BLUEPRINT: { code: "BAD_REQUEST", status: 400 },
  QUESTION_BLUEPRINT_DRAFT_NOT_FOUND: {
    code: "QUESTION_BLUEPRINT_DRAFT_NOT_FOUND",
    status: 404,
  },
  QUESTION_BLUEPRINT_NOT_FOUND: {
    code: "QUESTION_BLUEPRINT_NOT_FOUND",
    status: 404,
  },
  QUESTION_GENERATION_RUN_NOT_FOUND: {
    code: "QUESTION_GENERATION_RUN_NOT_FOUND",
    status: 404,
  },
  QUESTION_NOT_FOUND: { code: "QUESTION_NOT_FOUND", status: 404 },
  QUESTION_SET_NOT_FOUND: { code: "QUESTION_SET_NOT_FOUND", status: 404 },
  SOURCE_DOCUMENT_REVISION_CONFLICT: {
    code: "SOURCE_DOCUMENT_REVISION_CONFLICT",
    status: 409,
  },
  UNSUPPORTED_QUESTION_VALUE_EXPRESSION: {
    code: "UNSUPPORTED_QUESTION_VALUE_EXPRESSION",
    status: 400,
  },
  WORKBOOK_EDITOR_OUTPUT_STALE: {
    code: "WORKBOOK_EDITOR_OUTPUT_STALE",
    status: 409,
  },
  WORKBOOK_SOURCE_EDIT_INVALIDATES_REFERENCES: {
    code: "WORKBOOK_SOURCE_EDIT_INVALIDATES_REFERENCES",
    status: 409,
  },
  WORKBOOK_QUESTION_REFERENCE_ERROR: {
    code: "WORKBOOK_QUESTION_REFERENCE_ERROR",
    status: 502,
  },
} as const;

const domainErrorMapper = {
  INVALID_QUESTION_ANSWER: { code: "BAD_REQUEST", status: 400 },
  INVALID_QUESTION_BLUEPRINT_DOCUMENT: { code: "BAD_REQUEST", status: 400 },
  INVALID_QUESTION_BODY: { code: "BAD_REQUEST", status: 400 },
  INVALID_QUESTION_FIELD: { code: "BAD_REQUEST", status: 400 },
  INVALID_QUESTION_GENERATION_RUN_RESULT: { code: "BAD_REQUEST", status: 400 },
  INVALID_QUESTION_PRODUCER: { code: "BAD_REQUEST", status: 400 },
  INVALID_QUESTION_SOLUTION: { code: "BAD_REQUEST", status: 400 },
  INVALID_QUESTION_SOURCE_PLAN: { code: "BAD_REQUEST", status: 400 },
  INVALID_QUESTION_STATE_TRANSITION: {
    code: "QUESTION_STATE_CONFLICT",
    status: 409,
  },
} as const satisfies ErrorMapper<QuestionsDomainError>;

const questionsDomainHttpError = createHttpErrorHandler(domainErrorMapper);

export function handleQuestionsError(
  c: Context<QuestionsAppEnv>,
  error: unknown,
): Response {
  if (isQuestionsDomainError(error)) {
    const httpError = questionsDomainHttpError(error, c.get("requestId"));
    return jsonHttpError(c, httpError.body.error, httpError.status);
  }
  if (isQuestionsApplicationError(error)) {
    const mapped = applicationErrorMapper[error.applicationCode];
    return jsonHttpError(
      c,
      {
        code: mapped.code,
        details: error.details,
        message: error.message,
        requestId: c.get("requestId"),
      },
      mapped.status,
    );
  }
  if (error instanceof DomainError) {
    return jsonHttpError(
      c,
      {
        code: "BAD_REQUEST",
        details: error.details,
        message: error.message,
        requestId: c.get("requestId"),
      },
      400,
    );
  }
  throw error;
}

function isQuestionsDomainError(error: unknown): error is QuestionsDomainError {
  return (
    error instanceof InvalidQuestionAnswerError ||
    error instanceof InvalidQuestionBodyError ||
    error instanceof InvalidQuestionFieldError ||
    error instanceof InvalidQuestionGenerationRunResultError ||
    error instanceof InvalidQuestionProducerError ||
    error instanceof InvalidQuestionSolutionError ||
    error instanceof InvalidQuestionSourcePlanError ||
    error instanceof InvalidQuestionStateTransitionError ||
    error instanceof InvalidQuestionBlueprintDocumentError
  );
}

function isQuestionsApplicationError(
  error: unknown,
): error is QuestionsApplicationErrorType {
  return error instanceof QuestionsApplicationError;
}
