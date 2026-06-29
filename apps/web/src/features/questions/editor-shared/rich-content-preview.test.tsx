// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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

    const { container } = render(
      <RichContentPreview content={content} mode="preview" />,
    );

    expect(container.firstElementChild?.className).toContain("space-y-3");
    expect(container.querySelector("ul")?.className).toContain("list-disc");
    expect(container.querySelector("ul")?.className).toContain("space-y-0.5");
    expect(container.querySelector("ul")?.className).toContain("pl-6");
    expect(container.querySelector("ol")?.className).toContain("list-decimal");
  });

  it("renders resolved H1 and H2 references as plain content in preview mode", () => {
    const { container } = render(
      <RichContentPreview
        content={headingReferenceContent()}
        mode="preview"
        referencePreviewCache={referencePreviewCache()}
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Revenue 1200" }));
    expect(screen.getByRole("heading", { level: 2, name: "Margin 0.32" }));
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText(/\{\{\s*\./u)).toBeNull();
    expectNoReferenceChip(container);
  });

  it("renders rich text references as selectable chips in edit mode", () => {
    const onSelectReference = vi.fn();

    render(
      <RichContentPreview
        content={headingReferenceContent()}
        mode="editing"
        onSelectReference={onSelectReference}
        referencePreviewCache={referencePreviewCache()}
        references={[
          {
            id: "revenue",
            label: "Revenue value",
            source: { type: "literal", value: 1200 },
          },
          {
            id: "margin",
            label: "Margin value",
            source: { type: "literal", value: 0.32 },
          },
        ]}
      />,
    );

    screen.getByRole("button", { name: "Revenue value" }).click();

    expect(onSelectReference).toHaveBeenCalledWith("revenue");
    expect(screen.queryByText(/\{\{\s*\./u)).toBeNull();
  });

  it("uses product-safe copy for unresolved rich text references", () => {
    const { container } = render(
      <RichContentPreview
        content={{
          content: [
            {
              content: [
                { text: "Revenue ", type: "text" },
                { referenceId: "missing", type: "reference" },
              ],
              level: 1,
              type: "heading",
            },
            {
              content: [
                { text: "Margin ", type: "text" },
                { referenceId: "reference_1", type: "reference" },
              ],
              level: 2,
              type: "heading",
            },
            {
              content: [
                { text: "Source ", type: "text" },
                {
                  referenceId: "workbook:source_1:cell:Sheet1:A1",
                  type: "reference",
                },
              ],
              type: "paragraph",
            },
          ],
          type: "doc",
        }}
        mode="preview"
      />,
    );

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Revenue Added value unavailable",
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Margin Added value unavailable",
      }),
    ).toBeTruthy();
    expect(container.textContent).toContain("Source Added value unavailable");
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText("missing")).toBeNull();
    expect(screen.queryByText("reference_1")).toBeNull();
    expect(screen.queryByText("workbook:source_1:cell:Sheet1:A1")).toBeNull();
    expect(screen.queryByText(/\{\{\s*\./u)).toBeNull();
    expectNoReferenceChip(container);
  });
});

function expectNoReferenceChip(container: HTMLElement) {
  expect(container.querySelector(".font-mono")).toBeNull();
  expect(container.querySelector(".rounded-md.border")).toBeNull();
}

function headingReferenceContent(): ComposedRichContent {
  return {
    content: [
      {
        content: [
          { text: "Revenue ", type: "text" },
          { referenceId: "revenue", type: "reference" },
        ],
        level: 1,
        type: "heading",
      },
      {
        content: [
          { text: "Margin ", type: "text" },
          { referenceId: "margin", type: "reference" },
        ],
        level: 2,
        type: "heading",
      },
    ],
    type: "doc",
  };
}

function referencePreviewCache() {
  return {
    margin: {
      displayValue: "0.32",
      rawValue: 0.32,
      referenceId: "margin",
      status: "resolved" as const,
      updatedAt: 1,
    },
    revenue: {
      displayValue: "1200",
      rawValue: 1200,
      referenceId: "revenue",
      status: "resolved" as const,
      updatedAt: 1,
    },
  };
}
