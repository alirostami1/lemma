import { type Timestamped, touch } from "@lemma/domain";
import {
  assertArray,
  assertNonEmptyString,
  assertPlainRecord,
} from "./canonical-validation.js";
import {
  InvalidQuestionFieldError,
  InvalidQuestionStateTransitionError,
} from "./errors.js";
import {
  type QuestionBlueprintId,
  type QuestionBlueprintVersionId,
  type QuestionGenerationRunId,
  type QuestionSetId,
  questionBlueprintId,
  questionBlueprintVersionId,
  questionGenerationRunId,
  questionSetId,
  type UserId,
  userId,
  workbookCalculationId,
} from "./ids.js";
import {
  type WorkbookQuestionSource,
  workbookQuestionSource,
} from "./question.js";
import {
  type QuestionGenerationRunStatus,
  questionGenerationRunStatus,
  requestedGenerationCount,
} from "./question-values.js";

export type QuestionGenerationRunResult = {
  questionIds: string[];
};

export type QuestionGenerationRun = Timestamped & {
  id: QuestionGenerationRunId;
  ownerUserId: UserId;
  createdByUserId: UserId;
  blueprintId: QuestionBlueprintId;
  blueprintVersionId: QuestionBlueprintVersionId;
  targetQuestionSetId: QuestionSetId;
  requestedCount: number;
  source: WorkbookQuestionSource | null;
  status: QuestionGenerationRunStatus;
  result: QuestionGenerationRunResult | null;
  errorMessage: string | null;
  attempts: number;
  startedAt: Date | null;
  finishedAt: Date | null;
};

export function createQuestionGenerationRun(
  input: {
    id: QuestionGenerationRunId;
    ownerUserId: UserId;
    createdByUserId: UserId;
    blueprintId: QuestionBlueprintId;
    blueprintVersionId: QuestionBlueprintVersionId;
    targetQuestionSetId: QuestionSetId;
    requestedCount: number;
    source: WorkbookQuestionSource | null;
  },
  at: Date,
): QuestionGenerationRun {
  return {
    id: input.id,
    ownerUserId: input.ownerUserId,
    createdByUserId: input.createdByUserId,
    blueprintId: input.blueprintId,
    blueprintVersionId: input.blueprintVersionId,
    targetQuestionSetId: input.targetQuestionSetId,
    requestedCount: requestedGenerationCount(input.requestedCount),
    source: input.source,
    status: "queued",
    result: null,
    errorMessage: null,
    attempts: 0,
    startedAt: null,
    finishedAt: null,
    createdAt: at,
    updatedAt: at,
  };
}

