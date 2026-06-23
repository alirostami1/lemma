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
    expect(normalizeRichContent({ content: [], type: "doc" })).toEqual({
      content: [{ content: [], type: "paragraph" }],
      type: "doc",
    });
  });

  it("normalizes empty list items to empty paragraphs", () => {
    expect(
      normalizeRichContent({
        content: [
          {
            items: [{ content: [], type: "list_item" }],
            type: "bullet_list",
          },
        ],
        type: "doc",
      }),
    ).toEqual({
      content: [
        {
          items: [
            {
              content: [{ content: [], type: "paragraph" }],
              type: "list_item",
            },
          ],
          type: "bullet_list",
        },
      ],
      type: "doc",
    });
  });

  it("extracts and replaces references across nested lists", () => {
    const content: ComposedRichContent = {
      content: [
        {
          content: [{ referenceId: "top", type: "reference" }],
          type: "paragraph",
        },
        {
          items: [
            {
              content: [
                {
                  content: [{ referenceId: "child", type: "reference" }],
                  type: "paragraph",
                },
                {
                  items: [
                    {
                      content: [
                        {
                          content: [
                            { referenceId: "nested", type: "reference" },
                          ],
                          type: "paragraph",
                        },
                      ],
                      type: "list_item",
                    },
                    {
                      content: [],
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

    expect(extractRichReferenceIds(content)).toEqual([
      "top",
      "child",
      "nested",
    ]);
    expect(normalizeRichContent(content).content[1]).toMatchObject({
      items: [
        {
          content: [
            {},
            {
              items: [
                {},
                {
                  content: [{ content: [], type: "paragraph" }],
                },
              ],
              type: "ordered_list",
            },
          ],
        },
      ],
      type: "bullet_list",
    });
    expect(
      extractRichReferenceIds(
        replaceRichReferenceId(content, "nested", "next"),
      ),
    ).toEqual(["top", "child", "next"]);
  });

  it("converts simple rich content to inline content", () => {
    const inline = [
      { text: "Revenue: ", type: "text" as const },
      { referenceId: "revenue", type: "reference" as const },
    ];

    expect(
      inlineContentFromRichContentIfSimple(
        richContentFromInlineContent(inline),
      ),
    ).toEqual(inline);
  });

  it("renders references into plain-text fallback", () => {
    expect(
      richContentToPlainText(
        richContentFromInlineContent([
          { text: "Revenue: ", type: "text" },
          { fallbackText: "$10", referenceId: "revenue", type: "reference" },
        ]),
      ),
    ).toBe("Revenue: $10");
  });
});
