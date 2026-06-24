import { createHash } from "node:crypto";
import { type Timestamped, touch } from "@lemma/domain";
import {
  assertArray,
  assertNonEmptyString,
  assertPlainRecord,
  assertSchemaVersion,
} from "./canonical-validation.js";
import {
  InvalidQuestionFieldError,
  InvalidQuestionStateTransitionError,
} from "./errors.js";
import {
  type QuestionBlueprintId,
  type QuestionGenerationRunId,
  type QuestionSetId,
  questionBlueprintId,
  questionGenerationRunId,
  questionSetId,
  type UserId,
  userId,
  type WorkbookCalculationId,
  workbookCalculationId,
} from "./ids.js";
import {
  type QuestionBlueprintSource,
  questionBlueprintSources,
} from "./question-blueprint.js";
import {
  type QuestionBlueprintDocument,
  questionBlueprintDocument,
} from "./question-blueprint-document.js";
import {
  type QuestionBlueprintDescription,
  type QuestionBlueprintName,
  type QuestionGenerationRunStatus,
  questionBlueprintDescription,
  questionBlueprintName,
  questionGenerationRunStatus,
  requestedGenerationCount,
} from "./question-values.js";

export type QuestionGenerationRunResult = {
  questionIds: string[];
};

export type QuestionBlueprintSnapshot = {
  schemaVersion: 1;
  blueprintId: QuestionBlueprintId;
  name: QuestionBlueprintName;
  description: QuestionBlueprintDescription | null;
  document: QuestionBlueprintDocument;
  sources: readonly QuestionBlueprintSource[];
  documentHash: string;
  capturedAt: string;
};

export type QuestionGenerationRun = Timestamped & {
  id: QuestionGenerationRunId;
  ownerUserId: UserId;
  createdByUserId: UserId;
  blueprintId: QuestionBlueprintId;
  blueprintSnapshot: QuestionBlueprintSnapshot;
  targetQuestionSetId: QuestionSetId;
  requestedCount: number;
  workbookCalculationId: WorkbookCalculationId | null;
  retryOfRunId: QuestionGenerationRunId | null;
  attemptNumber: number;
  status: QuestionGenerationRunStatus;
  result: QuestionGenerationRunResult | null;
  errorMessage: string | null;
  attempts: number;
  startedAt: Date | null;
  finishedAt: Date | null;
};

export type CreateInitialQuestionGenerationRunInput = {
  id: QuestionGenerationRunId;
  ownerUserId: UserId;
  createdByUserId: UserId;
  blueprintId: QuestionBlueprintId;
  blueprintSnapshot: QuestionBlueprintSnapshot;
  targetQuestionSetId: QuestionSetId;
  requestedCount: number;
};

export function createQuestionBlueprintSnapshot(input: {
  blueprintId: QuestionBlueprintId;
  name: QuestionBlueprintName;
  description: QuestionBlueprintDescription | null;
  document: QuestionBlueprintDocument;
  sources: readonly QuestionBlueprintSource[];
  capturedAt: Date;
}): QuestionBlueprintSnapshot {
  return {
    blueprintId: input.blueprintId,
    capturedAt: input.capturedAt.toISOString(),
    description: input.description,
    document: input.document,
    documentHash: hashBlueprintSnapshot(input.document, input.sources),
    name: input.name,
    schemaVersion: 1,
    sources: input.sources,
  };
}

function createQuestionGenerationRun(
  input: {
    id: QuestionGenerationRunId;
    ownerUserId: UserId;
    createdByUserId: UserId;
    blueprintId: QuestionBlueprintId;
    blueprintSnapshot: QuestionBlueprintSnapshot;
    targetQuestionSetId: QuestionSetId;
    requestedCount: number;
    workbookCalculationId: WorkbookCalculationId | null;
    retryOfRunId: QuestionGenerationRunId | null;
    attemptNumber: number;
  },
  at: Date,
): QuestionGenerationRun {
  return {
    attemptNumber: positiveInteger(input.attemptNumber, "attemptNumber"),
    attempts: 0,
    blueprintId: input.blueprintId,
    blueprintSnapshot: input.blueprintSnapshot,
    createdAt: at,
    createdByUserId: input.createdByUserId,
    errorMessage: null,
    finishedAt: null,
    id: input.id,
    ownerUserId: input.ownerUserId,
    requestedCount: requestedGenerationCount(input.requestedCount),
    result: null,
    retryOfRunId: input.retryOfRunId,
    startedAt: null,
    status: "queued",
    targetQuestionSetId: input.targetQuestionSetId,
    updatedAt: at,
    workbookCalculationId: input.workbookCalculationId,
  };
}

export function createInitialQuestionGenerationRun(
  input: CreateInitialQuestionGenerationRunInput,
  at: Date,
): QuestionGenerationRun {
  return createQuestionGenerationRun(
    {
      ...input,
      attemptNumber: 1,
      retryOfRunId: null,
      workbookCalculationId: null,
    },
    at,
  );
}

