// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ComposedRichContent } from "#/domains/questions/authoring";
import { RichContentPreview } from "./rich-content-preview";

describe("RichContentPreview", () => {
  afterEach(() => cleanup());

  it("renders list marker classes for unordered and ordered lists", () => {
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
                  content: [{ type: "text", text: "Bullet" }],
                },
              ],
            },
          ],
        },
        {
          type: "ordered_list",
          items: [
            {
              type: "list_item",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Numbered" }],
                },
              ],
            },
          ],
        },
      ],
    };

    const { container } = render(<RichContentPreview content={content} />);

    expect(container.firstElementChild?.className).toContain("space-y-3");
    expect(container.querySelector("ul")?.className).toContain("list-disc");
    expect(container.querySelector("ul")?.className).toContain("space-y-0.5");
    expect(container.querySelector("ul")?.className).toContain("pl-6");
    expect(container.querySelector("ol")?.className).toContain("list-decimal");
  });
});
