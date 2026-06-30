// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
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

  it("renders actionable recovery without raw reference or source details", async () => {
    const user = userEvent.setup();
    const onModelChange = vi.fn();
    const model: ComposedEditorModel = {
      blocks: [
        {
          content: [{ referenceId: "workbook_source_1_A1", type: "reference" }],
          id: "text_1",
          type: "text",
        },
      ],
      references: [
        {
          id: "workbook_source_1_A1",
          source: {
            ref: "Sheet1!A1",
            sourceId: "source_internal_1",
            type: "workbook_cell",
          },
        },
      ],
      responseFields: [],
      schemaVersion: 1,
    };

    render(
      <InspectorPanel
        model={model}
        onModelChange={onModelChange}
        onSelectionChange={() => {}}
        referencePreviewCache={{}}
        referenceRecoveryItems={[
          {
            id: "recovery_1",
            referenceId: "workbook_source_1_A1",
            status: "unavailable",
            usage: {
              blockId: "text_1",
              inlineContentIndex: 0,
              type: "text_block",
            },
          },
        ]}
        selection={{ type: "document" }}
        sources={[]}
        workbookEnabled={false}
        workbookSheetNamesBySourceId={{}}
      />,
    );

    expect(screen.getByText("Inserted values need attention")).toBeTruthy();
    expect(screen.getByText("Text block 1 inserted value")).toBeTruthy();
    expect(screen.queryByText("workbook_source_1_A1")).toBeNull();
    expect(screen.queryByText("source_internal_1")).toBeNull();
    expect(screen.queryByText("{{ .workbook_source_1_A1 }}")).toBeNull();

    await user.click(
      screen.getByRole("button", { name: "Remove inserted value" }),
    );

    expect(onModelChange).toHaveBeenCalledWith({
      ...model,
      blocks: [{ content: [], id: "text_1", type: "text" }],
    });
  });

  it("removes only the selected inline occurrence from recovery", async () => {
    const user = userEvent.setup();
    const onModelChange = vi.fn();
    const model: ComposedEditorModel = {
      blocks: [
        {
          content: [
            { referenceId: "workbook_source_1_A1", type: "reference" },
            { referenceId: "workbook_source_1_A1", type: "reference" },
          ],
          id: "text_1",
          type: "text",
        },
      ],
      references: [
        {
          id: "workbook_source_1_A1",
          source: {
            ref: "Sheet1!A1",
            sourceId: "source_internal_1",
            type: "workbook_cell",
          },
        },
      ],
      responseFields: [],
      schemaVersion: 1,
    };

    render(
      <InspectorPanel
        model={model}
        onModelChange={onModelChange}
        onSelectionChange={() => {}}
        referencePreviewCache={{}}
        referenceRecoveryItems={[
          {
            id: "recovery_1",
            referenceId: "workbook_source_1_A1",
            status: "unavailable",
            usage: {
              blockId: "text_1",
              inlineContentIndex: 1,
              type: "text_block",
            },
          },
        ]}
        selection={{ type: "document" }}
        sources={[]}
        workbookEnabled={false}
        workbookSheetNamesBySourceId={{}}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Remove inserted value" }),
    );

    expect(onModelChange).toHaveBeenCalledWith({
      ...model,
      blocks: [
        {
          content: [{ referenceId: "workbook_source_1_A1", type: "reference" }],
          id: "text_1",
          type: "text",
        },
      ],
    });
  });

  it("selects affected table cells from recovery", async () => {
    const user = userEvent.setup();
    const onModelChange = vi.fn();
    const onSelectionChange = vi.fn();
    const model: ComposedEditorModel = {
      blocks: [
        {
          id: "table_1",
          table: {
            cells: [
              {
                columnId: "column_1",
                correctValueSource: {
                  referenceId: "workbook_source_1_A1",
                  type: "reference",
                },
                grading: { mode: "exact" },
                id: "cell_1",
                points: 1,
                responseFieldId: "answer_1",
                rowId: "row_1",
                type: "response",
              },
            ],
            columns: [{ id: "column_1", label: "Column 1" }],
            prompt: "",
            responseFields: [
              {
                id: "answer_1",
                label: "Answer",
                required: true,
                type: "number",
              },
            ],
            rows: [{ id: "row_1", label: "Row 1" }],
            showColumnNames: true,
            showRowNames: true,
          },
          type: "table",
        },
      ],
      references: [
        {
          id: "workbook_source_1_A1",
          source: {
            ref: "Sheet1!A1",
            sourceId: "source_internal_1",
            type: "workbook_cell",
          },
        },
      ],
      responseFields: [],
      schemaVersion: 1,
    };

    render(
      <InspectorPanel
        model={model}
        onModelChange={onModelChange}
        onSelectionChange={onSelectionChange}
        referencePreviewCache={{}}
        referenceRecoveryItems={[
          {
            id: "recovery_1",
            referenceId: "workbook_source_1_A1",
            status: "unavailable",
            usage: {
              blockId: "table_1",
              cellId: "cell_1",
              responseFieldId: "answer_1",
              type: "table_answer_cell",
            },
          },
        ]}
        selection={{ type: "document" }}
        sources={[]}
        workbookEnabled={false}
        workbookSheetNamesBySourceId={{}}
      />,
    );

    expect(screen.getByRole("button", { name: "Review area" })).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Use static value" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Remove inserted value" }),
    ).toBeNull();
    expect(
      screen.getByText("Open this answer and choose a replacement value."),
    ).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Review area" }));

    expect(onSelectionChange).toHaveBeenCalledWith({
      blockId: "table_1",
      cellId: "cell_1",
      type: "table_cell",
    });
    expect(onModelChange).not.toHaveBeenCalled();
  });

  it("selects standalone answer recovery without changing it to a blank static value", async () => {
    const user = userEvent.setup();
    const onModelChange = vi.fn();
    const onSelectionChange = vi.fn();
    const model: ComposedEditorModel = {
      blocks: [
        {
          correctValueSource: {
            referenceId: "workbook_source_1_A1",
            type: "reference",
          },
          grading: { mode: "exact" },
          id: "response_1",
          points: 1,
          responseFieldId: "answer_1",
          type: "response",
        },
      ],
      references: [
        {
          id: "workbook_source_1_A1",
          source: {
            ref: "Sheet1!A1",
            sourceId: "source_internal_1",
            type: "workbook_cell",
          },
        },
      ],
      responseFields: [
        {
          id: "answer_1",
          label: "Answer",
          required: true,
          type: "number",
        },
      ],
      schemaVersion: 1,
    };

    render(
      <InspectorPanel
        model={model}
        onModelChange={onModelChange}
        onSelectionChange={onSelectionChange}
        referencePreviewCache={{}}
        referenceRecoveryItems={[
          {
            id: "recovery_1",
            referenceId: "workbook_source_1_A1",
            status: "unavailable",
            usage: {
              blockId: "response_1",
              responseFieldId: "answer_1",
              type: "response_answer",
            },
          },
        ]}
        selection={{ type: "document" }}
        sources={[]}
        workbookEnabled={false}
        workbookSheetNamesBySourceId={{}}
      />,
    );

    expect(screen.getByRole("button", { name: "Review area" })).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Use static value" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Remove inserted value" }),
    ).toBeNull();

    await user.click(screen.getByRole("button", { name: "Review area" }));

    expect(onSelectionChange).toHaveBeenCalledWith({
      blockId: "response_1",
      type: "block",
    });
    expect(onModelChange).not.toHaveBeenCalled();
  });

  it("shows checking inserted values as waiting status without removal actions", async () => {
    const user = userEvent.setup();
    const onModelChange = vi.fn();
    const onSelectionChange = vi.fn();
    const model: ComposedEditorModel = {
      blocks: [
        {
          content: [{ referenceId: "workbook_source_1_A1", type: "reference" }],
          id: "text_1",
          type: "text",
        },
      ],
      references: [
        {
          id: "workbook_source_1_A1",
          source: {
            ref: "Sheet1!A1",
            sourceId: "source_internal_1",
            type: "workbook_cell",
          },
        },
      ],
      responseFields: [],
      schemaVersion: 1,
    };

    render(
      <InspectorPanel
        model={model}
        onModelChange={onModelChange}
        onSelectionChange={onSelectionChange}
        referencePreviewCache={{}}
        referenceRecoveryItems={[
          {
            id: "recovery_1",
            referenceId: "workbook_source_1_A1",
            status: "checking",
            usage: {
              blockId: "text_1",
              inlineContentIndex: 0,
              type: "text_block",
            },
          },
        ]}
        selection={{ type: "document" }}
        sources={[]}
        workbookEnabled={false}
        workbookSheetNamesBySourceId={{}}
      />,
    );

    expect(screen.getByText("Workbook values are still loading")).toBeTruthy();
    expect(
      screen.getByText("This workbook value is still being checked."),
    ).toBeTruthy();
    expect(screen.queryByText("Workbook value is unavailable.")).toBeNull();
    expect(screen.getByRole("button", { name: "Review area" })).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Remove inserted value" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Use static value" }),
    ).toBeNull();

    await user.click(screen.getByRole("button", { name: "Review area" }));

    expect(onSelectionChange).toHaveBeenCalledWith({
      blockId: "text_1",
      type: "block",
    });
    expect(onModelChange).not.toHaveBeenCalled();
  });

  it("keeps recovery issues out of the generic document readiness list", () => {
    const model: ComposedEditorModel = {
      blocks: [
        {
          content: [{ referenceId: "workbook_source_1_A1", type: "reference" }],
          id: "text_1",
          type: "text",
        },
      ],
      references: [
        {
          id: "workbook_source_1_A1",
          source: {
            ref: "Sheet1!A1",
            sourceId: "source_internal_1",
            type: "workbook_cell",
          },
        },
      ],
      responseFields: [],
      schemaVersion: 1,
    };

    render(
      <InspectorPanel
        documentIssues={[
          {
            id: "missing_answers",
            message: "Add at least one answer before generating.",
          },
        ]}
        model={model}
        onModelChange={() => {}}
        onSelectionChange={() => {}}
        referencePreviewCache={{}}
        referenceRecoveryItems={[
          {
            id: "recovery_1",
            referenceId: "workbook_source_1_A1",
            status: "unavailable",
            usage: {
              blockId: "text_1",
              inlineContentIndex: 0,
              type: "text_block",
            },
          },
        ]}
        selection={{ type: "document" }}
        sources={[]}
        workbookEnabled={false}
        workbookSheetNamesBySourceId={{}}
      />,
    );

    expect(screen.getByText("Inserted values need attention")).toBeTruthy();
    expect(screen.getByText("Text block 1 inserted value")).toBeTruthy();
    expect(
      screen.getByText("Add at least one answer before generating."),
    ).toBeTruthy();
    expect(
      screen.queryByText("Some inserted values need attention."),
    ).toBeNull();
  });
});
