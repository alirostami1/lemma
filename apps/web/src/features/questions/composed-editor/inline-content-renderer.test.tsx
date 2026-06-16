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
      { type: "text", text: "Revenue: " },
      { type: "value", referenceId: "revenue", displayValue: "1200" },
    ];

    render(
      <InlineContentRenderer
        content={content}
        mode="preview"
        referencePreviewValues={{}}
      />,
    );

    expect(screen.getByText("Revenue:")).toBeTruthy();
    expect(screen.getByText("1200")).toBeTruthy();
  });

  it("renders authoring references as chips while editing", () => {
    const content: ComposedInlineContent[] = [
      { type: "text", text: "Revenue: " },
      { type: "reference", referenceId: "revenue" },
    ];

    render(
      <InlineContentRenderer
        content={content}
        mode="editing"
        referencePreviewValues={{
          revenue: {
            referenceId: "revenue",
            status: "resolved",
            displayValue: "1200",
            rawValue: "1200",
            updatedAt: 1,
          },
        }}
      />,
    );

    expect(screen.getByText("{{ .revenue }}")).toBeTruthy();
  });

  it("renders resolved authoring references as values in preview mode", () => {
    const content: ComposedInlineContent[] = [
      { type: "text", text: "Revenue: " },
      { type: "reference", referenceId: "revenue" },
    ];

    render(
      <InlineContentRenderer
        content={content}
        mode="preview"
        referencePreviewValues={{
          revenue: {
            referenceId: "revenue",
            status: "resolved",
            displayValue: "1200",
            rawValue: "1200",
            updatedAt: 1,
          },
        }}
      />,
    );

    expect(screen.getByText("1200")).toBeTruthy();
  });

  it("renders range cell authoring references as cell values in preview mode", () => {
    const content: ComposedInlineContent[] = [
      {
        type: "reference",
        referenceId: "range",
        rangeCell: { rowOffset: 1, columnOffset: 0 },
      },
    ];

    render(
      <InlineContentRenderer
        content={content}
        mode="preview"
        referencePreviewValues={{
          range: {
            referenceId: "range",
            status: "resolved",
            displayValue: "A1, B1",
            rawValue: [
              ["A1", "B1"],
              ["A2", "B2"],
            ],
            updatedAt: 1,
          },
        }}
      />,
    );

    expect(screen.getByText("A2")).toBeTruthy();
  });

  it("renders range cell tokens as chips while editing", () => {
    const content: ComposedInlineContent[] = [
      {
        type: "reference",
        referenceId: "range",
        rangeCell: { rowOffset: 1, columnOffset: 0 },
      },
    ];

    render(
      <InlineContentRenderer
        content={content}
        mode="editing"
        referencePreviewValues={{}}
      />,
    );

    expect(screen.getByText("{{ .range[1,0] }}")).toBeTruthy();
  });

  it("calls onSelectReference when an editing chip is clicked", () => {
    const onSelectReference = vi.fn();
    const content: ComposedInlineContent[] = [
      { type: "reference", referenceId: "revenue" },
    ];

    render(
      <InlineContentRenderer
        content={content}
        mode="editing"
        referencePreviewValues={{}}
        onSelectReference={onSelectReference}
      />,
    );

    screen.getByRole("button", { name: "{{ .revenue }}" }).click();

    expect(onSelectReference).toHaveBeenCalledWith("revenue");
  });
});
