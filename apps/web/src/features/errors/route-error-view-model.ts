import { ForbiddenRouteError, SignInRequiredRouteError } from "#/features/auth";
import {
  getApiErrorRequestId,
  isForbiddenError,
  isNotFoundError,
  isUnauthorizedError,
} from "#/lib/errors/api-error";

export type RouteErrorKind =
  | "sign_in_required"
  | "forbidden"
  | "not_found"
  | "unexpected";

export type RouteErrorViewModel = {
  kind: RouteErrorKind;
  title: string;
  description: string;
  requestId: string | null;
};

export function buildRouteErrorViewModel(error: unknown): RouteErrorViewModel {
  const requestId = getApiErrorRequestId(error);

  if (error instanceof SignInRequiredRouteError || isUnauthorizedError(error)) {
    return {
      description: "Sign in to continue.",
      kind: "sign_in_required",
      requestId,
      title: "Sign in required",
    };
  }
  if (error instanceof ForbiddenRouteError || isForbiddenError(error)) {
    return {
      description: "You do not have access to this resource.",
      kind: "forbidden",
      requestId,
      title: "Access denied",
    };
  }
  if (isNotFoundError(error)) {
    return {
      description: "The requested item could not be found.",
      kind: "not_found",
      requestId,
      title: "Not found",
    };
  }
  return {
    description: "The page could not be loaded.",
    kind: "unexpected",
    requestId,
    title: "Something went wrong",
  };
}
