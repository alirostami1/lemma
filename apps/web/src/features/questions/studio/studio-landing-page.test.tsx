// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StudioLandingPage } from "./studio-landing-page";

const navigateMock = vi.hoisted(() => vi.fn());
const controllerState = vi.hoisted(() => ({
  value: {
    blueprints: [],
    blueprintAction: {
      onEditAsDraft: vi.fn(),
    },
    draftLoadMoreErrorMessage: null as string | null,
    drafts: [],
    draftsErrorMessage: null as string | null,
    errorMessage: null as string | null,
    hasMoreBlueprints: false,
    hasMoreDrafts: false,
    isDraftsInitialLoading: false,
    isInitialLoading: false,
    isLoadingBlueprintsMore: false,
    isLoadingDraftsMore: false,
    latestDraft: null as null | {
      draftId: string;
      lastEditedLabel: string;
      title: string;
      unpublishedChangesLabel: string;
    },
    loadMoreErrorMessage: null as string | null,
    onLoadMoreBlueprints: vi.fn(),
    onLoadMoreDrafts: vi.fn(),
    onOpenDraft: vi.fn(),
    onRetry: vi.fn(),
  },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("./use-saved-blueprints-controller", () => ({
  useSavedBlueprintsController: () => controllerState.value,
}));

vi.mock("./saved-blueprints-dialog", () => ({
  SavedBlueprintsDialog: ({
    onOpenChange,
    open,
  }: {
    onOpenChange(open: boolean): void;
    open: boolean;
  }) =>
    open ? (
      <div aria-label="Browse work and blueprints" role="dialog">
        <button onClick={() => onOpenChange(false)} type="button">
          Close
        </button>
      </div>
    ) : null,
}));

describe("StudioLandingPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    navigateMock.mockReset();
    controllerState.value = {
      blueprints: [],
      blueprintAction: {
        onEditAsDraft: vi.fn(),
      },
      draftLoadMoreErrorMessage: null,
      drafts: [],
      draftsErrorMessage: null,
      errorMessage: null,
      hasMoreBlueprints: false,
      hasMoreDrafts: false,
      isDraftsInitialLoading: false,
      isInitialLoading: false,
      isLoadingBlueprintsMore: false,
      isLoadingDraftsMore: false,
      latestDraft: null,
      loadMoreErrorMessage: null,
      onLoadMoreBlueprints: vi.fn(),
      onLoadMoreDrafts: vi.fn(),
      onOpenDraft: vi.fn(),
      onRetry: vi.fn(),
    };
  });

  it("renders the two primary cards without forbidden landing copy", () => {
    render(<StudioLandingPage />);

    expect(screen.getAllByText("Continue where you left off")).not.toHaveLength(
      0,
    );
    expect(screen.getAllByText("Start a new blueprint")).not.toHaveLength(0);

    const pageText = document.body.textContent ?? "";
    expect(pageText).not.toMatch(/\bdraft\b/i);
    expect(pageText).not.toMatch(/\bdraftId\b/i);
    expect(pageText).not.toMatch(/\brevision\b/i);
    expect(pageText).not.toMatch(/server draft/i);
    expect(pageText).not.toMatch(/route intent/i);
  });

  it("shows latest unfinished work details and continues directly", () => {
    controllerState.value.latestDraft = {
      draftId: "draft-2",
      lastEditedLabel: "Last edited Jun 22, 2026, 12:00 AM UTC",
      title: "Latest work",
      unpublishedChangesLabel: "Unpublished changes",
    };

    render(<StudioLandingPage />);

    expect(screen.getByText("Latest work")).toBeInTheDocument();
    expect(
      screen.getByText("Last edited Jun 22, 2026, 12:00 AM UTC"),
    ).toBeInTheDocument();
    expect(screen.getByText("Unpublished changes")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Continue where you left off" }),
    );

    expect(navigateMock).toHaveBeenCalledWith({
      replace: false,
      search: { draftId: "draft-2" },
      to: "/studio",
    });
  });

  it("shows loading state and not empty state while recent work is loading", () => {
    controllerState.value.isDraftsInitialLoading = true;

    render(<StudioLandingPage />);

    expect(screen.getByText("Loading recent work...")).toBeInTheDocument();
    expect(
      screen.queryByText("No unfinished work yet"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Continue where you left off" }),
    ).toBeDisabled();
  });

  it("shows error state with retry and not empty state when recent work fails", () => {
    const onRetry = vi.fn();
    controllerState.value.draftsErrorMessage =
      "Recent work could not be loaded.";
    controllerState.value.onRetry = onRetry;

    render(<StudioLandingPage />);

    expect(
      screen.getByText("Recent work could not be loaded."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("No unfinished work yet"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "Continue where you left off" }),
    ).toBeDisabled();
  });

  it("starts new work through the existing new route", () => {
    render(<StudioLandingPage />);

    fireEvent.click(
      screen.getByRole("button", { name: "Start a new blueprint" }),
    );

    expect(navigateMock).toHaveBeenCalledWith({
      replace: false,
      search: { new: "1" },
      to: "/studio",
    });
  });

  it("opens older work chooser from the continue card", () => {
    render(<StudioLandingPage />);

    fireEvent.click(screen.getByRole("button", { name: "Browse older work" }));

    expect(
      screen.getByRole("dialog", { name: "Browse work and blueprints" }),
    ).toBeInTheDocument();
  });

  it("shows sensible empty state when no unfinished work exists", () => {
    render(<StudioLandingPage />);

    expect(screen.getByText("No unfinished work yet")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Continue where you left off" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Start a new blueprint" }),
    ).toBeInTheDocument();
  });
});
