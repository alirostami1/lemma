import { describe, expect, it } from "vitest";
import { AppApiError } from "#/api/errors";
import {
  ForbiddenRouteError,
  SignInRequiredRouteError,
} from "#/features/auth";
import { buildRouteErrorViewModel } from "./route-error-view-model";

function createApiError(status: number) {
  return new AppApiError({
    status,
    headers: new Headers(),
    body: null,
    payload: {
      code: `HTTP_${status}`,
      message: "API failed.",
      requestId: "request-1",
    },
  });
}

describe("route error view model", () => {
  it("classifies route auth errors first", () => {
    expect(buildRouteErrorViewModel(new SignInRequiredRouteError()).kind).toBe(
      "sign_in_required",
    );
    expect(buildRouteErrorViewModel(new ForbiddenRouteError()).kind).toBe(
      "forbidden",
    );
  });

  it("classifies API status errors", () => {
    expect(buildRouteErrorViewModel(createApiError(401)).kind).toBe(
      "sign_in_required",
    );
    expect(buildRouteErrorViewModel(createApiError(403)).kind).toBe(
      "forbidden",
    );
    expect(buildRouteErrorViewModel(createApiError(404)).kind).toBe(
      "not_found",
    );
  });

  it("includes request IDs and classifies unknown errors", () => {
    expect(buildRouteErrorViewModel(createApiError(403)).requestId).toBe(
      "request-1",
    );
    expect(buildRouteErrorViewModel(new Error("failed")).kind).toBe(
      "unexpected",
    );
  });
});
