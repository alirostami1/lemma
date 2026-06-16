import {
  ForbiddenRouteError,
  SignInRequiredRouteError,
} from "#/features/auth";
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
      kind: "sign_in_required",
      title: "Sign in required",
      description: "Sign in to continue.",
      requestId,
    };
  }
  if (error instanceof ForbiddenRouteError || isForbiddenError(error)) {
    return {
      kind: "forbidden",
      title: "Access denied",
      description: "You do not have access to this resource.",
      requestId,
    };
  }
  if (isNotFoundError(error)) {
    return {
      kind: "not_found",
      title: "Not found",
      description: "The requested item could not be found.",
      requestId,
    };
  }
  return {
    kind: "unexpected",
    title: "Something went wrong",
    description: "The page could not be loaded.",
    requestId,
  };
}
