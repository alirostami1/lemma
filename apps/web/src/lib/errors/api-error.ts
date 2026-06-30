import { AppApiError } from "#/api/errors";
import type { WorkbookSourceEditInvalidatesReferencesErrorResponseErrorDetails } from "#/api/generated/model";

export function isAppApiError(error: unknown): error is AppApiError {
  return error instanceof AppApiError;
}

export function getApiErrorStatus(error: unknown): number | null {
  return isAppApiError(error) ? error.status : null;
}

export function isUnauthorizedError(error: unknown): boolean {
  return getApiErrorStatus(error) === 401;
}

export function isForbiddenError(error: unknown): boolean {
  return getApiErrorStatus(error) === 403;
}

export function isNotFoundError(error: unknown): boolean {
  return getApiErrorStatus(error) === 404;
}

export function getApiErrorRequestId(error: unknown): string | null {
  return isAppApiError(error) ? (error.payload.requestId ?? null) : null;
}

export function getApiErrorCode(error: unknown): string | null {
  return isAppApiError(error) ? error.payload.code : null;
}

export function getWorkbookSourceEditRecoveryMessage(
  error: unknown,
): string | null {
  if (
    !isAppApiError(error) ||
    error.payload.code !== "WORKBOOK_SOURCE_EDIT_INVALIDATES_REFERENCES"
  ) {
    return null;
  }

  const details = workbookSourceEditRecoveryDetails(error.payload.details);
  if (!details) {
    return null;
  }

  const affected = details.affectedInsertedValues.map(
    (item) => `${item.label}: ${item.problem}`,
  );
  const message = [details.summary, ...affected, details.recoveryAction].join(
    " ",
  );

  return containsInternalRecoveryCopy(message) ? details.summary : message;
}

export function getUserFacingApiErrorMessage(
  error: unknown,
  fallback = "Something went wrong.",
): string {
  if (isUnauthorizedError(error)) {
    return "Sign in to continue.";
  }
  if (isForbiddenError(error)) {
    return "You do not have access to this resource.";
  }
  if (isNotFoundError(error)) {
    return "The requested item could not be found.";
  }
  if (isAppApiError(error) && error.payload.message.length > 0) {
    return error.payload.message;
  }
  return fallback;
}

function workbookSourceEditRecoveryDetails(
  value: unknown,
): WorkbookSourceEditInvalidatesReferencesErrorResponseErrorDetails | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.summary !== "string" ||
    typeof value.recoveryAction !== "string" ||
    !Array.isArray(value.affectedInsertedValues)
  ) {
    return null;
  }
  const affectedInsertedValues = value.affectedInsertedValues.map((item) => {
    if (
      !isRecord(item) ||
      typeof item.label !== "string" ||
      typeof item.problem !== "string"
    ) {
      return null;
    }
    return {
      label: item.label,
      problem: item.problem,
    };
  });
  if (affectedInsertedValues.some((item) => item === null)) {
    return null;
  }
  return {
    affectedInsertedValues: affectedInsertedValues.filter(
      (item): item is { label: string; problem: string } => item !== null,
    ),
    recoveryAction: value.recoveryAction,
    summary: value.summary,
  };
}

function containsInternalRecoveryCopy(value: string): boolean {
  return (
    /\b(?:sourceDocumentId|sourceRevisionId|sourceArtifactId|workbookId|referenceId)\b/u.test(
      value,
    ) ||
    /\bworkbook:/u.test(value) ||
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/iu.test(
      value,
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
