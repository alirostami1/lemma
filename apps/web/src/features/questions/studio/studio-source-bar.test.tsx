// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StudioSourceBar } from "./source/studio-source-bar";

describe("StudioSourceBar", () => {
  it("shows source loading state while the source loads", () => {
    render(
      <StudioSourceBar
        sourceCard={{
          status: "loading",
          title: "Loading source",
          description: "Loading attached source.",
          activeSourceId: null,
          canRemove: true,
        }}
        onAddSource={() => {}}
        onChangeSource={() => {}}
        onRemoveSource={() => {}}
      />,
    );

    expect(screen.getByText("Loading source")).toBeTruthy();
    expect(screen.getByText("Loading attached source.")).toBeTruthy();
  });
});
