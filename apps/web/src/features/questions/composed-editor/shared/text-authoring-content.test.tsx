// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import type {
  ComposedEditorModel,
  ComposedInlineContent,
} from "#/domains/questions/authoring";
import { WorkbookPickerProvider } from "#/features/questions/table-block-editor";
import { TextAuthoringContent } from "./text-authoring-content";

describe("TextAuthoringContent", () => {
  afterEach(() => cleanup());

  it("opens Add reference from the block-local text controls", async () => {
    const user = userEvent.setup();
    const model: ComposedEditorModel = {
      blocks: [],
      references: [],
      responseFields: [],
      schemaVersion: 1,
    };

    render(
      <WorkbookPickerProvider value={{ openWorkbookPicker: () => {} }}>
        <TextAuthoringContent
          content={[{ text: "Question", type: "text" }]}
          model={model}
          onChange={() => {}}
          onModelChange={() => {}}
          onSelectReference={() => {}}
          referencePreviewCache={{}}
          sources={[]}
          workbookEnabled={false}
          workbookSheetNamesBySourceId={{}}
        />
      </WorkbookPickerProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Add reference" }));

    expect(screen.getByRole("button", { name: /^Workbook/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Python/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Literal/ })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "References" })).toBeNull();
  });

  it("creates a literal with a human label without showing blueprint syntax", async () => {
    const user = userEvent.setup();
    let latestContent: ComposedInlineContent[] = [];

    render(
      <TextHarness onContentChange={(content) => (latestContent = content)} />,
    );

    await user.click(screen.getByRole("button", { name: "Add reference" }));
    await user.click(screen.getByRole("button", { name: /^Literal/ }));
    await user.type(screen.getByLabelText("Name"), "Tax rate");
    await user.type(screen.getByLabelText("Value"), "0.0825");
    expect(screen.queryByText(/Reference id/i)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Add this value" }));

    expect(screen.getByText("Tax rate")).toBeTruthy();
    expect(latestContent).toContainEqual({
      referenceId: "reference_1",
      type: "reference",
    });
    expect(screen.queryByText(/\{\{\s*\./u)).toBeNull();
    expectTextboxesNotToContainReferenceSyntax();
  });

  it("keeps an empty block editable after adding a value", async () => {
    const user = userEvent.setup();
    let latestContent: ComposedInlineContent[] = [];

    render(
      <TextHarness
        initialContent={[]}
        onContentChange={(content) => (latestContent = content)}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Add reference" }));
    await user.click(screen.getByRole("button", { name: /^Literal/ }));
    await user.type(screen.getByLabelText("Name"), "Tax rate");
    await user.type(screen.getByLabelText("Value"), "0.0825");
    await user.click(screen.getByRole("button", { name: "Add this value" }));

    expect(latestContent).toEqual([
      { referenceId: "reference_1", type: "reference" },
    ]);
    expect(screen.queryByText(/\{\{\s*\./u)).toBeNull();

    const afterChipSlot = getLastTextbox();
    fireEvent.change(afterChipSlot, {
      target: { value: " after" },
    });

    expect(latestContent).toEqual([
      { referenceId: "reference_1", type: "reference" },
      { text: " after", type: "text" },
    ]);
  });

  it("keeps a trailing added value editable after the chip", async () => {
    const user = userEvent.setup();
    let latestContent: ComposedInlineContent[] = [];

    render(
      <TextHarness onContentChange={(content) => (latestContent = content)} />,
    );

    await user.click(screen.getByRole("button", { name: "Add reference" }));
    await user.click(screen.getByRole("button", { name: /^Literal/ }));
    await user.type(screen.getByLabelText("Name"), "Tax rate");
    await user.type(screen.getByLabelText("Value"), "0.0825");
    await user.click(screen.getByRole("button", { name: "Add this value" }));

    const afterChipSlot = getLastTextbox();
    fireEvent.change(afterChipSlot, {
      target: { value: " more text" },
    });

    expect(latestContent).toEqual([
      { text: "Question ", type: "text" },
      { referenceId: "reference_1", type: "reference" },
      { text: " more text", type: "text" },
    ]);
    expect(screen.queryByText(/\{\{\s*\./u)).toBeNull();
  });

  it("preserves reference order when editing text before and after a reference", () => {
    let latestContent: ComposedInlineContent[] = [];

    render(
      <TextHarness
        initialContent={[
          { text: "A", type: "text" },
          { referenceId: "tax_rate", type: "reference" },
          { text: "B", type: "text" },
        ]}
        initialModel={modelWithTaxRate()}
        onContentChange={(content) => (latestContent = content)}
      />,
    );

    expect(screen.getByText("Tax rate")).toBeTruthy();
    expect(screen.queryByText(/\{\{\s*\./u)).toBeNull();

    fireEvent.change(screen.getByRole("textbox", { name: "Text segment 1" }), {
      target: { value: "A-edited" },
    });

    expect(latestContent).toEqual([
      { text: "A-edited", type: "text" },
      { referenceId: "tax_rate", type: "reference" },
      { text: "B", type: "text" },
    ]);

    fireEvent.change(screen.getByRole("textbox", { name: "Text segment 3" }), {
      target: { value: "B-edited" },
    });

    expect(latestContent).toEqual([
      { text: "A-edited", type: "text" },
      { referenceId: "tax_rate", type: "reference" },
      { text: "B-edited", type: "text" },
    ]);
    expect(screen.queryByText(/\{\{\s*\./u)).toBeNull();
  });

  it("keeps a standalone existing value editable after the chip", () => {
    let latestContent: ComposedInlineContent[] = [];

    render(
      <TextHarness
        initialContent={[{ referenceId: "tax_rate", type: "reference" }]}
        initialModel={modelWithTaxRate()}
        onContentChange={(content) => (latestContent = content)}
      />,
    );

    expect(screen.getByText("Tax rate")).toBeTruthy();
    expect(screen.getAllByRole("textbox").length).toBeGreaterThanOrEqual(2);

    fireEvent.change(getLastTextbox(), {
      target: { value: " after" },
    });

    expect(latestContent).toEqual([
      { referenceId: "tax_rate", type: "reference" },
      { text: " after", type: "text" },
    ]);
    expect(screen.queryByText(/\{\{\s*\./u)).toBeNull();
  });

  it("keeps focus while typing into a virtual slot after a value chip", async () => {
    const user = userEvent.setup();
    let latestContent: ComposedInlineContent[] = [];

    render(
      <TextHarness
        initialContent={[{ referenceId: "tax_rate", type: "reference" }]}
        initialModel={modelWithTaxRate()}
        onContentChange={(content) => (latestContent = content)}
      />,
    );

    await user.type(getLastTextbox(), " after value");

    expect(latestContent).toEqual([
      { referenceId: "tax_rate", type: "reference" },
      { text: " after value", type: "text" },
    ]);
    expect(screen.getByText("Tax rate")).toBeTruthy();
    expect(screen.queryByText(/\{\{\s*\./u)).toBeNull();
  });

  it("keeps user-typed blueprint syntax as plain text", () => {
    let latestContent: ComposedInlineContent[] = [];

    render(
      <TextHarness onContentChange={(content) => (latestContent = content)} />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Text segment 1" }), {
      target: { value: "{{ .foo }}" },
    });

    expect(latestContent).toEqual([{ text: "{{ .foo }}", type: "text" }]);
    expect(latestContent.some((item) => item.type === "reference")).toBe(false);
    expect(screen.queryByText("Added value")).toBeNull();
  });

  it("reuses an existing value without showing blueprint syntax", async () => {
    const user = userEvent.setup();
    let latestContent: ComposedInlineContent[] = [];

    render(
      <TextHarness
        initialModel={modelWithTaxRate()}
        onContentChange={(content) => (latestContent = content)}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Add reference" }));
    await user.click(screen.getByRole("button", { name: /^Literal/ }));
    await user.click(screen.getByRole("button", { name: /Tax rate/ }));

    expect(screen.getByText("Tax rate")).toBeTruthy();
    expect(latestContent).toContainEqual({
      referenceId: "tax_rate",
      type: "reference",
    });
    expect(screen.queryByText(/\{\{\s*\./u)).toBeNull();
    expectTextboxesNotToContainReferenceSyntax();
  });
});

function TextHarness({
  initialContent,
  initialModel,
  onContentChange,
}: {
  initialContent?: ComposedInlineContent[];
  initialModel?: ComposedEditorModel;
  onContentChange?(content: ComposedInlineContent[]): void;
}) {
  const [model, setModel] = useState<ComposedEditorModel>(
    initialModel ?? {
      blocks: [],
      references: [],
      responseFields: [],
      schemaVersion: 1,
    },
  );
  const [content, setContent] = useState<ComposedInlineContent[]>([
    ...(initialContent ?? [{ text: "Question", type: "text" }]),
  ]);

  function updateContent(nextContent: ComposedInlineContent[]) {
    setContent(nextContent);
    onContentChange?.(nextContent);
  }

  return (
    <WorkbookPickerProvider value={{ openWorkbookPicker: () => {} }}>
      <TextAuthoringContent
        content={content}
        model={model}
        onChange={updateContent}
        onCreatedReference={({ nextContent, nextModel }) => {
          setModel(nextModel);
          updateContent(nextContent);
        }}
        onModelChange={setModel}
        onSelectReference={() => {}}
        referencePreviewCache={{
          tax_rate: {
            displayValue: "0.0825",
            rawValue: 0.0825,
            referenceId: "tax_rate",
            status: "resolved",
            updatedAt: 1,
          },
        }}
        sources={[]}
        workbookEnabled={false}
        workbookSheetNamesBySourceId={{}}
      />
    </WorkbookPickerProvider>
  );
}

function getLastTextbox() {
  const textboxes = screen.getAllByRole("textbox");
  const textbox = textboxes.at(-1);
  if (!textbox) {
    throw new Error("Expected at least one text box");
  }
  return textbox;
}

function expectTextboxesNotToContainReferenceSyntax() {
  for (const textbox of screen.getAllByRole("textbox")) {
    expect(textbox).not.toHaveValue(expect.stringMatching(/\{\{\s*\./u));
  }
}

function modelWithTaxRate(): ComposedEditorModel {
  return {
    blocks: [],
    references: [
      {
        id: "tax_rate",
        label: "Tax rate",
        source: { type: "literal", value: 0.0825 },
      },
    ],
    responseFields: [],
    schemaVersion: 1,
  };
}
