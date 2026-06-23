import { InvalidWorkbookStateTransitionError } from "./errors.js";
import {
  type UserId,
  userId,
  type WorkbookCalculationId,
  workbookCalculationId,
} from "./ids.js";
import {
  requestedCalculationCount,
  type WorkbookCalculationStatus,
  workbookCalculationStatus,
} from "./workbook-values.js";

const terminalStatuses = ["succeeded", "failed", "cancelled"] as const;

export type WorkbookCalculation = {
  id: WorkbookCalculationId;
  ownerUserId: UserId;
  createdByUserId: UserId;
  requestedCount: number;
  status: WorkbookCalculationStatus;
  correlationId: string | null;
  retryOfCalculationId: WorkbookCalculationId | null;
  attemptNumber: number;
  errorMessage: string | null;
  attempts: number;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateInitialWorkbookCalculationInput = {
  id: WorkbookCalculationId;
  ownerUserId: UserId;
  createdByUserId: UserId;
  requestedCount: number;
  correlationId: string | null;
};

function createWorkbookCalculation(
  input: {
    id: WorkbookCalculationId;
    ownerUserId: UserId;
    createdByUserId: UserId;
    requestedCount: number;
    correlationId: string | null;
    retryOfCalculationId: WorkbookCalculationId | null;
    attemptNumber: number;
  },
  at: Date,
): WorkbookCalculation {
  return {
    attemptNumber: positiveInteger(input.attemptNumber, "attemptNumber"),
    attempts: 0,
    correlationId: input.correlationId,
    createdAt: at,
    createdByUserId: input.createdByUserId,
    errorMessage: null,
    finishedAt: null,
    id: input.id,
    ownerUserId: input.ownerUserId,
    requestedCount: requestedCalculationCount(input.requestedCount),
    retryOfCalculationId: input.retryOfCalculationId,
    startedAt: null,
    status: "queued",
    updatedAt: at,
  };
}

export function createInitialWorkbookCalculation(
  input: CreateInitialWorkbookCalculationInput,
  at: Date,
): WorkbookCalculation {
  return createWorkbookCalculation(
    {
      ...input,
      attemptNumber: 1,
      retryOfCalculationId: null,
    },
    at,
  );
}

export function createRetryWorkbookCalculation(
  input: {
    id: WorkbookCalculationId;
    original: WorkbookCalculation;
    createdByUserId: UserId;
  },
  at: Date,
): WorkbookCalculation {
  assertWorkbookCalculationCanRetry(input.original);
  return createWorkbookCalculation(
    {
      attemptNumber: input.original.attemptNumber + 1,
      correlationId: null,
      createdByUserId: input.createdByUserId,
      id: input.id,
      ownerUserId: input.original.ownerUserId,
      requestedCount: input.original.requestedCount,
      retryOfCalculationId: input.original.id,
    },
    at,
  );
}

export function assertWorkbookCalculationCanRetry(
  calculation: WorkbookCalculation,
): void {
  if (calculation.status !== "failed" && calculation.status !== "cancelled") {
    throw new InvalidWorkbookStateTransitionError(
      "Only failed or cancelled workbook calculations can be retried.",
    );
  }
}

export function markWorkbookCalculationRunning(
  calculation: WorkbookCalculation,
  at: Date,
): WorkbookCalculation {
  assertCalculationCanTransition(calculation);
  if (calculation.status === "running") {
    return calculation;
  }
  if (calculation.status !== "queued") {
    throw new InvalidWorkbookStateTransitionError(
      "Only queued calculations can run.",
    );
  }
  return {
    ...calculation,
    attempts: calculation.attempts + 1,
    startedAt: at,
    status: "running",
    updatedAt: at,
  };
}

export function markWorkbookCalculationSucceeded(
  calculation: WorkbookCalculation,
  at: Date,
): WorkbookCalculation {
  assertCalculationCanTransition(calculation);
  return {
    ...calculation,
    errorMessage: null,
    finishedAt: at,
    status: "succeeded",
    updatedAt: at,
  };
}

export function markWorkbookCalculationFailed(
  calculation: WorkbookCalculation,
  errorMessage: string,
  at: Date,
): WorkbookCalculation {
  if (calculation.status === "failed") {
    return calculation;
  }
  if (
    calculation.status === "succeeded" ||
    calculation.status === "cancelled"
  ) {
    throw new InvalidWorkbookStateTransitionError(
      "Terminal calculations cannot transition.",
    );
  }
  return {
    ...calculation,
    errorMessage,
    finishedAt: at,
    status: "failed",
    updatedAt: at,
  };
}

export function cancelWorkbookCalculation(
  calculation: WorkbookCalculation,
  at: Date,
): WorkbookCalculation {
  if (calculation.status === "cancelled") {
    return calculation;
  }
  if (calculation.status === "succeeded" || calculation.status === "failed") {
    throw new InvalidWorkbookStateTransitionError(
      "Terminal calculations cannot transition.",
    );
  }
  return {
    ...calculation,
    finishedAt: at,
    status: "cancelled",
    updatedAt: at,
  };
}

export function isTerminalWorkbookCalculation(
  calculation: WorkbookCalculation,
): boolean {
  return terminalStatuses.some((status) => status === calculation.status);
}

function assertCalculationCanTransition(
  calculation: WorkbookCalculation,
): void {
  if (terminalStatuses.some((status) => status === calculation.status)) {
    throw new InvalidWorkbookStateTransitionError(
      "Terminal calculations cannot transition.",
    );
  }
}

export function reconstituteWorkbookCalculation(input: {
  id: string;
  ownerUserId: string;
  createdByUserId: string;
  requestedCount: number;
  status: string;
  correlationId: string | null;
  retryOfCalculationId: string | null;
  attemptNumber: number;
  errorMessage: string | null;
  attempts: number;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): WorkbookCalculation {
  return {
    attemptNumber: positiveInteger(input.attemptNumber, "attemptNumber"),
    attempts: nonNegativeInteger(input.attempts, "attempts"),
    correlationId: input.correlationId,
    createdAt: input.createdAt,
    createdByUserId: userId(input.createdByUserId),
    errorMessage: input.errorMessage,
    finishedAt: input.finishedAt,
    id: workbookCalculationId(input.id),
    ownerUserId: userId(input.ownerUserId),
    requestedCount: requestedCalculationCount(input.requestedCount),
    retryOfCalculationId:
      input.retryOfCalculationId === null
        ? null
        : workbookCalculationId(input.retryOfCalculationId),
    startedAt: input.startedAt,
    status: workbookCalculationStatus(input.status),
    updatedAt: input.updatedAt,
  };
}

function nonNegativeInteger(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new InvalidWorkbookStateTransitionError(
      `${fieldName} must be a non-negative integer.`,
    );
  }
  return value;
}

function positiveInteger(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new InvalidWorkbookStateTransitionError(
      `${fieldName} must be a positive integer.`,
    );
  }
  return value;
}
