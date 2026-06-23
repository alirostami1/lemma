import { describe, expect, it } from "vitest";
import { AppApiError } from "#/api/errors";
import {
  getApiErrorCode,
  getApiErrorRequestId,
  getUserFacingApiErrorMessage,
  isForbiddenError,
  isNotFoundError,
  isUnauthorizedError,
} from "./api-error";

function createApiError(status: number) {
  return new AppApiError({
    body: null,
    headers: new Headers(),
    payload: {
      code: `HTTP_${status}`,
      message: `API message for ${status}`,
      requestId: "request-1",
    },
    status,
  });
}

describe("API error classification", () => {
  it("classifies authentication and access statuses", () => {
    expect(isUnauthorizedError(createApiError(401))).toBe(true);
    expect(isForbiddenError(createApiError(403))).toBe(true);
    expect(isNotFoundError(createApiError(404))).toBe(true);
  });

  it("extracts API metadata", () => {
    const error = createApiError(403);

    expect(getApiErrorCode(error)).toBe("HTTP_403");
    expect(getApiErrorRequestId(error)).toBe("request-1");
  });

  it("uses stable user-facing status messages", () => {
    expect(getUserFacingApiErrorMessage(createApiError(401))).toBe(
      "Sign in to continue.",
    );
    expect(getUserFacingApiErrorMessage(createApiError(403))).toBe(
      "You do not have access to this resource.",
    );
    expect(getUserFacingApiErrorMessage(createApiError(404))).toBe(
      "The requested item could not be found.",
    );
  });

  it("uses fallback for unknown errors", () => {
    expect(
      getUserFacingApiErrorMessage(new Error("internal"), "Try later."),
    ).toBe("Try later.");
  });
});
