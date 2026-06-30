// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import { ResponseBlockInspector } from "./response-block-inspector";

describe("ResponseBlockInspector", () => {
  afterEach(() => cleanup());

  it("shows a correct-answer repair editor for non-manual answers missing a source", () => {
    const model: ComposedEditorModel = {
      blocks: [
        {
          grading: { mode: "exact" },
          id: "response_1",
          points: 1,
          responseFieldId: "answer_1",
          type: "response",
        },
      ],
      references: [],
      responseFields: [
        {
          id: "answer_1",
          label: "Answer",
          required: true,
          type: "number",
        },
      ],
      schemaVersion: 2,
    };
    const block = model.blocks[0];
    if (block?.type !== "response") {
      throw new Error("Expected response block.");
    }

    render(
      <ResponseBlockInspector
        block={block}
        model={model}
        onModelChange={() => undefined}
        referencePreviewCache={{}}
        sources={[]}
        workbookEnabled={false}
        workbookSheetNamesBySourceId={{}}
      />,
    );

    expect(screen.getByText("Correct answer")).toBeTruthy();
    expect(screen.getByLabelText("Value")).toBeTruthy();
  });
});
