// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SavedBlueprintsDialog } from "./saved-blueprints-dialog";
import type {
  SavedBlueprintListItem,
  SavedDraftListItem,
} from "./saved-blueprints-view-model";

const draftItems: SavedDraftListItem[] = [
  {
    description: "Draft body",
    id: "draft-1",
    metadata: "Draft | Updated 1 sec ago",
    title: "Draft one",
  },
];

const blueprintItems: SavedBlueprintListItem[] = [
  {
    description: "Blueprint body",
    id: "blueprint-1",
    metadata: "Published | Updated 1 sec ago",
    title: "Blueprint one",
  },
];

describe("saved blueprints dialog", () => {
  afterEach(() => {
    cleanup();
  });

  const openDialog = () => within(screen.getByRole("dialog", { name: "Open" }));

  it("renders draft and blueprint sections", () => {
    render(
      <SavedBlueprintsDialog
        blueprints={blueprintItems}
        draftLoadMoreErrorMessage={null}
        drafts={draftItems}
        draftsErrorMessage={null}
        errorMessage={null}
        hasMoreBlueprints={false}
        hasMoreDrafts={false}
        isDraftsInitialLoading={false}
        isInitialLoading={false}
        isLoadingBlueprintsMore={false}
        isLoadingDraftsMore={false}
        loadMoreErrorMessage={null}
        onGenerate={() => {}}
        onLoadMoreBlueprints={() => {}}
        onLoadMoreDrafts={() => {}}
        onOpenBlueprint={() => {}}
        onOpenChange={() => {}}
        onOpenDraft={() => {}}
        onRetry={() => {}}
        open
      />,
    );

    const dialog = openDialog();
    expect(dialog.getByRole("heading", { name: "Open" })).toBeTruthy();
    expect(dialog.getByRole("heading", { name: "Recent drafts" })).toBeTruthy();
    expect(
      dialog.getByRole("heading", { name: "Saved blueprints" }),
    ).toBeTruthy();
  });

  it("calls draft open callback without generate action", async () => {
    const user = userEvent.setup();
    const onOpenDraft = vi.fn();
    const onGenerate = vi.fn();

    render(
      <SavedBlueprintsDialog
        blueprints={blueprintItems}
        draftLoadMoreErrorMessage={null}
        drafts={draftItems}
        draftsErrorMessage={null}
        errorMessage={null}
        hasMoreBlueprints={false}
        hasMoreDrafts={false}
        isDraftsInitialLoading={false}
        isInitialLoading={false}
        isLoadingBlueprintsMore={false}
        isLoadingDraftsMore={false}
        loadMoreErrorMessage={null}
        onGenerate={onGenerate}
        onLoadMoreBlueprints={() => {}}
        onLoadMoreDrafts={() => {}}
        onOpenBlueprint={() => {}}
        onOpenChange={() => {}}
        onOpenDraft={onOpenDraft}
        onRetry={() => {}}
        open
      />,
    );

    const dialog = openDialog();
    await user.click(
      dialog.getByRole("button", { name: "Open draft Draft one" }),
    );
    expect(onOpenDraft).toHaveBeenCalledWith("draft-1");
    expect(
      dialog.queryByRole("button", { name: "Generate from Draft one" }),
    ).not.toBeInTheDocument();
  });

  it("calls blueprint open and generate callbacks", async () => {
    const user = userEvent.setup();
    const onOpenBlueprint = vi.fn();
    const onGenerate = vi.fn();

    render(
      <SavedBlueprintsDialog
        blueprints={blueprintItems}
        draftLoadMoreErrorMessage={null}
        drafts={draftItems}
        draftsErrorMessage={null}
        errorMessage={null}
        hasMoreBlueprints={false}
        hasMoreDrafts={false}
        isDraftsInitialLoading={false}
        isInitialLoading={false}
        isLoadingBlueprintsMore={false}
        isLoadingDraftsMore={false}
        loadMoreErrorMessage={null}
        onGenerate={onGenerate}
        onLoadMoreBlueprints={() => {}}
        onLoadMoreDrafts={() => {}}
        onOpenBlueprint={onOpenBlueprint}
        onOpenChange={() => {}}
        onOpenDraft={() => {}}
        onRetry={() => {}}
        open
      />,
    );

    const dialog = openDialog();
    await user.click(
      dialog.getByRole("button", { name: "Open blueprint Blueprint one" }),
    );
    expect(onOpenBlueprint).toHaveBeenCalledWith("blueprint-1");

    await user.click(
      dialog.getByRole("button", { name: "Generate from Blueprint one" }),
    );
    expect(onGenerate).toHaveBeenCalledWith("blueprint-1");
  });

  it("renders loading states for both sections", () => {
    render(
      <SavedBlueprintsDialog
        blueprints={[]}
        draftLoadMoreErrorMessage={null}
        drafts={[]}
        draftsErrorMessage={null}
        errorMessage={null}
        hasMoreBlueprints={false}
        hasMoreDrafts={false}
        isDraftsInitialLoading={true}
        isInitialLoading={true}
        isLoadingBlueprintsMore={false}
        isLoadingDraftsMore={false}
        loadMoreErrorMessage={null}
        onGenerate={() => {}}
        onLoadMoreBlueprints={() => {}}
        onLoadMoreDrafts={() => {}}
        onOpenBlueprint={() => {}}
        onOpenChange={() => {}}
        onOpenDraft={() => {}}
        onRetry={() => {}}
        open
      />,
    );

    const dialog = openDialog();
    expect(
      within(dialog.getByRole("region", { name: "Recent drafts" })).getByText(
        "Loading recent drafts...",
      ),
    ).toBeTruthy();
    expect(
      within(
        dialog.getByRole("region", { name: "Saved blueprints" }),
      ).getByText("Loading saved blueprints..."),
    ).toBeTruthy();
  });

  it("renders retry states for error messages", () => {
    render(
      <SavedBlueprintsDialog
        blueprints={[]}
        draftLoadMoreErrorMessage="More recent drafts could not be loaded."
        drafts={[]}
        draftsErrorMessage="Recent drafts could not be loaded."
        errorMessage="Saved blueprints could not be loaded."
        hasMoreBlueprints={false}
        hasMoreDrafts={false}
        isDraftsInitialLoading={false}
        isInitialLoading={false}
        isLoadingBlueprintsMore={false}
        isLoadingDraftsMore={false}
        loadMoreErrorMessage="More saved blueprints could not be loaded."
        onGenerate={() => {}}
        onLoadMoreBlueprints={() => {}}
        onLoadMoreDrafts={() => {}}
        onOpenBlueprint={() => {}}
        onOpenChange={() => {}}
        onOpenDraft={() => {}}
        onRetry={() => {}}
        open
      />,
    );

    const dialog = openDialog();
    expect(
      within(dialog.getByRole("region", { name: "Recent drafts" })).getByText(
        "Recent drafts could not be loaded.",
      ),
    ).toBeTruthy();
    expect(
      within(
        dialog.getByRole("region", { name: "Saved blueprints" }),
      ).getByText("Saved blueprints could not be loaded."),
    ).toBeTruthy();
  });

  it("renders empty states when nothing is available", () => {
    render(
      <SavedBlueprintsDialog
        blueprints={[]}
        draftLoadMoreErrorMessage={null}
        drafts={[]}
        draftsErrorMessage={null}
        errorMessage={null}
        hasMoreBlueprints={false}
        hasMoreDrafts={false}
        isDraftsInitialLoading={false}
        isInitialLoading={false}
        isLoadingBlueprintsMore={false}
        isLoadingDraftsMore={false}
        loadMoreErrorMessage={null}
        onGenerate={() => {}}
        onLoadMoreBlueprints={() => {}}
        onLoadMoreDrafts={() => {}}
        onOpenBlueprint={() => {}}
        onOpenChange={() => {}}
        onOpenDraft={() => {}}
        onRetry={() => {}}
        open
      />,
    );

    const dialog = openDialog();
    expect(
      within(dialog.getByRole("region", { name: "Recent drafts" })).getByText(
        "No drafts yet.",
      ),
    ).toBeTruthy();
    expect(
      within(
        dialog.getByRole("region", { name: "Saved blueprints" }),
      ).getByText(
        "No saved blueprints yet. Save your first blueprint to generate questions from it.",
      ),
    ).toBeTruthy();
  });

  it("renders only the draft empty state when blueprints exist", () => {
    render(
      <SavedBlueprintsDialog
        blueprints={blueprintItems}
        draftLoadMoreErrorMessage={null}
        drafts={[]}
        draftsErrorMessage={null}
        errorMessage={null}
        hasMoreBlueprints={false}
        hasMoreDrafts={false}
        isDraftsInitialLoading={false}
        isInitialLoading={false}
        isLoadingBlueprintsMore={false}
        isLoadingDraftsMore={false}
        loadMoreErrorMessage={null}
        onGenerate={() => {}}
        onLoadMoreBlueprints={() => {}}
        onLoadMoreDrafts={() => {}}
        onOpenBlueprint={() => {}}
        onOpenChange={() => {}}
        onOpenDraft={() => {}}
        onRetry={() => {}}
        open
      />,
    );

    const dialog = openDialog();
    expect(
      within(dialog.getByRole("region", { name: "Recent drafts" })).getByText(
        "No drafts yet.",
      ),
    ).toBeTruthy();
    expect(
      within(
        dialog.getByRole("region", { name: "Saved blueprints" }),
      ).queryByText(
        "No saved blueprints yet. Save your first blueprint to generate questions from it.",
      ),
    ).toBeNull();
  });

  it("renders only the blueprint empty state when drafts exist", () => {
    render(
      <SavedBlueprintsDialog
        blueprints={[]}
        draftLoadMoreErrorMessage={null}
        drafts={draftItems}
        draftsErrorMessage={null}
        errorMessage={null}
        hasMoreBlueprints={false}
        hasMoreDrafts={false}
        isDraftsInitialLoading={false}
        isInitialLoading={false}
        isLoadingBlueprintsMore={false}
        isLoadingDraftsMore={false}
        loadMoreErrorMessage={null}
        onGenerate={() => {}}
        onLoadMoreBlueprints={() => {}}
        onLoadMoreDrafts={() => {}}
        onOpenBlueprint={() => {}}
        onOpenChange={() => {}}
        onOpenDraft={() => {}}
        onRetry={() => {}}
        open
      />,
    );

    const dialog = openDialog();
    expect(
      within(
        dialog.getByRole("region", { name: "Saved blueprints" }),
      ).getByText(
        "No saved blueprints yet. Save your first blueprint to generate questions from it.",
      ),
    ).toBeTruthy();
    expect(
      within(dialog.getByRole("region", { name: "Recent drafts" })).queryByText(
        "No drafts yet.",
      ),
    ).toBeNull();
  });
});
