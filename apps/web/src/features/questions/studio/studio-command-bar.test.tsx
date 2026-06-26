// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StudioCommandBar } from "./studio-command-bar";

describe("StudioCommandBar", () => {
  it("uses product copy for save and publish controls", () => {
    render(
      <StudioCommandBar
        blueprintDescription=""
        blueprintName="Blueprint"
        canGenerate={false}
        canRedo={false}
        canUndo={false}
        generateDisabledReason="Publish before generating questions."
        isPublishing={false}
        isSaving={false}
        onBlueprintDescriptionChange={vi.fn()}
        onBlueprintNameChange={vi.fn()}
        onOpenPublishDialog={vi.fn()}
        onOpenSavedBlueprints={vi.fn()}
        onRedo={vi.fn()}
        onReloadLatestDraft={vi.fn()}
        onReset={vi.fn()}
        onSaveDraft={vi.fn()}
        onUndo={vi.fn()}
        routeSearch={{ draftId: "draft-1" }}
        saveConflict={null}
        saveError={null}
        saveState="saved"
      />,
    );

    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
    expect(screen.getByText("Changes saved")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save draft" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Publish draft" }),
    ).not.toBeInTheDocument();
  });
});
