import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { openapi } from "./openapi.ts";

describe("questions OpenAPI contract", () => {
  it("wires workbook source edit recovery conflicts only to source edit routes", () => {
    assert.equal(
      responseRefFor(
        "/question-blueprint-drafts/{draftId}/sources/{sourceId}/file",
        "post",
        "409",
      ),
      "#/components/responses/QuestionBlueprintDraftSourceConflict",
    );
    assert.equal(
      responseRefFor(
        "/question-blueprint-drafts/{draftId}/sources/{sourceId}/revisions",
        "post",
        "409",
      ),
      "#/components/responses/QuestionBlueprintDraftSourceConflict",
    );
    assert.equal(
      responseRefFor(
        "/question-blueprint-drafts/{draftId}/discard",
        "post",
        "409",
      ),
      "#/components/responses/Conflict",
    );
    assert.equal(
      responseRefFor("/question-blueprint-drafts/{draftId}", "patch", "409"),
      "#/components/responses/Conflict",
    );
    assert.equal(
      openapi.components?.responses?.WorkbookSourceEditInvalidatesReferences,
      undefined,
    );
  });

  it("keeps the source edit conflict response as generic conflict plus recovery details", () => {
    const sourceConflict =
      openapi.components?.responses?.QuestionBlueprintDraftSourceConflict;
    assert.deepEqual(sourceConflict, {
      content: {
        "application/json": {
          schema: {
            $ref: "#/components/schemas/QuestionBlueprintDraftSourceConflictResponse",
          },
        },
      },
      description: "Question blueprint draft source conflict.",
    });

    const sourceConflictSchema =
      openapi.components?.schemas?.QuestionBlueprintDraftSourceConflictResponse;
    assert.deepEqual(sourceConflictSchema, {
      anyOf: [
        { $ref: "#/components/schemas/ErrorResponse" },
        {
          $ref: "#/components/schemas/WorkbookSourceEditInvalidatesReferencesErrorResponse",
        },
      ],
    });
  });
});

function responseRefFor(
  path: string,
  method: "patch" | "post",
  status: string,
) {
  assert.ok(openapi.paths, "missing OpenAPI paths");
  const pathItem = openapi.paths[path];
  assert.ok(pathItem, `missing OpenAPI path ${path}`);
  const operation = pathItem[method];
  assert.ok(operation, `missing OpenAPI operation ${method.toUpperCase()}`);
  const response = operation.responses?.[status];
  assert.ok(response, `missing ${status} response`);
  assert.ok("$ref" in response, `${status} response must be a component ref`);
  return response.$ref;
}
