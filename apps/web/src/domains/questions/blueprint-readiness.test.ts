import { describe, expect, it } from "vitest";
import type { ComposedEditorModel } from "./authoring";
import { getBlueprintReadinessIssues } from "./blueprint-readiness";

describe("blueprint readiness", () => {
  it("ignores unused workbook references when validating attached sources", () => {
    const issues = getBlueprintReadinessIssues({
      attachedSources: [
        {
          name: "Current workbook",
          sourceId: "source_current",
          type: "workbook",
          workbookId: "workbook_current",
        },
      ],
      model: {
        ...readyModel(),
        references: [
          {
            id: "unused_ref",
            source: {
              ref: "Sheet1!A1",
              sourceId: "source_detached",
              type: "workbook_cell",
            },
          },
        ],
      },
      name: "Blueprint",
    });

    expect(issues).not.toContainEqual(
      expect.objectContaining({ code: "invalid_reference_source" }),
    );
  });

  it("still validates attached sources for used workbook references", () => {
    const issues = getBlueprintReadinessIssues({
      attachedSources: [
        {
          name: "Current workbook",
          sourceId: "source_current",
          type: "workbook",
          workbookId: "workbook_current",
        },
      ],
      model: {
        ...readyModel(),
        blocks: [
          {
            content: [{ referenceId: "used_ref", type: "reference" }],
            id: "text_1",
            type: "text",
          },
          ...readyModel().blocks,
        ],
        references: [
          {
            id: "used_ref",
            source: {
              ref: "Sheet1!A1",
              sourceId: "source_detached",
              type: "workbook_cell",
            },
          },
        ],
      },
      name: "Blueprint",
    });

    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "invalid_reference_source",
        target: { referenceId: "used_ref" },
      }),
    );
  });
});

function readyModel(): ComposedEditorModel {
  return {
    blocks: [
      {
        correctValueSource: { type: "literal", value: "42" },
        grading: { mode: "exact" },
        id: "response_1",
        points: 1,
        responseFieldId: "answer_1",
        type: "response",
      },
    ],
    references: [],
    responseFields: [{ id: "answer_1", label: "Answer", type: "number" }],
    schemaVersion: 1,
  };
}
