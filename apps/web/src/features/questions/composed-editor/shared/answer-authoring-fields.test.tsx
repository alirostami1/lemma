// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { InputPrimitive } from "#/domains/questions/authoring";
import { InputPrimitiveSettings } from "./answer-authoring-fields";

describe("InputPrimitiveSettings", () => {
  afterEach(() => cleanup());

  it("selects an option value that matches the old no-default sentinel", async () => {
    const user = userEvent.setup();
    const onInputChange = vi.fn<(input: InputPrimitive) => void>();

    render(
      <InputPrimitiveSettings
        input={{
          optionsSource: {
            type: "literal",
            value: [{ label: "Sentinel text", value: "**none**" }],
          },
          type: "select",
        }}
        onInputChange={onInputChange}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(
      await screen.findByRole("option", { name: "Sentinel text" }),
    );

    expect(onInputChange).toHaveBeenCalledWith({
      defaultValueSource: { type: "literal", value: "**none**" },
      optionsSource: {
        type: "literal",
        value: [{ label: "Sentinel text", value: "**none**" }],
      },
      type: "select",
    });
  });

  it("clears a select default without serializing a fake option value", async () => {
    const user = userEvent.setup();
    const onInputChange = vi.fn<(input: InputPrimitive) => void>();

    render(
      <InputPrimitiveSettings
        input={{
          defaultValueSource: { type: "literal", value: "**none**" },
          optionsSource: {
            type: "literal",
            value: [{ label: "Sentinel text", value: "**none**" }],
          },
          type: "select",
        }}
        onInputChange={onInputChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Clear" }));

    expect(onInputChange).toHaveBeenCalledWith({
      defaultValueSource: undefined,
      optionsSource: {
        type: "literal",
        value: [{ label: "Sentinel text", value: "**none**" }],
      },
      type: "select",
    });
  });
});