export function reconstituteQuestionGenerationRun(input: {
  id: string;
  ownerUserId: string;
  createdByUserId: string;
  blueprintId: string;
  blueprintVersionId: string;
  targetQuestionSetId: string;
  requestedCount: number;
  source: unknown | null;
  status: string;
  result: unknown | null;
  errorMessage: string | null;
  attempts: number;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): QuestionGenerationRun {
  return {
    id: questionGenerationRunId(input.id),
    ownerUserId: userId(input.ownerUserId),
    createdByUserId: userId(input.createdByUserId),
    blueprintId: questionBlueprintId(input.blueprintId),
    blueprintVersionId: questionBlueprintVersionId(input.blueprintVersionId),
    targetQuestionSetId: questionSetId(input.targetQuestionSetId),
    requestedCount: requestedGenerationCount(input.requestedCount),
    source: input.source === null ? null : workbookQuestionSource(input.source),
    status: questionGenerationRunStatus(input.status),
    result:
      input.result === null ? null : questionGenerationRunResult(input.result),
    errorMessage: input.errorMessage,
    attempts: nonNegativeInteger(input.attempts, "attempts"),
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

export function markQuestionGenerationRunWaitingForWorkbookCalculation(
  run: QuestionGenerationRun,
  calculationId: string,
  at: Date,
): QuestionGenerationRun {
  assertCanMaterialize(run);
  if (!run.source) {
    throw new InvalidQuestionFieldError(
      "generation run has no workbook source",
    );
  }
  return {
    ...touch(run, at),
    source: {
      ...run.source,
      workbookCalculationId: workbookCalculationId(calculationId),
    },
    status: "waiting_for_workbook_calculation",
  };
}

export function markQuestionGenerationRunMaterializing(
  run: QuestionGenerationRun,
  at: Date,
): QuestionGenerationRun {
  assertCanMaterialize(run);
  return {
    ...touch(run, at),
    status: "materializing",
    attempts: run.attempts + 1,
    startedAt: run.startedAt ?? at,
  };
}

export function markQuestionGenerationRunSucceeded(
  run: QuestionGenerationRun,
  questionIds: string[],
  at: Date,
): QuestionGenerationRun {
  if (
    run.status === "cancelled" ||
    run.status === "failed" ||
    run.status === "succeeded"
  ) {
    throw new InvalidQuestionStateTransitionError(
      "generation run cannot succeed from current state",
    );
  }
  if (questionIds.length === 0) {
    throw new InvalidQuestionFieldError(
      "question generation produced no questions",
    );
  }
  return {
    ...touch(run, at),
    status: "succeeded",
    result: { questionIds },
    errorMessage: null,
    finishedAt: at,
  };
}

export function markQuestionGenerationRunFailed(
  run: QuestionGenerationRun,
  errorMessage: string,
  at: Date,
): QuestionGenerationRun {
  if (run.status === "succeeded" || run.status === "cancelled") {
    throw new InvalidQuestionStateTransitionError(
      "generation run cannot fail from current state",
    );
  }
  return {
    ...touch(run, at),
    status: "failed",
    errorMessage: errorMessage.trim() || "Question generation failed.",
    finishedAt: at,
  };
}

export function assertQuestionGenerationRunCanRetry(
  run: QuestionGenerationRun,
): void {
  if (run.status !== "failed" && run.status !== "cancelled") {
    throw new InvalidQuestionStateTransitionError(
      "Only failed or cancelled generation runs can be retried.",
    );
  }
}

export function cancelQuestionGenerationRun(
  run: QuestionGenerationRun,
  at: Date,
): QuestionGenerationRun {
  if (run.status === "succeeded" || run.status === "failed") {
    throw new InvalidQuestionStateTransitionError(
      "generation run cannot be cancelled from current state",
    );
  }
  if (run.status === "cancelled") {
    return run;
  }
  return { ...touch(run, at), status: "cancelled", finishedAt: at };
}

export function assertCanMaterialize(run: QuestionGenerationRun): void {
  if (
    run.status === "cancelled" ||
    run.status === "failed" ||
    run.status === "succeeded"
  ) {
    throw new InvalidQuestionStateTransitionError(
      "generation run cannot materialize from current state",
    );
  }
}

export function isTerminalRun(run: QuestionGenerationRun): boolean {
  return (
    run.status === "succeeded" ||
    run.status === "failed" ||
    run.status === "cancelled"
  );
}

function questionGenerationRunResult(
  input: unknown,
): QuestionGenerationRunResult {
  assertPlainRecord(
    input,
    "generation run result must be an object",
    failResult,
  );
  assertArray(
    input.questionIds,
    "generation run result questionIds",
    failResult,
  );
  const questionIds: string[] = [];
  for (const questionId of input.questionIds) {
    assertNonEmptyString(
      questionId,
      "generation run result questionId",
      failResult,
    );
    questionIds.push(questionId);
  }
  return { questionIds };
}

function failResult(message: string): never {
  throw new InvalidQuestionFieldError(message);
}

function nonNegativeInteger(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new InvalidQuestionFieldError(
      `${fieldName} must be a non-negative integer.`,
    );
  }
  return value;
}
