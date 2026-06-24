// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import { InspectorPanel } from "./inspector-panel";

describe("InspectorPanel", () => {
  afterEach(() => cleanup());

  it("renders tabs and opens the reference picker from the References tab", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
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
        onSelectionChange={onSelectionChange}
        referencePreviewCache={{}}
        selection={{ type: "document" }}
        sources={[]}
        workbookEnabled={false}
        workbookSheetNamesBySourceId={{}}
      />,
    );

    expect(screen.getByRole("tab", { name: "References" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Element" })).toBeTruthy();

    await user.click(screen.getByRole("tab", { name: "References" }));

    await user.click(screen.getByRole("button", { name: /reference_1/ }));
    expect(screen.getByText("Selected reference")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Add reference" }));
    expect(screen.getByLabelText("Reference id")).toBeTruthy();
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
      name: "Element and reference settings",
    });

    expect(panel.style.getPropertyValue("--inspector-sticky-offset")).toBe(
      "212px",
    );
    expect(panel.style.top).toBe("212px");
    expect(panel.style.height).toBe("calc(100dvh - 212px)");
  });
});
