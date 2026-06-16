import { AppApiError } from "#/api/errors";

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
