// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import { InspectorPanel } from "./inspector-panel";

describe("InspectorPanel", () => {
  afterEach(() => cleanup());

  it("does not render persistent reference management", () => {
    const model: ComposedEditorModel = {
      blocks: [
        {
          content: [{ referenceId: "reference_1", type: "reference" }],
          id: "text_1",
          type: "text",
        },
      ],
      references: [
        {
          id: "reference_1",
          source: { type: "literal", value: "alpha" },
        },
      ],
      responseFields: [],
      schemaVersion: 1,
    };

    render(
      <InspectorPanel
        model={model}
        onModelChange={() => {}}
        onSelectionChange={() => {}}
        referencePreviewCache={{}}
        selection={{ type: "document" }}
        sources={[]}
        workbookEnabled={false}
        workbookSheetNamesBySourceId={{}}
      />,
    );

    expect(screen.queryByRole("tab", { name: "References" })).toBeNull();
    expect(screen.queryByText("Selected reference")).toBeNull();
    expect(screen.queryByRole("button", { name: "Add reference" })).toBeNull();
    expect(
      screen.getByRole("complementary", { name: "Element settings" }),
    ).toBeTruthy();
  });

  it("shows contextual element settings without block action duplicates", () => {
    const model: ComposedEditorModel = {
      blocks: [
        {
          content: [{ text: "Hello", type: "text" }],
          id: "text_1",
          type: "text",
        },
      ],
      references: [],
      responseFields: [],
      schemaVersion: 1,
    };

    render(
      <InspectorPanel
        model={model}
        onModelChange={() => {}}
        onSelectionChange={() => {}}
        referencePreviewCache={{}}
        selection={{ blockId: "text_1", type: "block" }}
        sources={[]}
        workbookEnabled={false}
        workbookSheetNamesBySourceId={{}}
      />,
    );

    expect(screen.getByText("Text")).toBeTruthy();
    expect(screen.getByText("No extra settings.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Move up" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Duplicate" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });

  it("sets a measured sticky offset for the settings panel", () => {
    const model: ComposedEditorModel = {
      blocks: [],
      references: [],
      responseFields: [],
      schemaVersion: 1,
    };

    render(
      <InspectorPanel
        model={model}
        onModelChange={() => {}}
        onSelectionChange={() => {}}
        referencePreviewCache={{}}
        selection={{ type: "document" }}
        sources={[]}
        stickyOffset={212}
        workbookEnabled={false}
        workbookSheetNamesBySourceId={{}}
      />,
    );

    const panel = screen.getByRole("complementary", {
      name: "Element settings",
    });

    expect(panel.style.getPropertyValue("--inspector-sticky-offset")).toBe(
      "212px",
    );
    expect(panel.style.top).toBe("212px");
    expect(panel.style.height).toBe("calc(100dvh - 212px)");
  });
});
