import { describe, expect, it } from "vitest";
import { getStudioEditorReadinessViewModel } from "./studio-editor-readiness-view-model";
import type { StudioReadiness } from "./studio-readiness";

describe("studio editor readiness view model", () => {
  it("routes inserted value recovery issues away from generic document readiness", () => {
    const readiness: StudioReadiness = {
      canGenerate: false,
      canSave: false,
      issues: [
        {
          id: "inserted_value_unavailable_ref_1",
          locations: [
            {
              blockId: "text_1",
              inlineContentIndex: 0,
              type: "text_block",
            },
          ],
          message: "Some inserted values need attention.",
          severity: "error",
          target: { referenceId: "ref_1" },
        },
        {
          id: "missing_answers",
          message: "Add at least one answer before generating.",
          severity: "error",
        },
      ],
    };

    expect(getStudioEditorReadinessViewModel(readiness)).toEqual({
      documentIssues: [
        {
          id: "missing_answers",
          message: "Add at least one answer before generating.",
        },
      ],
      referenceRecoveryItems: [
        {
          id: "inserted_value_unavailable_ref_1_0",
          referenceId: "ref_1",
          status: "unavailable",
          usage: {
            blockId: "text_1",
            inlineContentIndex: 0,
            type: "text_block",
          },
        },
      ],
    });
  });

  it("keeps recovery items occurrence-exact for repeated inserted values", () => {
    const readiness: StudioReadiness = {
      canGenerate: false,
      canSave: false,
      issues: [
        {
          id: "inserted_value_unavailable_ref_1",
          locations: [
            {
              blockId: "text_1",
              inlineContentIndex: 0,
              type: "text_block",
            },
            {
              blockId: "text_1",
              inlineContentIndex: 2,
              type: "text_block",
            },
          ],
          message: "Some inserted values need attention.",
          severity: "error",
          target: { referenceId: "ref_1" },
        },
      ],
    };

    expect(
      getStudioEditorReadinessViewModel(readiness).referenceRecoveryItems.map(
        (item) => item.usage,
      ),
    ).toEqual([
      {
        blockId: "text_1",
        inlineContentIndex: 0,
        type: "text_block",
      },
      {
        blockId: "text_1",
        inlineContentIndex: 2,
        type: "text_block",
      },
    ]);
  });
});
