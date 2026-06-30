import { describe, expect, it } from "vitest";
import {
  type ComposedEditorModel,
  createDefaultComposedEditorModel,
} from "#/domains/questions/authoring";
import {
  createStudioGuidedCreationViewModel,
  type StudioGuidedCreationViewModel,
} from "./studio-guided-creation";
import type { StudioReadiness } from "./studio-readiness";

describe("Studio guided creation view model", () => {
  it("treats Add reference as optional for a static blueprint", () => {
    const viewModel = createStudioGuidedCreationViewModel({
      model: createDefaultComposedEditorModel(),
      readiness: ready(),
      saveState: "unsaved",
    });

    expect(stepStatus(viewModel, "Add reference")).toBe("optional");
    expect(stepStatus(viewModel, "Review")).toBe("complete");
    expect(stepStatus(viewModel, "Save")).toBe("current");
  });

  it("does not complete Add reference from unused values", () => {
    const model: ComposedEditorModel = {
      ...createDefaultComposedEditorModel(),
      references: [
        {
          id: "unused_value",
          source: { type: "literal", value: "unused" },
        },
      ],
    };

    const viewModel = createStudioGuidedCreationViewModel({
      model,
      readiness: ready(),
      saveState: "unsaved",
    });

    expect(stepStatus(viewModel, "Add reference")).toBe("optional");
  });

  it("completes Add reference only when an added value is used", () => {
    const model: ComposedEditorModel = {
      ...createDefaultComposedEditorModel(),
      blocks: [
        {
          content: [{ referenceId: "used_value", type: "reference" }],
          id: "text_1",
          type: "text",
        },
        ...createDefaultComposedEditorModel().blocks.filter(
          (block) => block.type === "response",
        ),
      ],
      references: [
        {
          id: "used_value",
          source: { type: "literal", value: "shown" },
        },
      ],
    };

    const viewModel = createStudioGuidedCreationViewModel({
      model,
      readiness: ready(),
      saveState: "unsaved",
    });

    expect(stepStatus(viewModel, "Add reference")).toBe("complete");
  });

  it("does not treat saving as complete", () => {
    const viewModel = createStudioGuidedCreationViewModel({
      model: createDefaultComposedEditorModel(),
      readiness: ready(),
      saveState: "saving",
    });

    expect(stepStatus(viewModel, "Save")).toBe("current");
    expect(stepBody(viewModel, "Save")).toBe("Saving now.");
  });

  it("does not imply publishing is complete when work is saved", () => {
    const viewModel = createStudioGuidedCreationViewModel({
      model: createDefaultComposedEditorModel(),
      readiness: ready(),
      saveState: "saved",
    });

    expect(stepStatus(viewModel, "Save")).toBe("complete");
    expect(viewModel.steps.map((step) => step.title).join(" ")).not.toMatch(
      /publish/i,
    );
    expect(viewModel.steps.map((step) => step.body).join(" ")).not.toMatch(
      /publish/i,
    );
  });

  it("uses neutral saved callout copy instead of Next Save", () => {
    const viewModel = createStudioGuidedCreationViewModel({
      model: createDefaultComposedEditorModel(),
      readiness: ready(),
      saveState: "saved",
    });

    expect(viewModel.calloutTitle).toBe("Guided creation");
    expect(viewModel.calloutTitle).not.toBe("Next: Save");
    expect(viewModel.calloutBody).toBe(
      "Your blueprint is saved. Keep editing, or publish when you are ready.",
    );
    expect(viewModel.calloutBody).not.toMatch(
      /published|publishing complete|publish complete/i,
    );
  });

  it("emits at most one current step in conflicting state", () => {
    const viewModel = createStudioGuidedCreationViewModel({
      model: createDefaultComposedEditorModel(),
      readiness: {
        canGenerate: false,
        canSave: true,
        issues: [
          {
            id: "missing_blocks",
            message: "Add at least one block.",
            severity: "error",
          },
        ],
      },
      saveState: "saving",
    });

    const currentSteps = viewModel.steps.filter(
      (step) => step.status === "current",
    );

    expect(currentSteps).toHaveLength(1);
    expect(currentSteps[0]?.title).toBe("Blocks");
    expect(stepStatus(viewModel, "Save")).toBe("not_started");
  });

  it("keeps new guide copy free of implementation terms and future-feature copy", () => {
    const viewModel = createStudioGuidedCreationViewModel({
      model: createDefaultComposedEditorModel(),
      readiness: ready(),
      saveState: "unsaved",
    });
    const copy = [
      viewModel.calloutTitle,
      viewModel.calloutBody,
      ...viewModel.steps.flatMap((step) => [step.title, step.body]),
    ].join(" ");

    expect(copy).not.toMatch(
      /\bdraft\b|\bdraftId\b|\brevision\b|\bexpectedRevision\b|\bsourceId\b|\bfileId\b|\bworkbookId\b|\bsource binding\b|\bsource artifact\b|\breference ID\b|\broute intent\b|\bserver draft\b|\{\{\s*\.|\bPython\b/iu,
    );
  });
});

function stepStatus(viewModel: StudioGuidedCreationViewModel, title: string) {
  return viewModel.steps.find((step) => step.title === title)?.status;
}

function stepBody(viewModel: StudioGuidedCreationViewModel, title: string) {
  return viewModel.steps.find((step) => step.title === title)?.body;
}

function ready(): StudioReadiness {
  return {
    canGenerate: true,
    canSave: true,
    issues: [],
  };
}
