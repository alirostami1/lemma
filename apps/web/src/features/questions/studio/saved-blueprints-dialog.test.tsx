// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { QuestionBlueprint } from "#/domains/questions/model";
import { SavedBlueprintsDialog } from "./saved-blueprints-dialog";
import { buildSavedBlueprintsViewModel } from "./saved-blueprints-view-model";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    ...props
  }: {
    children: ReactNode;
  } & ComponentPropsWithoutRef<"a"> & { to?: string; search?: unknown }) => (
    <a {...props}>{children}</a>
  ),
}));

describe("saved blueprints dialog", () => {
  it("renders saved blueprints newest first with actions", async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn();

    render(
      <SavedBlueprintsDialog
        open
        onOpenChange={() => {}}
        items={buildSavedBlueprintsViewModel([
          createBlueprint("Newer blueprint", "2026-06-10T00:00:00.000Z"),
          createBlueprint("Older blueprint", "2026-06-09T00:00:00.000Z"),
        ])}
        isInitialLoading={false}
        errorMessage={null}
        loadMoreErrorMessage={null}
        hasMore={false}
        isLoadingMore={false}
        onRetry={() => {}}
        onLoadMore={() => {}}
        onOpenBlueprint={() => {}}
        onGenerate={onGenerate}
      />,
    );

    await screen.findByText("Newer blueprint");
    expect(screen.getByText("Older blueprint")).toBeTruthy();
    expect(
      screen
        .getByText("Newer blueprint")
        .compareDocumentPosition(screen.getByText("Older blueprint")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Generate" })).toHaveLength(2);

    await user.click(screen.getAllByRole("button", { name: "Generate" })[0]);
    expect(onGenerate).toHaveBeenCalledWith("blueprint-newer-blueprint");
  });
});

function createBlueprint(name: string, timestamp: string): QuestionBlueprint {
  return {
    id: `blueprint-${name.toLowerCase().replace(/\s+/g, "-")}`,
    ownerUserId: "user_1",
    createdByUserId: "user_1",
    name,
    description: null,
    document: {
      schemaVersion: 1 as const,
      blocks: [],
      responseFields: [],
    },
    sources: [],
    visibility: "private",
    status: "active",
    archivedAt: null,
    createdAt: new Date(timestamp),
    updatedAt: new Date(timestamp),
  };
}
