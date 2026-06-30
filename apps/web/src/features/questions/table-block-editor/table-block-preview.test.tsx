// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  TableAnswerState,
  TableBlockPreviewModel,
} from "#/domains/questions/authoring";
import { TableBlockPreview } from "./table-block-preview";

describe("TableBlockPreview", () => {
  afterEach(() => cleanup());

  it("gives answer inputs accessible names and unique field names", () => {
    const model = createPreviewModel();

    render(
      <TableBlockPreview answer={{}} model={model} onAnswerChange={() => {}} />,
    );

    const first = screen.getByRole("textbox", {
      name: "Student answer (Row 1, Column 2)",
    });
    const second = screen.getByRole("textbox", {
      name: "Amount (Row 2, Column 1)",
    });

    expect(first).toHaveAttribute("name", "answer_1");
    expect(second).toHaveAttribute("name", "answer_2");
    expect(screen.queryByText("answer_1")).toBeNull();
    expect(screen.queryByText("answer_2")).toBeNull();
  });

  it("renders every cell primitive in its stored order", () => {
    const model: TableBlockPreviewModel = {
      cells: [
        {
          blocks: [
            {
              content: [{ text: "Before", type: "text" }],
              id: "text_1",
              type: "text",
            },
            { id: "input_1", responseFieldId: "answer_1", type: "input" },
            {
              content: {
                content: [
                  {
                    content: [{ text: "Rich", type: "text" }],
                    type: "paragraph",
                  },
                ],
                type: "doc",
              },
              id: "rich_1",
              type: "rich_text",
            },
            { id: "separator_1", type: "separator" },
            {
              content: [{ text: "After", type: "text" }],
              id: "text_2",
              type: "text",
            },
          ],
          columnId: "column_1",
          id: "cell_1",
          rowId: "row_1",
        },
      ],
      columns: [{ id: "column_1", label: "Column" }],
      prompt: "",
      responseFields: [{ id: "answer_1", type: "text" }],
      rows: [{ id: "row_1", label: "Row" }],
      showColumnNames: true,
      showRowNames: true,
    };

    const { container } = render(
      <TableBlockPreview answer={{}} model={model} onAnswerChange={() => {}} />,
    );
    const cell = container.querySelector("tbody td");
    if (!cell) {
      throw new Error("Expected rendered table cell.");
    }

    expect(
      Array.from(cell.childNodes).map((node) =>
        node.nodeType === Node.TEXT_NODE ? node.textContent : node.nodeName,
      ),
    ).toEqual(["Before", "DIV", "DIV", "HR", "After"]);
    expect(cell.querySelector("input")).not.toBeNull();
    expect(cell.textContent).toContain("Before");
    expect(cell.textContent).toContain("Rich");
    expect(cell.textContent).toContain("After");
  });

  it("keeps answer keys isolated and coerces values by field type", async () => {
    const user = userEvent.setup();
    const onAnswerChange = vi.fn();

    function Harness() {
      const [answer, setAnswer] = useState<TableAnswerState>({});
      return (
        <TableBlockPreview
          answer={answer}
          model={createPreviewModel()}
          onAnswerChange={(nextAnswer) => {
            setAnswer(nextAnswer);
            onAnswerChange(nextAnswer);
          }}
        />
      );
    }

    render(<Harness />);

    await user.type(
      screen.getByRole("textbox", { name: "Student answer (Row 1, Column 2)" }),
      "001",
    );
    await user.type(
      screen.getByRole("textbox", { name: "Amount (Row 2, Column 1)" }),
      "1.0",
    );

    expect(onAnswerChange).toHaveBeenCalledWith({
      answer_1: "001",
    });
    expect(onAnswerChange).toHaveBeenCalledWith({
      answer_1: "001",
      answer_2: 1,
    });
    expect(
      screen.getByRole("textbox", { name: "Student answer (Row 1, Column 2)" }),
    ).toHaveValue("001");
    expect(
      screen.getByRole("textbox", { name: "Amount (Row 2, Column 1)" }),
    ).toHaveValue("1");
  });

  it("preserves JSON answers as structured values", async () => {
    const user = userEvent.setup();
    const onAnswerChange = vi.fn();

    function Harness() {
      const [answer, setAnswer] = useState<TableAnswerState>({});
      return (
        <TableBlockPreview
          answer={answer}
          model={createPreviewModel()}
          onAnswerChange={(nextAnswer) => {
            setAnswer(nextAnswer);
            onAnswerChange(nextAnswer);
          }}
        />
      );
    }

    render(<Harness />);

    const payloadInput = screen.getByRole("textbox", {
      name: "Payload (Row 2, Column 2)",
    });
    await user.clear(payloadInput);
    fireEvent.change(payloadInput, {
      target: {
        value: '{"a":[1,true]}',
      },
    });

    expect(onAnswerChange).toHaveBeenCalledWith({
      answer_3: { a: [1, true] },
    });
  });
});

function createPreviewModel(): TableBlockPreviewModel {
  return {
    cells: [
      {
        blocks: [{ id: "input_1", responseFieldId: "answer_1", type: "input" }],
        columnId: "column_2",
        id: "cell_1",
        rowId: "row_1",
      },
      {
        blocks: [{ id: "input_2", responseFieldId: "answer_2", type: "input" }],
        columnId: "column_1",
        id: "cell_2",
        rowId: "row_2",
      },
      {
        blocks: [{ id: "input_3", responseFieldId: "answer_3", type: "input" }],
        columnId: "column_2",
        id: "cell_3",
        rowId: "row_2",
      },
    ],
    columns: [
      { id: "column_1", label: "Column 1" },
      { id: "column_2", label: "Column 2" },
    ],
    prompt: "Prompt",
    responseFields: [
      {
        id: "answer_1",
        label: "Student answer",
        required: true,
        type: "text",
      },
      {
        id: "answer_2",
        label: "Amount",
        required: true,
        type: "number",
      },
      {
        id: "answer_3",
        label: "Payload",
        required: true,
        type: "text",
      },
    ],
    rows: [
      { id: "row_1", label: "Row 1" },
      { id: "row_2", label: "Row 2" },
    ],
    showColumnNames: true,
    showRowNames: true,
  };
}
