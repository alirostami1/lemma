import {
  createHttpErrorHandler,
  DomainError,
  type ErrorMapper,
} from "@lemma/error";
import { jsonHttpError } from "@lemma/http";
import type { Context } from "hono";
import {
  type ForbiddenQuestionActionError,
  type InvalidQuestionBlueprintError,
  type QuestionBlueprintNotFoundError,
  type QuestionGenerationRunNotFoundError,
  type QuestionNotFoundError,
  type QuestionSetNotFoundError,
  QuestionsApplicationError,
  type UnsupportedQuestionValueExpressionError,
  type WorkbookQuestionSourceError,
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
  | ForbiddenQuestionActionError
  | InvalidQuestionBlueprintError
  | QuestionGenerationRunNotFoundError
  | QuestionNotFoundError
  | QuestionSetNotFoundError
  | QuestionBlueprintNotFoundError
  | UnsupportedQuestionValueExpressionError
  | WorkbookQuestionSourceError;

const applicationErrorMapper = {
  FORBIDDEN_QUESTION_ACTION: { code: "FORBIDDEN_QUESTION_ACTION", status: 403 },
  INVALID_QUESTION_BLUEPRINT: { code: "BAD_REQUEST", status: 400 },
  QUESTION_GENERATION_RUN_NOT_FOUND: {
    code: "QUESTION_GENERATION_RUN_NOT_FOUND",
    status: 404,
  },
  QUESTION_NOT_FOUND: { code: "QUESTION_NOT_FOUND", status: 404 },
  QUESTION_SET_NOT_FOUND: { code: "QUESTION_SET_NOT_FOUND", status: 404 },
  QUESTION_BLUEPRINT_NOT_FOUND: {
    code: "QUESTION_BLUEPRINT_NOT_FOUND",
    status: 404,
  },
  UNSUPPORTED_QUESTION_VALUE_EXPRESSION: {
    code: "UNSUPPORTED_QUESTION_VALUE_EXPRESSION",
    status: 400,
  },
  WORKBOOK_QUESTION_SOURCE_ERROR: {
    code: "WORKBOOK_QUESTION_SOURCE_ERROR",
    status: 502,
  },
} as const;

const domainErrorMapper = {
  INVALID_QUESTION_ANSWER: { code: "BAD_REQUEST", status: 400 },
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
  INVALID_QUESTION_BLUEPRINT_DOCUMENT: { code: "BAD_REQUEST", status: 400 },
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
        message: error.message,
        requestId: c.get("requestId"),
        details: error.details,
      },
      mapped.status,
    );
  }
  if (error instanceof DomainError) {
    return jsonHttpError(
      c,
      {
        code: "BAD_REQUEST",
        message: error.message,
        requestId: c.get("requestId"),
        details: error.details,
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
