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
  const defaultProps = {
    blueprintAction: {
      onEditAsDraft: () => {},
    },
    draftLoadMoreErrorMessage: null,
    draftsErrorMessage: null,
    errorMessage: null,
    hasMoreBlueprints: false,
    hasMoreDrafts: false,
    isDraftsInitialLoading: false,
    isInitialLoading: false,
    isLoadingBlueprintsMore: false,
    isLoadingDraftsMore: false,
    loadMoreErrorMessage: null,
    onLoadMoreBlueprints: () => {},
    onLoadMoreDrafts: () => {},
    onOpenChange: () => {},
    onOpenDraft: () => {},
    onRetry: () => {},
    open: true,
  };

  it("renders draft and blueprint sections", () => {
    render(
      <SavedBlueprintsDialog
        {...defaultProps}
        blueprints={blueprintItems}
        drafts={draftItems}
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

    render(
      <SavedBlueprintsDialog
        {...defaultProps}
        blueprints={blueprintItems}
        drafts={draftItems}
        onOpenDraft={onOpenDraft}
      />,
    );

    const dialog = openDialog();
    await user.click(
      dialog.getByRole("button", { name: "Open draft Draft one" }),
    );
    expect(onOpenDraft).toHaveBeenCalledWith("draft-1");
    expect(
      dialog.queryByRole("button", { name: /generate/i }),
    ).not.toBeInTheDocument();
  });

  it("uses edit-as-draft action for Studio blueprint selection", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <SavedBlueprintsDialog
        {...defaultProps}
        blueprintAction={{
          onEditAsDraft: onSelect,
        }}
        blueprints={blueprintItems}
        drafts={draftItems}
      />,
    );

    const dialog = openDialog();
    await user.click(
      dialog.getByRole("button", { name: "Edit as draft Blueprint one" }),
    );
    expect(onSelect).toHaveBeenCalledWith("blueprint-1");
    expect(
      dialog.queryByRole("button", { name: /generate/i }),
    ).not.toBeInTheDocument();
  });

  it("renders loading states for both sections", () => {
    render(
      <SavedBlueprintsDialog
        {...defaultProps}
        blueprints={[]}
        drafts={[]}
        isDraftsInitialLoading={true}
        isInitialLoading={true}
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
        {...defaultProps}
        blueprints={[]}
        draftLoadMoreErrorMessage="More recent drafts could not be loaded."
        drafts={[]}
        draftsErrorMessage="Recent drafts could not be loaded."
        errorMessage="Saved blueprints could not be loaded."
        loadMoreErrorMessage="More saved blueprints could not be loaded."
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
      <SavedBlueprintsDialog {...defaultProps} blueprints={[]} drafts={[]} />,
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
      ).getByText("No saved blueprints yet."),
    ).toBeTruthy();
  });

  it("renders only the draft empty state when blueprints exist", () => {
    render(
      <SavedBlueprintsDialog
        {...defaultProps}
        blueprints={blueprintItems}
        drafts={[]}
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
      ).queryByText("No saved blueprints yet."),
    ).toBeNull();
  });

  it("renders only the blueprint empty state when drafts exist", () => {
    render(
      <SavedBlueprintsDialog
        {...defaultProps}
        blueprints={[]}
        drafts={draftItems}
      />,
    );

    const dialog = openDialog();
    expect(
      within(
        dialog.getByRole("region", { name: "Saved blueprints" }),
      ).getByText("No saved blueprints yet."),
    ).toBeTruthy();
    expect(
      within(dialog.getByRole("region", { name: "Recent drafts" })).queryByText(
        "No drafts yet.",
      ),
    ).toBeNull();
  });
});
