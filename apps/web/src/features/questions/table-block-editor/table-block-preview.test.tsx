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
      <TableBlockPreview model={model} answer={{}} onAnswerChange={() => {}} />,
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

  it("keeps answer keys isolated and coerces values by field type", async () => {
    const user = userEvent.setup();
    const onAnswerChange = vi.fn();

    function Harness() {
      const [answer, setAnswer] = useState<TableAnswerState>({});
      return (
        <TableBlockPreview
          model={createPreviewModel()}
          answer={answer}
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
          model={createPreviewModel()}
          answer={answer}
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
    prompt: "Prompt",
    columns: [
      { id: "column_1", label: "Column 1" },
      { id: "column_2", label: "Column 2" },
    ],
    rows: [
      { id: "row_1", label: "Row 1" },
      { id: "row_2", label: "Row 2" },
    ],
    showColumnNames: true,
    showRowNames: true,
    responseFields: [
      {
        id: "answer_1",
        type: "text",
        label: "Student answer",
        required: true,
      },
      {
        id: "answer_2",
        type: "number",
        label: "Amount",
        required: true,
      },
      {
        id: "answer_3",
        type: "text",
        label: "Payload",
        required: true,
      },
    ],
    cells: [
      {
        id: "cell_1",
        rowId: "row_1",
        columnId: "column_2",
        type: "response",
        responseFieldId: "answer_1",
      },
      {
        id: "cell_2",
        rowId: "row_2",
        columnId: "column_1",
        type: "response",
        responseFieldId: "answer_2",
      },
      {
        id: "cell_3",
        rowId: "row_2",
        columnId: "column_2",
        type: "response",
        responseFieldId: "answer_3",
      },
    ],
  };
}
