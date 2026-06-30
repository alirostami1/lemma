import { describe, expect, it } from "vitest";
import { AppApiError } from "#/api/errors";
import type { QuestionBlueprintDraftSourceConflictResponse } from "#/api/generated/model";
import {
  getApiErrorCode,
  getApiErrorRequestId,
  getUserFacingApiErrorMessage,
  getWorkbookSourceEditRecoveryMessage,
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

function createRecoveryApiError(details: unknown) {
  return new AppApiError({
    body: null,
    headers: new Headers(),
    payload: {
      code: "WORKBOOK_SOURCE_EDIT_INVALIDATES_REFERENCES",
      details,
      message: "Some inserted values need attention.",
      requestId: "request-1",
    },
    status: 409,
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

  it("formats workbook source edit recovery details without internal ids", () => {
    const message = getWorkbookSourceEditRecoveryMessage(
      createRecoveryApiError({
        affectedInsertedValues: [
          {
            label: "Revenue total",
            problem: "The referenced cell is no longer available.",
          },
        ],
        recoveryAction:
          "Remove or replace the affected inserted values before saving this workbook.",
        summary: "Some inserted values need attention.",
      }),
    );

    expect(message).toContain("Revenue total");
    expect(message).toContain("The referenced cell is no longer available.");
    expect(message).not.toMatch(/workbook:|referenceId|workbookId/);
  });

  it("formats workbook editor save recovery details from the source conflict contract", () => {
    const response = {
      error: {
        code: "WORKBOOK_SOURCE_EDIT_INVALIDATES_REFERENCES",
        details: {
          affectedInsertedValues: [
            {
              label: "Forecast range",
              problem: "The referenced range is no longer available.",
            },
          ],
          recoveryAction:
            "Remove or replace the affected inserted values before saving this workbook.",
          summary: "Some inserted values need attention.",
        },
        message: "Some inserted values need attention.",
      },
    } satisfies QuestionBlueprintDraftSourceConflictResponse;

    const message = getWorkbookSourceEditRecoveryMessage(
      createRecoveryApiError(response.error.details),
    );

    expect(message).toContain("Some inserted values need attention.");
    expect(message).toContain(
      "Forecast range: The referenced range is no longer available.",
    );
    expect(message).not.toMatch(/workbook:|referenceId|workbookId|019e9315/);
  });

  it("hides typed recovery details if they include internal ids", () => {
    expect(
      getWorkbookSourceEditRecoveryMessage(
        createRecoveryApiError({
          affectedInsertedValues: [
            {
              label: "workbook:sourceA:cell:Sheet1:A1",
              problem: "sourceDocumentId leaked",
            },
          ],
          recoveryAction:
            "Remove or replace the affected inserted values before saving this workbook.",
          summary: "Some inserted values need attention.",
        }),
      ),
    ).toBe("Some inserted values need attention.");
  });
});
