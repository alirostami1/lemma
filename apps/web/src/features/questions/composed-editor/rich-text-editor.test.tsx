// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
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
  initialContent,
  onContentChange,
}: {
  initialContent?: ComposedRichContent;
  onContentChange?(content: ComposedRichContent): void;
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
      onChange={updateContent}
      referencePreviewCache={{
        tax_rate: {
          displayValue: "0.0825",
          rawValue: 0.0825,
          referenceId: "tax_rate",
          status: "resolved",
          updatedAt: 1,
        },
      }}
      value={content}
    />
  );
}
