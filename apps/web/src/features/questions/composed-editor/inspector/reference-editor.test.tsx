// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import { ReferenceEditor } from "./reference-editor";

describe("ReferenceEditor", () => {
  afterEach(() => cleanup());

  it("shows workbook source options in the reference editor", async () => {
    const user = userEvent.setup();

    render(
      <ReferenceEditor
        model={createModel()}
        referenceId="revenue"
        workbookEnabled={false}
        onModelChange={() => {}}
        onSelectionChange={() => {}}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "Source" }));
    expect(screen.getByRole("option", { name: "Literal value" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Workbook cell" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Workbook range" })).toBeTruthy();
  });
});

function createModel(): ComposedEditorModel {
  return {
    schemaVersion: 1,
    blocks: [],
    responseFields: [],
    references: [
      {
        id: "revenue",
        source: { type: "literal", value: 0 },
      },
    ],
  };
}
