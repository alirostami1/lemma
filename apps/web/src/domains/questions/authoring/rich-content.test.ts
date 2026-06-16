import { describe, expect, it } from "vitest";
import type { ComposedRichContent } from "./composed-model";
import {
  extractRichReferenceIds,
  inlineContentFromRichContentIfSimple,
  normalizeRichContent,
  replaceRichReferenceId,
  richContentFromInlineContent,
  richContentToPlainText,
} from "./rich-content";

describe("rich content helpers", () => {
  it("normalizes empty documents to an empty paragraph", () => {
    expect(normalizeRichContent({ type: "doc", content: [] })).toEqual({
      type: "doc",
      content: [{ type: "paragraph", content: [] }],
    });
  });

  it("normalizes empty list items to empty paragraphs", () => {
    expect(
      normalizeRichContent({
        type: "doc",
        content: [
          {
            type: "bullet_list",
            items: [{ type: "list_item", content: [] }],
          },
        ],
      }),
    ).toEqual({
      type: "doc",
      content: [
        {
          type: "bullet_list",
          items: [
            {
              type: "list_item",
              content: [{ type: "paragraph", content: [] }],
            },
          ],
        },
      ],
    });
  });

  it("extracts and replaces references across nested lists", () => {
    const content: ComposedRichContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "reference", referenceId: "top" }],
        },
        {
          type: "bullet_list",
          items: [
            {
              type: "list_item",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "reference", referenceId: "child" }],
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
                            { type: "reference", referenceId: "nested" },
                          ],
                        },
                      ],
                    },
                    {
                      type: "list_item",
                      content: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(extractRichReferenceIds(content)).toEqual([
      "top",
      "child",
      "nested",
    ]);
    expect(normalizeRichContent(content).content[1]).toMatchObject({
      type: "bullet_list",
      items: [
        {
          content: [
            {},
            {
              type: "ordered_list",
              items: [
                {},
                {
                  content: [{ type: "paragraph", content: [] }],
                },
              ],
            },
          ],
        },
      ],
    });
    expect(
      extractRichReferenceIds(replaceRichReferenceId(content, "nested", "next")),
    ).toEqual(["top", "child", "next"]);
  });

  it("converts simple rich content to inline content", () => {
    const inline = [
      { type: "text" as const, text: "Revenue: " },
      { type: "reference" as const, referenceId: "revenue" },
    ];

    expect(
      inlineContentFromRichContentIfSimple(richContentFromInlineContent(inline)),
    ).toEqual(inline);
  });

  it("renders references into plain-text fallback", () => {
    expect(
      richContentToPlainText(
        richContentFromInlineContent([
          { type: "text", text: "Revenue: " },
          { type: "reference", referenceId: "revenue", fallbackText: "$10" },
        ]),
      ),
    ).toBe("Revenue: $10");
  });
});
