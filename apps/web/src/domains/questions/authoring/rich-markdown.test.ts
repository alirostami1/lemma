import { describe, expect, it } from "vitest";
import type { ComposedRichContent } from "./composed-model";
import {
  markdownToRichContent,
  richContentToMarkdown,
  toggleMarkdownFormat,
} from "./rich-markdown";

describe("rich text markdown conversion", () => {
  it("round-trips paragraphs and inline references", () => {
    const content: ComposedRichContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Revenue: " },
            { type: "reference", referenceId: "revenue" },
          ],
        },
      ],
    };

    expect(markdownToRichContent(richContentToMarkdown(content))).toEqual(
      content,
    );
  });

  it("parses headings", () => {
    expect(markdownToRichContent("## Heading")).toEqual({
      type: "doc",
      content: [
        {
          type: "heading",
          level: 2,
          content: [{ type: "text", text: "Heading" }],
        },
      ],
    });
  });

  it("normalizes unsupported heading levels to paragraphs", () => {
    expect(markdownToRichContent("#### Title")).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "#### Title" }],
        },
      ],
    });
  });

  it("round-trips bullet and ordered nested lists", () => {
    const content: ComposedRichContent = {
      type: "doc",
      content: [
        {
          type: "bullet_list",
          items: [
            {
              type: "list_item",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "One" }],
                },
                {
                  type: "ordered_list",
                  items: [
                    {
                      type: "list_item",
                      content: [
                        {
                          type: "paragraph",
                          content: [
                            {
                              type: "reference",
                              referenceId: "nested",
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(richContentToMarkdown(content)).toBe("- One\n  1. {{ .nested }}");
    expect(markdownToRichContent(richContentToMarkdown(content))).toEqual(
      content,
    );
  });
});

describe("rich text markdown toolbar", () => {
  it("toggles heading syntax on selected lines", () => {
    expect(
      toggleMarkdownFormat({
        markdown: "Title",
        selectionStart: 0,
        selectionEnd: 5,
        format: "heading2",
      }).markdown,
    ).toBe("## Title");
    expect(
      toggleMarkdownFormat({
        markdown: "## Title",
        selectionStart: 0,
        selectionEnd: 8,
        format: "heading2",
      }).markdown,
    ).toBe("Title");
  });

  it("toggles ordered and bullet list syntax", () => {
    expect(
      toggleMarkdownFormat({
        markdown: "One\nTwo",
        selectionStart: 0,
        selectionEnd: 7,
        format: "orderedList",
      }).markdown,
    ).toBe("1. One\n2. Two");
    expect(
      toggleMarkdownFormat({
        markdown: "1. One\n2. Two",
        selectionStart: 0,
        selectionEnd: 14,
        format: "bulletList",
      }).markdown,
    ).toBe("- One\n- Two");
  });
});
