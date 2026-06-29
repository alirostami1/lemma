import { describe, expect, it } from "vitest";
import type { ComposedRichContent } from "./composed-model";
import {
  markdownToRichContent,
  markdownToRichContentForAuthoring,
  richContentToMarkdown,
  toggleMarkdownFormat,
} from "./rich-markdown";

describe("rich text markdown conversion", () => {
  it("round-trips paragraphs and inline references", () => {
    const content: ComposedRichContent = {
      content: [
        {
          content: [
            { text: "Revenue: ", type: "text" },
            { referenceId: "revenue", type: "reference" },
          ],
          type: "paragraph",
        },
      ],
      type: "doc",
    };

    expect(markdownToRichContent(richContentToMarkdown(content))).toEqual(
      content,
    );
  });

  it("parses headings", () => {
    expect(markdownToRichContent("## Heading")).toEqual({
      content: [
        {
          content: [{ text: "Heading", type: "text" }],
          level: 2,
          type: "heading",
        },
      ],
      type: "doc",
    });
  });

  it("normalizes unsupported heading levels to paragraphs", () => {
    expect(markdownToRichContent("#### Title")).toEqual({
      content: [
        {
          content: [{ text: "#### Title", type: "text" }],
          type: "paragraph",
        },
      ],
      type: "doc",
    });
  });

  it("round-trips bullet and ordered nested lists", () => {
    const content: ComposedRichContent = {
      content: [
        {
          items: [
            {
              content: [
                {
                  content: [{ text: "One", type: "text" }],
                  type: "paragraph",
                },
                {
                  items: [
                    {
                      content: [
                        {
                          content: [
                            {
                              referenceId: "nested",
                              type: "reference",
                            },
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

    expect(richContentToMarkdown(content)).toBe("- One\n  1. {{ .nested }}");
    expect(markdownToRichContent(richContentToMarkdown(content))).toEqual(
      content,
    );
  });

  it("keeps reference-like tokens as plain text for normal authoring", () => {
    expect(markdownToRichContentForAuthoring("{{ .revenue }}")).toEqual({
      content: [
        {
          content: [{ text: "{{ .revenue }}", type: "text" }],
          type: "paragraph",
        },
      ],
      type: "doc",
    });
  });
});

describe("rich text markdown toolbar", () => {
  it("toggles heading syntax on selected lines", () => {
    expect(
      toggleMarkdownFormat({
        format: "heading2",
        markdown: "Title",
        selectionEnd: 5,
        selectionStart: 0,
      }).markdown,
    ).toBe("## Title");
    expect(
      toggleMarkdownFormat({
        format: "heading2",
        markdown: "## Title",
        selectionEnd: 8,
        selectionStart: 0,
      }).markdown,
    ).toBe("Title");
  });

  it("toggles ordered and bullet list syntax", () => {
    expect(
      toggleMarkdownFormat({
        format: "orderedList",
        markdown: "One\nTwo",
        selectionEnd: 7,
        selectionStart: 0,
      }).markdown,
    ).toBe("1. One\n2. Two");
    expect(
      toggleMarkdownFormat({
        format: "bulletList",
        markdown: "1. One\n2. Two",
        selectionEnd: 14,
        selectionStart: 0,
      }).markdown,
    ).toBe("- One\n- Two");
  });
});
