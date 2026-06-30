// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import { EditorAttentionDisclosure } from "./editor-attention-disclosure";
import type { DocumentReadinessIssue } from "./inspector/document-readiness-issue";
import type { ReferenceRecoveryItem } from "./inspector/reference-recovery-panel";

const referenceId = "reference_internal_1";
const hiddenDetails = [
  referenceId,
  "source_internal_1",
  "workbook_internal_1",
  "sourceDocumentId_internal_1",
  "sourceRevisionId_internal_1",
  "sourceArtifactId_internal_1",
  "{{ .hidden_value }}",
] as const;

describe("EditorAttentionDisclosure", () => {
  afterEach(() => cleanup());

  it("keeps recovery details compact and hides internal identifiers", async () => {
    const user = userEvent.setup();
    const model = createInlineRecoveryModel();

    renderAttention({ model, recoveryItems: [inlineRecoveryItem()] });

    expect(screen.getByText("Needs review")).toBeInTheDocument();
    expect(screen.getByText("1 item before publishing.")).toBeInTheDocument();
    expect(screen.queryByText("Inserted values need attention")).toBeNull();
    expect(
      screen.queryByRole("complementary", { name: "Element settings" }),
    ).toBeNull();

    await user.click(screen.getByRole("button", { name: "Review" }));

    expect(screen.getByText("Inserted values need attention")).toBeVisible();
    expect(screen.getByText("Text block 1 inserted value")).toBeVisible();
    for (const detail of hiddenDetails) {
      expect(document.body.textContent).not.toContain(detail);
    }
  });

  it("removes only the targeted repeated inserted value", async () => {
    const user = userEvent.setup();
    const onModelChange = vi.fn();
    const model = createInlineRecoveryModel(2);

    renderAttention({
      model,
      onModelChange,
      recoveryItems: [inlineRecoveryItem(1)],
    });
    await user.click(screen.getByRole("button", { name: "Review" }));
    await user.click(
      screen.getByRole("button", { name: "Remove inserted value" }),
    );

    expect(onModelChange).toHaveBeenCalledWith({
      ...model,
      blocks: [
        {
          content: [{ referenceId, type: "reference" }],
          id: "text_1",
          type: "text",
        },
      ],
    });
  });

  it("reviews a table answer cell without changing the model", async () => {
    const user = userEvent.setup();
    const onModelChange = vi.fn();
    const onSelectionChange = vi.fn();
    const model = createTableAnswerRecoveryModel();

    renderAttention({
      model,
      onModelChange,
      onSelectionChange,
      recoveryItems: [
        {
          id: "recovery_1",
          referenceId,
          status: "unavailable",
          usage: {
            blockId: "table_1",
            cellId: "cell_1",
            cellBlockId: "input_1",
            responseFieldId: "answer_1",
            type: "table_answer_cell",
          },
        },
      ],
    });
    await user.click(screen.getByRole("button", { name: "Review" }));
    await user.click(screen.getByRole("button", { name: "Review area" }));

    expect(onSelectionChange).toHaveBeenCalledWith({
      blockId: "table_1",
      cellId: "cell_1",
      type: "table_cell",
    });
    expect(onModelChange).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "Remove inserted value" }),
    ).toBeNull();
  });

  it("reviews a standalone answer without replacing its value", async () => {
    const user = userEvent.setup();
    const onModelChange = vi.fn();
    const onSelectionChange = vi.fn();
    const model = createResponseRecoveryModel();

    renderAttention({
      model,
      onModelChange,
      onSelectionChange,
      recoveryItems: [
        {
          id: "recovery_1",
          referenceId,
          status: "unavailable",
          usage: {
            blockId: "response_1",
            responseFieldId: "answer_1",
            type: "response_answer",
          },
        },
      ],
    });
    await user.click(screen.getByRole("button", { name: "Review" }));
    await user.click(screen.getByRole("button", { name: "Review area" }));

    expect(onSelectionChange).toHaveBeenCalledWith({
      blockId: "response_1",
      type: "block",
    });
    expect(onModelChange).not.toHaveBeenCalled();
    expect(model.blocks[0]).toMatchObject({
      correctValueSource: { referenceId, type: "reference" },
    });
  });

  it("shows checking recovery as waiting without a destructive action", async () => {
    const user = userEvent.setup();

    renderAttention({
      model: createInlineRecoveryModel(),
      recoveryItems: [inlineRecoveryItem(0, "checking")],
    });
    await user.click(screen.getByRole("button", { name: "Review" }));

    expect(screen.getByText("Workbook values are still loading")).toBeVisible();
    expect(
      screen.getByText("This workbook value is still being checked."),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Remove inserted value" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Use static value" }),
    ).toBeNull();
  });

  it("keeps readiness and recovery details separate in one disclosure", async () => {
    const user = userEvent.setup();
    const documentIssues: DocumentReadinessIssue[] = [
      {
        id: "missing_answers",
        message: "Add at least one answer before publishing.",
      },
    ];

    renderAttention({
      documentIssues,
      model: createInlineRecoveryModel(),
      recoveryItems: [inlineRecoveryItem()],
    });

    expect(screen.getByText("2 items before publishing.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Review" }));

    expect(screen.getByText("Inserted values need attention")).toBeVisible();
    expect(screen.getByText("Blueprint checks")).toBeVisible();
    expect(
      screen.getByText("Add at least one answer before publishing."),
    ).toBeVisible();
    expect(screen.getAllByText("Text block 1 inserted value")).toHaveLength(1);
  });
});

