// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ComposedInlineContent,
  ComposedRenderedInlineContent,
} from "#/domains/questions/authoring";
import { InlineContentRenderer } from "./inline-content-renderer";

describe("InlineContentRenderer", () => {
  afterEach(() => cleanup());

  it("renders rendered preview value nodes as display values", () => {
    const content: ComposedRenderedInlineContent[] = [
      { text: "Revenue: ", type: "text" },
      { displayValue: "1200", referenceId: "revenue", type: "value" },
    ];

    const { container } = render(
      <InlineContentRenderer
        content={content}
        mode="preview"
        referencePreviewValues={{}}
      />,
    );

    expect(container.textContent).toBe("Revenue: 1200");
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText(/\{\{\s*\./u)).toBeNull();
    expectNoReferenceChip(container);
  });

  it("renders authoring references as chips while editing", () => {
    const content: ComposedInlineContent[] = [
      { text: "Revenue: ", type: "text" },
      { referenceId: "revenue", type: "reference" },
    ];

    render(
      <InlineContentRenderer
        content={content}
        mode="editing"
        referencePreviewValues={{
          revenue: {
            displayValue: "1200",
            rawValue: "1200",
            referenceId: "revenue",
            status: "resolved",
            updatedAt: 1,
          },
        }}
        references={[
          {
            id: "revenue",
            label: "Revenue",
            source: { type: "literal", value: "1200" },
          },
        ]}
      />,
    );

    expect(screen.getByText("Revenue")).toBeTruthy();
    expect(screen.queryByText("{{ .revenue }}")).toBeNull();
  });

  it("renders resolved authoring references as values in preview mode", () => {
    const content: ComposedInlineContent[] = [
      { text: "Revenue: ", type: "text" },
      { referenceId: "revenue", type: "reference" },
    ];

    const { container } = render(
      <InlineContentRenderer
        content={content}
        mode="preview"
        referencePreviewValues={{
          revenue: {
            displayValue: "1200",
            rawValue: "1200",
            referenceId: "revenue",
            status: "resolved",
            updatedAt: 1,
          },
        }}
      />,
    );

    expect(container.textContent).toBe("Revenue: 1200");
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText("revenue")).toBeNull();
    expect(screen.queryByText(/\{\{\s*\./u)).toBeNull();
    expectNoReferenceChip(container);
  });

  it("renders range cell authoring references as cell values in preview mode", () => {
    const content: ComposedInlineContent[] = [
      {
        rangeCell: { columnOffset: 0, rowOffset: 1 },
        referenceId: "range",
        type: "reference",
      },
    ];

    const { container } = render(
      <InlineContentRenderer
        content={content}
        mode="preview"
        referencePreviewValues={{
          range: {
            displayValue: "A1, B1",
            rawValue: [
              ["A1", "B1"],
              ["A2", "B2"],
            ],
            referenceId: "range",
            status: "resolved",
            updatedAt: 1,
          },
        }}
      />,
    );

    expect(container.textContent).toBe("A2");
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText("range")).toBeNull();
    expect(screen.queryByText(/\{\{\s*\./u)).toBeNull();
    expectNoReferenceChip(container);
  });

  it("renders range cell tokens as chips while editing", () => {
    const content: ComposedInlineContent[] = [
      {
        rangeCell: { columnOffset: 0, rowOffset: 1 },
        referenceId: "range",
        type: "reference",
      },
    ];

    render(
      <InlineContentRenderer
        content={content}
        mode="editing"
        referencePreviewValues={{}}
      />,
    );

    expect(screen.getByText("Added value unavailable")).toBeTruthy();
    expect(screen.queryByText("{{ .range[1,0] }}")).toBeNull();
  });

  it("renders missing authoring references with product-safe fallback in preview mode", () => {
    const content: ComposedInlineContent[] = [
      { text: "Revenue: ", type: "text" },
      { referenceId: "missing", type: "reference" },
    ];

    const { container } = render(
      <InlineContentRenderer
        content={content}
        mode="preview"
        referencePreviewValues={{}}
      />,
    );

    expect(container.textContent).toBe("Revenue: Added value unavailable");
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText("missing")).toBeNull();
    expect(screen.queryByText(/\{\{\s*\./u)).toBeNull();
    expectNoReferenceChip(container);
  });

  it("renders missing authoring references with product-safe chips while editing", () => {
    const content: ComposedInlineContent[] = [
      { referenceId: "missing", type: "reference" },
    ];

    render(
      <InlineContentRenderer
        content={content}
        mode="editing"
        referencePreviewValues={{}}
      />,
    );

    expect(screen.getByText("Added value unavailable")).toBeTruthy();
    expect(screen.queryByText(/\{\{\s*\./u)).toBeNull();
  });

  it("renders missing range cells without canonical fallback text", () => {
    const content: ComposedInlineContent[] = [
      {
        rangeCell: { columnOffset: 0, rowOffset: 1 },
        referenceId: "range",
        type: "reference",
      },
    ];

    const { container } = render(
      <InlineContentRenderer
        content={content}
        mode="preview"
        referencePreviewValues={{
          range: {
            displayValue: "A1, B1",
            rawValue: [["A1", "B1"]],
            referenceId: "range",
            status: "resolved",
            updatedAt: 1,
          },
        }}
      />,
    );

    expect(container.textContent).toBe("Added value unavailable");
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText("range")).toBeNull();
    expect(screen.queryByText("{{ .range[1,0] }}")).toBeNull();
    expectNoReferenceChip(container);
  });

  it("calls onSelectReference when an editing chip is clicked", () => {
    const onSelectReference = vi.fn();
    const content: ComposedInlineContent[] = [
      { referenceId: "revenue", type: "reference" },
    ];

    render(
      <InlineContentRenderer
        content={content}
        mode="editing"
        onSelectReference={onSelectReference}
        referencePreviewValues={{}}
      />,
    );

    screen.getByRole("button", { name: "Added value unavailable" }).click();

    expect(onSelectReference).toHaveBeenCalledWith("revenue");
  });
});

function expectNoReferenceChip(container: HTMLElement) {
  expect(container.querySelector(".font-mono")).toBeNull();
  expect(container.querySelector(".rounded-md.border")).toBeNull();
}
