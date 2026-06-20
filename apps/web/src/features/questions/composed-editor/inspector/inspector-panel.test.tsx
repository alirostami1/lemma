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
      schemaVersion: 1,
      blocks: [
        {
          id: "text_1",
          type: "text",
          content: [{ type: "reference", referenceId: "reference_1" }],
        },
      ],
      responseFields: [],
      references: [
        {
          id: "reference_1",
          source: { type: "literal", value: "alpha" },
        },
      ],
    };

    render(
      <InspectorPanel
        model={model}
        selection={{ type: "document" }}
        referencePreviewCache={{}}
        workbookEnabled={false}
        activeSourceId={null}
        onModelChange={() => {}}
        onSelectionChange={onSelectionChange}
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
      schemaVersion: 1,
      blocks: [
        {
          id: "text_1",
          type: "text",
          content: [{ type: "text", text: "Hello" }],
        },
      ],
      responseFields: [],
      references: [],
    };

    render(
      <InspectorPanel
        model={model}
        selection={{ type: "block", blockId: "text_1" }}
        referencePreviewCache={{}}
        workbookEnabled={false}
        activeSourceId={null}
        onModelChange={() => {}}
        onSelectionChange={() => {}}
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
      schemaVersion: 1,
      blocks: [],
      responseFields: [],
      references: [],
    };

    render(
      <InspectorPanel
        model={model}
        selection={{ type: "document" }}
        referencePreviewCache={{}}
        workbookEnabled={false}
        activeSourceId={null}
        stickyOffset={212}
        onModelChange={() => {}}
        onSelectionChange={() => {}}
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
