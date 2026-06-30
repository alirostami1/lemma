// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createReadyStudioControllerFixture } from "./studio-controller-test-fixtures";
import { StudioPage } from "./studio-page";
import type { StudioContinueCardViewModel } from "./unfinished-work-view-model";

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

vi.mock("#/features/questions/composed-editor", async () => {
  const React = await import("react");
  const { useAddReferenceActions } = await import(
    "#/features/questions/composed-editor/inspector/add-reference-actions"
  );

  return {
    ComposedQuestionEditor: () => {
      const { onUploadWorkbook } = useAddReferenceActions();
      const [step, setStep] = React.useState<"closed" | "type" | "workbook">(
        "closed",
      );

      return (
        <div>
          <div>Block editor</div>
          <button onClick={() => setStep("type")} type="button">
            Add reference
          </button>
          {step === "type" ? (
            <div>
              <button onClick={() => setStep("workbook")} type="button">
                Workbook
              </button>
              <button disabled type="button">
                Python
              </button>
              <button type="button">Literal</button>
            </div>
          ) : null}
          {step === "workbook" ? (
            <button onClick={onUploadWorkbook} type="button">
              Upload a new file
            </button>
          ) : null}
        </div>
      );
    },
  };
});

vi.mock("../workbook-picker-dialog", () => ({
  WorkbookPickerDialog: () => null,
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
      latestDraft: null as StudioContinueCardViewModel | null,
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
      screen.getByRole("heading", { name: "Pick up your blueprint work." }),
    ).toBeInTheDocument();
    expect(studioControllerMock).not.toHaveBeenCalled();
    expect(entryRouteMock).not.toHaveBeenCalled();
    expect(draftQueryMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("navigates to new draft entry route from landing action", () => {
    render(<StudioPage />);

    fireEvent.click(
      screen.getByRole("button", { name: "Start a new blueprint" }),
    );

    expect(navigateMock).toHaveBeenCalledWith({
      replace: false,
      search: { new: "1" },
      to: "/studio",
    });
  });

  it("uses blueprint action for published blueprints on landing", () => {
    render(<StudioPage />);

    fireEvent.click(screen.getByRole("button", { name: "Browse older work" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Edit blueprint Blueprint one" }),
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

    expect(screen.getByText("Starting blueprint...")).toBeInTheDocument();
    expect(entryRouteMock).toHaveBeenCalledOnce();
    expect(studioControllerMock).not.toHaveBeenCalled();
  });

  it("loads draft route directly without entry creation", () => {
    render(<StudioPage draftId="draft-1" />);

    expect(screen.getByText("Loading work...")).toBeInTheDocument();
    expect(draftQueryMock).toHaveBeenCalledWith("draft-1");
    expect(entryRouteMock).not.toHaveBeenCalled();
    expect(studioControllerMock).not.toHaveBeenCalled();
  });

  it("normalizes mixed blueprint and draft route before loading editor state", async () => {
    render(<StudioPage blueprintId="blueprint-1" draftId="draft-1" />);

    expect(screen.getByText("Opening work...")).toBeInTheDocument();
    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith({
        replace: true,
        search: { draftId: "draft-1" },
        to: "/studio",
      }),
    );
    expect(entryRouteMock).not.toHaveBeenCalled();
    expect(draftQueryMock).not.toHaveBeenCalled();
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
      screen.getByRole("heading", {
        name: "This work was already published.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open published blueprint" }),
    ).toBeInTheDocument();
    expect(studioControllerMock).not.toHaveBeenCalled();
  });

  it("renders publishing terminal draft without mounting editor controller", () => {
    const refetch = vi.fn();
    draftQueryMock.mockReturnValue({
      data: {
        draft: {
          blueprintId: "blueprint-1",
          name: "Publishing blueprint",
          status: "publishing",
        },
      },
      isError: false,
      isLoading: false,
      refetch,
    });

    render(<StudioPage draftId="draft-1" />);

    expect(
      screen.getByRole("heading", { name: "Blueprint is being published" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Publishing blueprint: This work is temporarily unavailable while publishing.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Publish" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Start a new blueprint" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Check again" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to Studio" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Check again" }));

    expect(refetch).toHaveBeenCalledOnce();
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
      screen.getByRole("heading", {
        name: "This work is no longer available.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Start a new blueprint" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Continue where you left off" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Edit this blueprint" }),
    ).not.toBeInTheDocument();
    expect(studioControllerMock).not.toHaveBeenCalled();
  });

  it("renders unavailable draft route with recovery actions", () => {
    draftQueryMock.mockReturnValue({
      data: null,
      isError: true,
      isLoading: false,
      refetch: vi.fn(),
    });

    render(<StudioPage draftId="missing-draft" />);

    expect(
      screen.getByRole("heading", {
        name: "This work is no longer available.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("This work could not be loaded."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Continue where you left off" }),
    ).toBeInTheDocument();
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
        message: "Blueprint could not be loaded.",
        status: "document_error",
      },
    });

    render(<StudioPage draftId="draft-1" />);

    expect(
      screen.getByRole("heading", { name: "Blueprint could not be loaded." }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "This blueprint contains an unsupported or invalid document structure.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Publish" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "Blueprint name" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reload latest work" }));
    expect(
      screen.queryByRole("button", { name: "Save draft" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Publish draft" }),
    ).not.toBeInTheDocument();
    expect(onReloadLatestDraft).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("link", { name: "Back to Studio" }),
    ).toBeInTheDocument();
  });

  it("opens source attachment from Add Reference without persistent source controls", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    draftQueryMock.mockReturnValue({
      data: {
        draft: {
          blueprintId: null,
          name: "Current work",
          status: "draft",
        },
      },
      isError: false,
      isLoading: false,
      refetch: vi.fn(),
    });
    studioControllerMock.mockReturnValue(
      createReadyStudioControllerFixture({
        source: { actions: { addSource: () => onOpenChange(true) } },
        sourcePicker: {
          onOpenChange,
          open: false,
        },
      }),
    );

    const { rerender } = render(<StudioPage draftId="draft-1" />);

    expect(screen.getByText("Block editor")).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Blueprint sources" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Add source" })).toBeNull();
    expect(screen.queryByText("No sources attached.")).toBeNull();
    expect(screen.queryByText(/attached|used|local/i)).toBeNull();
    expect(screen.queryByText("Source 1")).toBeNull();
    expect(screen.queryByText("Upload a new file")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Add reference" }));
    expect(screen.queryByText("Upload a new file")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Workbook" }));
    await user.click(screen.getByRole("button", { name: "Upload a new file" }));

    expect(onOpenChange).toHaveBeenCalledWith(true);
    studioControllerMock.mockReturnValue(
      createReadyStudioControllerFixture({
        source: { actions: { addSource: () => onOpenChange(true) } },
        sourcePicker: {
          onOpenChange,
          open: true,
        },
      }),
    );
    rerender(<StudioPage draftId="draft-1" />);

    expect(
      screen.getByRole("dialog", { name: "Upload a new file" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Add a workbook to this blueprint. It stays local until you save.",
      ),
    ).toBeInTheDocument();
  });

  it("loaded editor lets the user save and publish using product copy", async () => {
    const user = userEvent.setup();
    const onOpenPublishDialog = vi.fn();
    const onPublish = vi.fn();
    const onSaveDraft = vi.fn();
    draftQueryMock.mockReturnValue({
      data: {
        draft: {
          blueprintId: null,
          name: "Current work",
          status: "draft",
        },
      },
      isError: false,
      isLoading: false,
      refetch: vi.fn(),
    });
    studioControllerMock.mockReturnValue(
      createReadyStudioControllerFixture({
        commandBar: {
          onOpenPublishDialog,
          onSaveDraft,
          saveState: "unsaved",
        },
        publishDialog: {
          onPublish,
          open: false,
          state: {
            currentName: "Current work",
            validationIssue: null,
          },
        },
      }),
    );

    const { rerender } = render(<StudioPage draftId="draft-1" />);

    expect(screen.getByRole("textbox", { name: "Blueprint name" })).toHaveValue(
      "Current work",
    );
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Save draft" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Publish draft" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSaveDraft).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "Publish" }));
    expect(onOpenPublishDialog).toHaveBeenCalledOnce();

    studioControllerMock.mockReturnValue(
      createReadyStudioControllerFixture({
        commandBar: {
          onOpenPublishDialog,
          onSaveDraft,
          saveState: "unsaved",
        },
        publishDialog: {
          onPublish,
          open: true,
          state: {
            currentName: "Current work",
            validationIssue: null,
          },
        },
      }),
    );
    rerender(<StudioPage draftId="draft-1" />);

    const publishDialog = screen.getByRole("dialog", { name: "Publish" });
    expect(
      within(publishDialog).getByText(
        "This saves your changes and publishes the blueprint.",
      ),
    ).toBeInTheDocument();

    await user.click(
      within(publishDialog).getByRole("button", { name: "Publish" }),
    );
    expect(onPublish).toHaveBeenCalledOnce();
  });

  it("keeps Studio editor controls non-sticky on mobile", () => {
    draftQueryMock.mockReturnValue({
      data: {
        draft: {
          blueprintId: null,
          name: "Current work",
          status: "draft",
        },
      },
      isError: false,
      isLoading: false,
      refetch: vi.fn(),
    });
    studioControllerMock.mockReturnValue(createReadyStudioControllerFixture());

    render(<StudioPage draftId="draft-1" />);

    const commandBarRegion = screen.getByTestId("studio-editor-controls");

    expect(commandBarRegion).toHaveClass("grid");
    expect(commandBarRegion).not.toHaveClass("sticky");
    expect(commandBarRegion).not.toHaveClass("top-0");
    expect(commandBarRegion).toHaveClass("xl:sticky");
    expect(commandBarRegion).toHaveClass("xl:top-0");
  });

  it("shows editor saving state without failed copy", () => {
    draftQueryMock.mockReturnValue({
      data: {
        draft: {
          blueprintId: null,
          name: "Current work",
          status: "draft",
        },
      },
      isError: false,
      isLoading: false,
      refetch: vi.fn(),
    });
    studioControllerMock.mockReturnValue(
      createReadyStudioControllerFixture({
        commandBar: {
          isSaving: true,
          saveError: null,
          saveState: "saving",
        },
      }),
    );

    render(<StudioPage draftId="draft-1" />);

    expect(screen.getByText("Saving changes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
    expect(screen.queryByText("Save failed")).not.toBeInTheDocument();
  });

  it("shows editor save failure with product copy", () => {
    draftQueryMock.mockReturnValue({
      data: {
        draft: {
          blueprintId: null,
          name: "Current work",
          status: "draft",
        },
      },
      isError: false,
      isLoading: false,
      refetch: vi.fn(),
    });
    studioControllerMock.mockReturnValue(
      createReadyStudioControllerFixture({
        commandBar: {
          isSaving: false,
          saveError: "This work could not be saved.",
          saveState: "failed",
        },
      }),
    );

    render(<StudioPage draftId="draft-1" />);

    expect(screen.getByText("Save failed")).toBeInTheDocument();
    expect(
      screen.getByText("This work could not be saved."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    expect(screen.queryByText(/save draft/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/draft could not/i)).not.toBeInTheDocument();
  });
});
