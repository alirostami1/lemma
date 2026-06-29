// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { type ComponentProps, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComposedRichContent } from "#/domains/questions/authoring";
import { RichTextEditor } from "./rich-text-editor";

describe("RichTextEditor", () => {
  afterEach(() => cleanup());

  it("renders existing references without showing blueprint syntax or rich Add reference", () => {
    render(
      <RichTextHarness
        initialContent={{
          content: [
            {
              content: [
                { text: "Question ", type: "text" },
                { referenceId: "tax_rate", type: "reference" },
              ],
              type: "paragraph",
            },
          ],
          type: "doc",
        }}
      />,
    );

    expect(screen.getByText("0.0825")).toBeTruthy();
    expect(screen.queryByText(/\{\{\s*\./u)).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Add reference" })).toBeNull();
    expect(
      screen.getByText(
        "Rich text with added values is read-only in Studio for now. Use text, table, or answer blocks to add and edit values.",
      ),
    ).toBeTruthy();
  });

  it("does not move nested-list references because rich text with references is read-only", () => {
    const onContentChange = vi.fn();
    const initialContent: ComposedRichContent = {
      content: [
        {
          items: [
            {
              content: [
                {
                  content: [
                    { text: "First ", type: "text" },
                    { referenceId: "tax_rate", type: "reference" },
                  ],
                  type: "paragraph",
                },
                {
                  items: [
                    {
                      content: [
                        {
                          content: [
                            { text: "Nested ", type: "text" },
                            { referenceId: "tax_rate", type: "reference" },
                          ],
                          type: "paragraph",
                        },
                      ],
                      type: "list_item",
                    },
                  ],
                  type: "ordered_list",
                },
              ],
              type: "list_item",
            },
          ],
          type: "bullet_list",
        },
      ],
      type: "doc",
    };

    render(
      <RichTextHarness
        initialContent={initialContent}
        onContentChange={onContentChange}
      />,
    );

    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByText(/\{\{\s*\./u)).toBeNull();
    expect(onContentChange).not.toHaveBeenCalled();
  });

  it("renders H1 and H2 references as edit-mode chips without blueprint syntax", () => {
    const onSelectReference = vi.fn();

    render(
      <RichTextHarness
        initialContent={{
          content: [
            {
              content: [
                { text: "Tax ", type: "text" },
                { referenceId: "tax_rate", type: "reference" },
              ],
              level: 1,
              type: "heading",
            },
            {
              content: [
                { text: "Again ", type: "text" },
                { referenceId: "tax_rate", type: "reference" },
              ],
              level: 2,
              type: "heading",
            },
          ],
          type: "doc",
        }}
        onSelectReference={onSelectReference}
        references={[
          {
            id: "tax_rate",
            label: "Tax rate",
            source: { type: "literal", value: 0.0825 },
          },
        ]}
      />,
    );

    expect(screen.getAllByRole("button", { name: "Tax rate" })).toHaveLength(2);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByText(/\{\{\s*\./u)).toBeNull();

    screen.getAllByRole("button", { name: "Tax rate" })[0]?.click();

    expect(onSelectReference).toHaveBeenCalledWith("tax_rate");
  });

  it("renders unresolved rich text references with product-safe copy", () => {
    render(
      <RichTextHarness
        initialContent={{
          content: [
            {
              content: [{ referenceId: "missing", type: "reference" }],
              type: "paragraph",
            },
          ],
          type: "doc",
        }}
      />,
    );

    expect(screen.getByText("Added value unavailable")).toBeTruthy();
    expect(screen.queryByText("missing")).toBeNull();
    expect(screen.queryByText(/\{\{\s*\./u)).toBeNull();
  });

  it("does not render selectable reference chips when disabled", () => {
    const onSelectReference = vi.fn();

    render(
      <RichTextHarness
        disabled
        initialContent={{
          content: [
            {
              content: [
                { text: "Tax ", type: "text" },
                { referenceId: "tax_rate", type: "reference" },
              ],
              type: "paragraph",
            },
          ],
          type: "doc",
        }}
        onSelectReference={onSelectReference}
        references={[
          {
            id: "tax_rate",
            label: "Tax rate",
            source: { type: "literal", value: 0.0825 },
          },
        ]}
      />,
    );

    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByText(/\{\{\s*\./u)).toBeNull();
    expect(screen.queryByRole("button", { name: "Tax rate" })).toBeNull();
    expect(onSelectReference).not.toHaveBeenCalled();
  });

  it("keeps user-typed blueprint syntax as plain rich text", () => {
    const changes: ComposedRichContent[] = [];

    render(
      <RichTextHarness
        onContentChange={(content) => {
          changes.push(content);
        }}
      />,
    );

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "{{ .foo }}" },
    });

    expect(changes.at(-1)?.content[0]).toEqual({
      content: [{ text: "{{ .foo }}", type: "text" }],
      type: "paragraph",
    });
    expect(screen.queryByRole("button", { name: "Add reference" })).toBeNull();
  });
});

function RichTextHarness({
  disabled,
  initialContent,
  onContentChange,
  onSelectReference,
  references,
}: {
  disabled?: boolean;
  initialContent?: ComposedRichContent;
  onContentChange?(content: ComposedRichContent): void;
  onSelectReference?(referenceId: string): void;
  references?: ComponentProps<typeof RichTextEditor>["references"];
}) {
  const [content, setContent] = useState<ComposedRichContent>(
    initialContent ?? {
      content: [
        {
          content: [{ text: "Question", type: "text" }],
          type: "paragraph",
        },
      ],
      type: "doc",
    },
  );

  function updateContent(nextContent: ComposedRichContent) {
    setContent(nextContent);
    onContentChange?.(nextContent);
  }

  return (
    <RichTextEditor
      disabled={disabled}
      onChange={updateContent}
      onSelectReference={onSelectReference}
      referencePreviewCache={{
        tax_rate: {
          displayValue: "0.0825",
          rawValue: 0.0825,
          referenceId: "tax_rate",
          status: "resolved",
          updatedAt: 1,
        },
      }}
      references={references}
      value={content}
    />
  );
}
