import { InvalidWorkbookStateTransitionError } from "./errors.js";
import type { UserId, WorkbookCalculationId, WorkbookId } from "./ids.js";
import {
  type WorkbookCalculationStatus,
  requestedCalculationCount,
} from "./workbook-values.js";

const terminalStatuses = ["succeeded", "failed", "cancelled"] as const;

export type WorkbookCalculation = {
  id: WorkbookCalculationId;
  ownerUserId: UserId;
  createdByUserId: UserId;
  workbookId: WorkbookId;
  requestedCount: number;
  status: WorkbookCalculationStatus;
  correlationId: string | null;
  errorMessage: string | null;
  attempts: number;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export function createWorkbookCalculation(
  input: {
    id: WorkbookCalculationId;
    ownerUserId: UserId;
    createdByUserId: UserId;
    workbookId: WorkbookId;
    requestedCount: number;
    correlationId?: string | null;
  },
  at: Date,
): WorkbookCalculation {
  return {
    id: input.id,
    ownerUserId: input.ownerUserId,
    createdByUserId: input.createdByUserId,
    workbookId: input.workbookId,
    requestedCount: requestedCalculationCount(input.requestedCount),
    status: "queued",
    correlationId: input.correlationId ?? null,
    errorMessage: null,
    attempts: 0,
    startedAt: null,
    finishedAt: null,
    createdAt: at,
    updatedAt: at,
  };
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
    throw new InvalidWorkbookStateTransitionError("Only queued calculations can run.");
  }
  return {
    ...calculation,
    status: "running",
    attempts: calculation.attempts + 1,
    startedAt: at,
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
    status: "succeeded",
    errorMessage: null,
    finishedAt: at,
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
  if (calculation.status === "succeeded" || calculation.status === "cancelled") {
    throw new InvalidWorkbookStateTransitionError("Terminal calculations cannot transition.");
  }
  return {
    ...calculation,
    status: "failed",
    errorMessage,
    finishedAt: at,
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
    throw new InvalidWorkbookStateTransitionError("Terminal calculations cannot transition.");
  }
  return {
    ...calculation,
    status: "cancelled",
    finishedAt: at,
    updatedAt: at,
  };
}

export function isTerminalWorkbookCalculation(
  calculation: WorkbookCalculation,
): boolean {
  return terminalStatuses.includes(calculation.status as never);
}

function assertCalculationCanTransition(calculation: WorkbookCalculation): void {
  if (terminalStatuses.includes(calculation.status as never)) {
    throw new InvalidWorkbookStateTransitionError("Terminal calculations cannot transition.");
  }
}
