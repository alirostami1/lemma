// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ComposedEditorModel,
  InputPrimitive,
} from "#/domains/questions/authoring";
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

  it("updates required on the input primitive", async () => {
    const user = userEvent.setup();
    const onModelChange = vi.fn<(model: ComposedEditorModel) => void>();
    const model = responseInspectorModel({
      input: {
        type: "text",
        validation: { required: true },
      },
    });
    const block = model.blocks[0];
    if (block?.type !== "response") {
      throw new Error("Expected response block.");
    }

    render(
      <ResponseBlockInspector
        block={block}
        model={model}
        onModelChange={onModelChange}
        referencePreviewCache={{}}
        sources={[]}
        workbookEnabled={false}
        workbookSheetNamesBySourceId={{}}
      />,
    );

    await user.click(screen.getByRole("switch"));

    const nextModel = onModelChange.mock.calls.at(-1)?.[0];
    const nextBlock = nextModel?.blocks[0];
    expect(nextBlock).toMatchObject({
      input: { validation: { required: false } },
      type: "response",
    });
    expect(nextModel?.responseFields).toEqual([
      { id: "answer_1", label: "Answer", type: "text" },
    ]);
  });

  it("preserves primitive required when changing answer type", async () => {
    const user = userEvent.setup();
    const onModelChange = vi.fn<(model: ComposedEditorModel) => void>();
    const model = responseInspectorModel({
      input: {
        type: "text",
        validation: { required: false },
      },
    });
    const block = model.blocks[0];
    if (block?.type !== "response") {
      throw new Error("Expected response block.");
    }

    render(
      <ResponseBlockInspector
        block={block}
        model={model}
        onModelChange={onModelChange}
        referencePreviewCache={{}}
        sources={[]}
        workbookEnabled={false}
        workbookSheetNamesBySourceId={{}}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "Input type" }));
    await user.click(await screen.findByRole("option", { name: "Number" }));

    const nextModel = onModelChange.mock.calls.at(-1)?.[0];
    const nextBlock = nextModel?.blocks[0];
    expect(nextBlock).toMatchObject({
      input: { type: "number", validation: { required: false } },
      type: "response",
    });
  });
});

function responseInspectorModel(input: {
  input: InputPrimitive;
}): ComposedEditorModel {
  return {
    blocks: [
      {
        correctValueSource: { type: "literal", value: "" },
        grading: { mode: "exact" },
        id: "response_1",
        input: input.input,
        points: 1,
        responseFieldId: "answer_1",
        type: "response",
      },
    ],
    references: [],
    responseFields: [
      { id: "answer_1", label: "Answer", type: input.input.type },
    ],
    schemaVersion: 2,
  };
}