function renderAttention({
  documentIssues,
  model,
  onModelChange = vi.fn(),
  onSelectionChange = vi.fn(),
  recoveryItems,
}: {
  documentIssues?: readonly DocumentReadinessIssue[];
  model: ComposedEditorModel;
  onModelChange?: (model: ComposedEditorModel) => void;
  onSelectionChange?: Parameters<
    typeof EditorAttentionDisclosure
  >[0]["onSelectionChange"];
  recoveryItems: readonly ReferenceRecoveryItem[];
}) {
  return render(
    <EditorAttentionDisclosure
      documentIssues={documentIssues}
      model={model}
      onModelChange={onModelChange}
      onSelectionChange={onSelectionChange}
      referenceRecoveryItems={recoveryItems}
    />,
  );
}

function inlineRecoveryItem(
  inlineContentIndex = 0,
  status: ReferenceRecoveryItem["status"] = "unavailable",
): ReferenceRecoveryItem {
  return {
    id: `recovery_${inlineContentIndex}`,
    referenceId,
    status,
    usage: {
      blockId: "text_1",
      inlineContentIndex,
      type: "text_block",
    },
  };
}

function createInlineRecoveryModel(occurrences = 1): ComposedEditorModel {
  return {
    blocks: [
      {
        content: Array.from({ length: occurrences }, () => ({
          referenceId,
          type: "reference" as const,
        })),
        id: "text_1",
        type: "text",
      },
    ],
    references: [workbookReference()],
    responseFields: [],
    schemaVersion: 2,
  };
}

function createResponseRecoveryModel(): ComposedEditorModel {
  return {
    blocks: [
      {
        correctValueSource: { referenceId, type: "reference" },
        grading: { mode: "exact" },
        id: "response_1",
        points: 1,
        responseFieldId: "answer_1",
        type: "response",
      },
    ],
    references: [workbookReference()],
    responseFields: [
      { id: "answer_1", label: "Answer", required: true, type: "number" },
    ],
    schemaVersion: 2,
  };
}

function createTableAnswerRecoveryModel(): ComposedEditorModel {
  return {
    blocks: [
      {
        id: "table_1",
        table: {
          cells: [
            {
              blocks: [
                {
                  correctValueSource: { referenceId, type: "reference" },
                  grading: { mode: "exact" },
                  id: "input_1",
                  points: 1,
                  responseFieldId: "answer_1",
                  type: "input",
                },
              ],
              columnId: "column_1",
              id: "cell_1",
              rowId: "row_1",
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
    references: [workbookReference()],
    responseFields: [],
    schemaVersion: 2,
  };
}

function workbookReference() {
  return {
    id: referenceId,
    source: {
      ref: hiddenDetails[6],
      sourceId: hiddenDetails.slice(1, 6).join(" "),
      type: "workbook_cell" as const,
    },
  };
}
