// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StudioPage } from "./studio-page";

const navigateMock = vi.hoisted(() => vi.fn());
const studioControllerMock = vi.hoisted(() => vi.fn());
const entryRouteMock = vi.hoisted(() => vi.fn());
const savedBlueprintsControllerInput = vi.hoisted(() => ({
  last: null as {
    onEditBlueprintAsDraft(blueprint: { id: string }): void;
    onOpenDraft(draftId: string): void;
  } | null,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => navigateMock,
}));

const draftQueryMock = vi.hoisted(() => vi.fn());

vi.mock("#/domains/questions", () => ({
  useQuestionBlueprintDraftQuery: draftQueryMock,
}));

vi.mock("./use-studio-controller", () => ({
  useStudioController: studioControllerMock,
}));

vi.mock("./use-studio-entry-route", () => ({
  useStudioEntryRoute: entryRouteMock,
}));

vi.mock("./use-saved-blueprints-controller", () => ({
  useSavedBlueprintsController: (input: {
    onEditBlueprintAsDraft(blueprint: { id: string }): void;
    onOpenDraft(draftId: string): void;
  }) => {
    savedBlueprintsControllerInput.last = input;
    return {
      blueprints: [
        {
          description: "Published body",
          id: "blueprint-1",
          metadata: "Published",
          title: "Blueprint one",
        },
      ],
      blueprintAction: {
        onEditAsDraft: (id: string) => input.onEditBlueprintAsDraft({ id }),
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
      loadMoreErrorMessage: null,
      onLoadMoreBlueprints: vi.fn(),
      onLoadMoreDrafts: vi.fn(),
      onOpenDraft: input.onOpenDraft,
      onRetry: vi.fn(),
    };
  },
}));

describe("StudioPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    navigateMock.mockReset();
    draftQueryMock.mockReset();
    draftQueryMock.mockReturnValue({
      data: null,
      isError: false,
      isLoading: true,
      refetch: vi.fn(),
    });
    studioControllerMock.mockReset();
    entryRouteMock.mockReset();
    entryRouteMock.mockReturnValue({
      errorMessage: null,
      isEntering: true,
    });
  });

  it("renders landing page for /studio without entering editor draft path", () => {
    render(<StudioPage />);

    expect(
      screen.getByRole("heading", { name: "Choose how to start." }),
    ).toBeInTheDocument();
    expect(studioControllerMock).not.toHaveBeenCalled();
  });

  it("navigates to new draft entry route from landing action", () => {
    render(<StudioPage />);

    fireEvent.click(
      screen.getByRole("button", { name: "Create new blueprint" }),
    );

    expect(navigateMock).toHaveBeenCalledWith({
      replace: false,
      search: { new: "1" },
      to: "/studio",
    });
  });

  it("uses edit-as-draft action for published blueprints on landing", () => {
    render(<StudioPage />);

    fireEvent.click(
      screen.getByRole("button", { name: "Edit published blueprint" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Edit as draft Blueprint one" }),
    );

    expect(navigateMock).toHaveBeenCalledWith({
      replace: false,
      search: { blueprintId: "blueprint-1" },
      to: "/studio",
    });
    expect(
      screen.queryByRole("button", { name: /generate from/i }),
    ).not.toBeInTheDocument();
  });

  it("renders entry route without mounting editor controller", () => {
    render(<StudioPage new="1" />);

    expect(screen.getByText("Creating draft...")).toBeInTheDocument();
    expect(entryRouteMock).toHaveBeenCalledOnce();
    expect(studioControllerMock).not.toHaveBeenCalled();
  });

  it("renders published terminal draft without mounting editor controller", () => {
    draftQueryMock.mockReturnValue({
      data: {
        draft: {
          blueprintId: "blueprint-1",
          name: "Published draft",
          status: "published",
        },
      },
      isError: false,
      isLoading: false,
      refetch: vi.fn(),
    });

    render(<StudioPage draftId="draft-1" />);

    expect(
      screen.getByRole("heading", { name: "Draft published" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open published blueprint" }),
    ).toBeInTheDocument();
    expect(studioControllerMock).not.toHaveBeenCalled();
  });

  it("renders discarded terminal draft without mounting editor controller", () => {
    draftQueryMock.mockReturnValue({
      data: {
        draft: {
          blueprintId: "blueprint-1",
          name: "Discarded draft",
          status: "discarded",
        },
      },
      isError: false,
      isLoading: false,
      refetch: vi.fn(),
    });

    render(<StudioPage draftId="draft-1" />);

    expect(
      screen.getByRole("heading", { name: "Draft discarded" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Create new draft" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open drafts" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Create new edit draft" }),
    ).not.toBeInTheDocument();
    expect(studioControllerMock).not.toHaveBeenCalled();
  });

  it("renders controlled draft document error without normal editor controls", () => {
    const onReloadLatestDraft = vi.fn();
    draftQueryMock.mockReturnValue({
      data: {
        draft: {
          blueprintId: null,
          name: "Malformed draft",
          status: "draft",
        },
      },
      isError: false,
      isLoading: false,
      refetch: vi.fn(),
    });
    studioControllerMock.mockReturnValue({
      commandBar: {
        onReloadLatestDraft,
      },
      draftLoadState: {
        message: "Draft could not be loaded.",
        status: "document_error",
      },
    });

    render(<StudioPage draftId="draft-1" />);

    expect(
      screen.getByRole("heading", { name: "Draft could not be loaded." }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "This draft contains an unsupported or invalid document structure.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save draft" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Publish draft" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "Draft name" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Reload latest draft" }),
    );
    expect(onReloadLatestDraft).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("link", { name: "Back to Studio" }),
    ).toBeInTheDocument();
  });
});
