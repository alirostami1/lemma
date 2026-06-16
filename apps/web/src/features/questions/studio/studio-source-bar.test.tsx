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
          description: "Loading selected source.",
          canRemove: true,
        }}
        onAddSource={() => {}}
        onChangeSource={() => {}}
        onUploadSource={() => {}}
        onRemoveSource={() => {}}
      />,
    );

    expect(screen.getByText("Loading source")).toBeTruthy();
    expect(screen.getByText("Loading selected source.")).toBeTruthy();
  });
});