export function createRetryQuestionGenerationRun(
  input: {
    id: QuestionGenerationRunId;
    original: QuestionGenerationRun;
    createdByUserId: UserId;
  },
  at: Date,
): QuestionGenerationRun {
  assertQuestionGenerationRunCanRetry(input.original);
  return createQuestionGenerationRun(
    {
      attemptNumber: input.original.attemptNumber + 1,
      blueprintId: input.original.blueprintId,
      blueprintSnapshot: input.original.blueprintSnapshot,
      createdByUserId: input.createdByUserId,
      id: input.id,
      ownerUserId: input.original.ownerUserId,
      requestedCount: input.original.requestedCount,
      retryOfRunId: input.original.id,
      targetQuestionSetId: input.original.targetQuestionSetId,
      workbookCalculationId: null,
    },
    at,
  );
}

export function reconstituteQuestionGenerationRun(input: {
  id: string;
  ownerUserId: string;
  createdByUserId: string;
  blueprintId: string;
  blueprintSnapshot: unknown;
  targetQuestionSetId: string;
  requestedCount: number;
  workbookCalculationId: string | null;
  retryOfRunId: string | null;
  attemptNumber: number;
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
    attemptNumber: positiveInteger(input.attemptNumber, "attemptNumber"),
    attempts: nonNegativeInteger(input.attempts, "attempts"),
    blueprintId: questionBlueprintId(input.blueprintId),
    blueprintSnapshot: questionBlueprintSnapshot(input.blueprintSnapshot),
    createdAt: input.createdAt,
    createdByUserId: userId(input.createdByUserId),
    errorMessage: input.errorMessage,
    finishedAt: input.finishedAt,
    id: questionGenerationRunId(input.id),
    ownerUserId: userId(input.ownerUserId),
    requestedCount: requestedGenerationCount(input.requestedCount),
    result:
      input.result === null ? null : questionGenerationRunResult(input.result),
    retryOfRunId:
      input.retryOfRunId === null
        ? null
        : questionGenerationRunId(input.retryOfRunId),
    startedAt: input.startedAt,
    status: questionGenerationRunStatus(input.status),
    targetQuestionSetId: questionSetId(input.targetQuestionSetId),
    updatedAt: input.updatedAt,
    workbookCalculationId:
      input.workbookCalculationId === null
        ? null
        : workbookCalculationId(input.workbookCalculationId),
  };
}

export function markQuestionGenerationRunWaitingForWorkbookCalculation(
  run: QuestionGenerationRun,
  calculationId: WorkbookCalculationId,
  at: Date,
): QuestionGenerationRun {
  assertCanMaterialize(run);
  return {
    ...touch(run, at),
    status: "waiting_for_workbook_calculation",
    workbookCalculationId: calculationId,
  };
}

export function markQuestionGenerationRunMaterializing(
  run: QuestionGenerationRun,
  at: Date,
): QuestionGenerationRun {
  assertCanMaterialize(run);
  return {
    ...touch(run, at),
    attempts: run.attempts + 1,
    startedAt: run.startedAt ?? at,
    status: "materializing",
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
    errorMessage: null,
    finishedAt: at,
    result: { questionIds },
    status: "succeeded",
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
    errorMessage: errorMessage.trim() || "Question generation failed.",
    finishedAt: at,
    status: "failed",
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
  return { ...touch(run, at), finishedAt: at, status: "cancelled" };
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

export function questionBlueprintSnapshot(
  input: unknown,
): QuestionBlueprintSnapshot {
  assertPlainRecord(
    input,
    "question blueprint snapshot must be an object",
    fail,
  );
  assertSchemaVersion(input, fail);
  if (typeof input.blueprintId !== "string") {
    fail("question blueprint snapshot blueprintId must be a uuid");
  }
  assertNonEmptyString(input.documentHash, "documentHash", fail);
  return {
    blueprintId: questionBlueprintId(input.blueprintId),
    capturedAt: parsedSnapshotDateString(input.capturedAt),
    description: questionBlueprintDescription(
      (input.description as string | null | undefined) ?? null,
    ),
    document: questionBlueprintDocument(input.document),
    documentHash: input.documentHash,
    name: questionBlueprintName(input.name),
    schemaVersion: 1,
    sources: questionBlueprintSources(input.sources),
  };
}

function questionGenerationRunResult(
  input: unknown,
): QuestionGenerationRunResult {
  assertPlainRecord(input, "generation run result must be an object", fail);
  assertArray(input.questionIds, "generation run result questionIds", fail);
  const questionIds: string[] = [];
  for (const questionId of input.questionIds) {
    assertNonEmptyString(questionId, "generation run result questionId", fail);
    questionIds.push(questionId);
  }
  return { questionIds };
}

function nonNegativeInteger(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new InvalidQuestionFieldError(
      `${fieldName} must be a non-negative integer.`,
    );
  }
  return value;
}

function positiveInteger(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new InvalidQuestionFieldError(
      `${fieldName} must be a positive integer.`,
    );
  }
  return value;
}

function parsedSnapshotDateString(value: unknown): string {
  if (typeof value !== "string") {
    throw new InvalidQuestionFieldError(
      "question blueprint snapshot capturedAt must be a valid date string.",
    );
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new InvalidQuestionFieldError(
      "question blueprint snapshot capturedAt must be a valid date string.",
    );
  }
  return date.toISOString();
}

function hashBlueprintSnapshot(
  document: QuestionBlueprintDocument,
  sources: readonly QuestionBlueprintSource[],
) {
  return createHash("sha256")
    .update(JSON.stringify({ document, sources }))
    .digest("hex");
}

function fail(message: string): never {
  throw new InvalidQuestionFieldError(message);
}
