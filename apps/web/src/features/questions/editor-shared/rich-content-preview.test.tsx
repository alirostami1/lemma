// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ComposedRichContent } from "#/domains/questions/authoring";
import { RichContentPreview } from "./rich-content-preview";

describe("RichContentPreview", () => {
  afterEach(() => cleanup());

  it("renders list marker classes for unordered and ordered lists", () => {
    const content: ComposedRichContent = {
      content: [
        {
          items: [
            {
              content: [
                {
                  content: [{ text: "Bullet", type: "text" }],
                  type: "paragraph",
                },
              ],
              type: "list_item",
            },
          ],
          type: "bullet_list",
        },
        {
          items: [
            {
              content: [
                {
                  content: [{ text: "Numbered", type: "text" }],
                  type: "paragraph",
                },
              ],
              type: "list_item",
            },
          ],
          type: "ordered_list",
        },
      ],
      type: "doc",
    };

    const { container } = render(<RichContentPreview content={content} />);

    expect(container.firstElementChild?.className).toContain("space-y-3");
    expect(container.querySelector("ul")?.className).toContain("list-disc");
    expect(container.querySelector("ul")?.className).toContain("space-y-0.5");
    expect(container.querySelector("ul")?.className).toContain("pl-6");
    expect(container.querySelector("ol")?.className).toContain("list-decimal");
  });
});
