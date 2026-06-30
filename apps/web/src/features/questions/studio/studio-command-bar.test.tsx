// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StudioCommandBar } from "./studio-command-bar";

describe("StudioCommandBar", () => {
  afterEach(() => cleanup());

  it("uses product copy for save and publish controls", () => {
    render(
      <StudioCommandBar
        blueprintDescription=""
        blueprintName="Blueprint"
        canRedo={false}
        canUndo={false}
        generationAction={{
          available: false,
          disabledReason: "Publish before generating questions.",
          onGenerate: null,
        }}
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
        saveConflict={null}
        saveError={null}
        saveState="saved"
      />,
    );

    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
    expect(screen.getAllByText("Changes saved").length).toBeGreaterThan(0);
    expect(
      screen.queryByRole("button", { name: "Save draft" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Publish draft" }),
    ).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(
      /draftId|sourceId|fileId|reference ID|route intent/u,
    );
  });

  it("keeps secondary actions and metadata hidden until requested", async () => {
    const user = userEvent.setup();
    const onOpenSavedBlueprints = vi.fn();
    const onRedo = vi.fn();
    const onUndo = vi.fn();

    render(
      <StudioCommandBar
        blueprintDescription="Short description"
        blueprintName="Blueprint"
        canRedo
        canUndo
        generationAction={{
          available: false,
          disabledReason: "Publish before generating questions.",
          onGenerate: null,
        }}
        isPublishing={false}
        isSaving={false}
        onBlueprintDescriptionChange={vi.fn()}
        onBlueprintNameChange={vi.fn()}
        onOpenPublishDialog={vi.fn()}
        onOpenSavedBlueprints={onOpenSavedBlueprints}
        onRedo={onRedo}
        onReloadLatestDraft={vi.fn()}
        onReset={vi.fn()}
        onSaveDraft={vi.fn()}
        onUndo={onUndo}
        saveConflict={null}
        saveError={null}
        saveState="saved"
      />,
    );

    expect(screen.queryByLabelText("Blueprint name")).toBeNull();
    expect(screen.queryByText("Short description")).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Undo" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Blueprint details" }));
    expect(screen.getByLabelText("Blueprint name")).toHaveValue("Blueprint");
    expect(screen.getByLabelText("Blueprint description")).toHaveValue(
      "Short description",
    );

    await user.click(
      screen.getByRole("button", { name: "More workspace actions" }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: "Saved blueprints" }),
    );

    expect(onOpenSavedBlueprints).toHaveBeenCalledTimes(1);

    await user.click(
      screen.getByRole("button", { name: "More workspace actions" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Undo" }));
    expect(onUndo).toHaveBeenCalledTimes(1);

    await user.click(
      screen.getByRole("button", { name: "More workspace actions" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Redo" }));
    expect(onRedo).toHaveBeenCalledTimes(1);
  });

  it("keeps unavailable actions inert and explains disabled generation", async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn();
    const onUndo = vi.fn();

    render(
      <StudioCommandBar
        blueprintDescription=""
        blueprintName="Blueprint"
        canRedo={false}
        canUndo={false}
        generationAction={{
          available: false,
          disabledReason: "Publish before generating questions.",
          onGenerate,
        }}
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
        onUndo={onUndo}
        saveConflict={null}
        saveError={null}
        saveState="saved"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "More workspace actions" }),
    );

    const undo = screen.getByRole("menuitem", { name: "Undo" });
    expect(undo).toHaveAttribute("data-disabled");
    await user.click(undo);
    expect(onUndo).not.toHaveBeenCalled();
    const generate = screen.getByRole("menuitem", { name: "Generate" });
    expect(generate).toHaveAttribute("data-disabled");
    expect(generate).toHaveAccessibleDescription(
      "Publish before generating questions.",
    );
    await user.click(generate);
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it("calls the provided generation action exactly once", async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn();

    render(
      <StudioCommandBar
        blueprintDescription=""
        blueprintName="Blueprint"
        canRedo={false}
        canUndo={false}
        generationAction={{
          available: true,
          disabledReason: null,
          onGenerate,
        }}
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
        saveConflict={null}
        saveError={null}
        saveState="saved"
      />,
    );

    expect(screen.queryByRole("button", { name: "Generate" })).toBeNull();
    await user.click(
      screen.getByRole("button", { name: "More workspace actions" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Generate" }));

    expect(onGenerate).toHaveBeenCalledTimes(1);
  });
});
