// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createReadyStudioControllerFixture } from "#/features/questions/studio/studio-controller-test-fixtures";
import type { StudioRouteSearch } from "#/features/questions/studio/studio-route-intent";
import type { StudioContinueCardViewModel } from "#/features/questions/studio/unfinished-work-view-model";
import { routeTree } from "../routeTree.gen";

const draftMutations = vi.hoisted(() => {
  const createDraft = vi.fn();
  const createEditDraft = vi.fn();
  return {
    createDraft,
    createDraftMutation: { mutateAsync: createDraft },
    createEditDraft,
    createEditDraftMutation: { mutateAsync: createEditDraft },
  };
});
const draftQueryMock = vi.hoisted(() => vi.fn());
const studioControllerMock = vi.hoisted(() => vi.fn());
const savedBlueprintsState = vi.hoisted(() => ({
  value: createSavedBlueprintsState(),
}));

vi.mock("#/features/auth", () => ({
  requireLogin: vi.fn(),
}));

vi.mock("./__root", async () => {
  const { createRootRouteWithContext, Outlet } = await import(
    "@tanstack/react-router"
  );

  return {
    Route: createRootRouteWithContext()({
      component: Outlet,
    }),
  };
});

vi.mock("#/components/footer", () => ({
  Footer: () => null,
}));

vi.mock("#/components/header", () => ({
  Header: () => null,
}));

vi.mock("#/domains/realtime", () => ({
  RealtimeNotificationsProvider: ({ children }: { children: ReactNode }) =>
    children,
}));

vi.mock("#/features/home", () => ({
  HomePage: () => <div>Home</div>,
}));

vi.mock("#/features/questions", async () => {
  const { StudioPage } = await import(
    "#/features/questions/studio/studio-page"
  );
  return {
    QuestionBlueprintDetailPage: () => <div>Blueprint detail</div>,
    QuestionDetailPage: () => <div>Question detail</div>,
    QuestionSetDetailPage: () => <div>Question set detail</div>,
    QuestionSetListPage: () => <div>Question sets</div>,
    StudioPage,
  };
});

vi.mock("#/domains/questions", () => ({
  useCreateQuestionBlueprintDraft: () => draftMutations.createDraftMutation,
  useCreateQuestionBlueprintEditDraft: () =>
    draftMutations.createEditDraftMutation,
  useQuestionBlueprintDraftQuery: draftQueryMock,
}));

vi.mock("#/features/questions/composed-editor", () => ({
  ComposedQuestionEditor: () => <div>Block editor</div>,
}));

vi.mock("#/features/questions/workbook-picker-dialog", () => ({
  WorkbookPickerDialog: () => null,
}));

vi.mock("#/features/questions/studio/use-studio-controller", () => ({
  useStudioController: studioControllerMock,
}));

vi.mock("#/features/questions/studio/use-saved-blueprints-controller", () => ({
  useSavedBlueprintsController: (input: {
    onEditBlueprintAsDraft(blueprint: { id: string }): void;
    onOpenDraft(draftId: string): void;
  }) => ({
    ...savedBlueprintsState.value,
    blueprintAction: {
      onEditAsDraft: (id: string) => input.onEditBlueprintAsDraft({ id }),
    },
    onOpenDraft: input.onOpenDraft,
  }),
}));

type StudioRouteRender = {
  router: {
    state: {
      location: {
        pathname: string;
        search: unknown;
      };
    };
  };
};

describe("studio route use cases", () => {
  beforeEach(() => {
    Object.defineProperty(window, "scrollTo", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({
        addEventListener: vi.fn(),
        addListener: vi.fn(),
        dispatchEvent: vi.fn(),
        matches: false,
        media: "",
        onchange: null,
        removeEventListener: vi.fn(),
        removeListener: vi.fn(),
      }),
    });
    draftMutations.createDraft.mockReset();
    draftMutations.createDraft.mockResolvedValue({
      draft: { id: "draft-new" },
    });
    draftMutations.createEditDraft.mockReset();
    draftMutations.createEditDraft.mockResolvedValue({
      draft: { id: "draft-edit" },
      resolution: "resumed",
    });
    draftQueryMock.mockReset();
    draftQueryMock.mockImplementation((draftId: string) => ({
      data: {
        draft: {
          blueprintId: null,
          name: `Loaded ${draftId}`,
          status: "draft",
        },
      },
      isError: false,
      isLoading: false,
      refetch: vi.fn(),
    }));
    studioControllerMock.mockReset();
    studioControllerMock.mockImplementation((routeSearch: StudioRouteSearch) =>
      createControllerForRoute(routeSearch),
    );
    savedBlueprintsState.value = createSavedBlueprintsState();
  });

  afterEach(() => {
    cleanup();
  });

  it("starts a new blueprint from Studio landing and reaches draft-only editor route", async () => {
    const user = userEvent.setup();
    let resolveCreateDraft: (result: { draft: { id: string } }) => void =
      () => {};
    draftMutations.createDraft.mockReturnValue(
      new Promise((resolve) => {
        resolveCreateDraft = resolve;
      }),
    );
    const route = renderStudioRouteUseCase("/studio");

    expect(
      await screen.findByRole("heading", {
        name: "Pick up your blueprint work.",
      }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Start a new blueprint" }),
    );

    await expectStudioLocation(route, { new: "1" });
    expect(screen.getByText("Starting blueprint...")).toBeInTheDocument();

    resolveCreateDraft({ draft: { id: "draft-new" } });

    await expectStudioLocation(route, { draftId: "draft-new" });
    expectDraftReachedEditor("draft-new");
    expectEditorShell();
    expect(draftMutations.createDraft).toHaveBeenCalledOnce();
    expect(draftMutations.createEditDraft).not.toHaveBeenCalled();
  });

  it("loads the direct new blueprint intent route into a draft-only editor route", async () => {
    let resolveCreateDraft: (result: { draft: { id: string } }) => void =
      () => {};
    draftMutations.createDraft.mockReturnValue(
      new Promise((resolve) => {
        resolveCreateDraft = resolve;
      }),
    );
    const route = renderStudioRouteUseCase("/studio?new=1");

    await expectStudioLocation(route, { new: "1" });

    resolveCreateDraft({ draft: { id: "draft-new" } });

    await expectStudioLocation(route, { draftId: "draft-new" });
    expectDraftReachedEditor("draft-new");
    expectEditorShell();
    expect(draftMutations.createDraft).toHaveBeenCalledOnce();
    expect(draftMutations.createEditDraft).not.toHaveBeenCalled();
  });

  it("opens a published blueprint from Studio landing and reaches the resumed draft editor route", async () => {
    const user = userEvent.setup();
    savedBlueprintsState.value = createSavedBlueprintsState({
      blueprints: [
        {
          description: "Published body",
          id: "blueprint-1",
          metadata: "Published",
          title: "Blueprint one",
        },
      ],
    });
    const route = renderStudioRouteUseCase("/studio");

    await user.click(
      await screen.findByRole("button", { name: "Browse older work" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Edit blueprint Blueprint one" }),
    );

    await expectStudioLocation(route, { draftId: "draft-edit" });
    expectDraftReachedEditor("draft-edit");
    expectEditorShell();
    expect(draftMutations.createEditDraft).toHaveBeenCalledWith({
      questionBlueprintId: "blueprint-1",
    });
    expect(draftMutations.createDraft).not.toHaveBeenCalled();
  });

  it("loads the direct blueprint edit intent route into a resumed draft editor route", async () => {
    const route = renderStudioRouteUseCase("/studio?blueprintId=blueprint-1");

    await expectStudioLocation(route, { draftId: "draft-edit" });
    expectDraftReachedEditor("draft-edit");
    expectEditorShell();
    expect(draftMutations.createEditDraft).toHaveBeenCalledWith({
      questionBlueprintId: "blueprint-1",
    });
    expect(draftMutations.createDraft).not.toHaveBeenCalled();
  });

  it("continues latest unfinished work from Studio landing without creating a new draft", async () => {
    const user = userEvent.setup();
    savedBlueprintsState.value = createSavedBlueprintsState({
      latestDraft: {
        draftId: "draft-latest",
        lastEditedLabel: "Last edited Jun 22, 2026, 12:00 AM UTC",
        title: "Latest work",
        unpublishedChangesLabel: "Unpublished changes",
      },
    });
    const route = renderStudioRouteUseCase("/studio");

    expect(await screen.findByText("Latest work")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Continue where you left off" }),
    );

    await expectStudioLocation(route, { draftId: "draft-latest" });
    expectDraftReachedEditor("draft-latest");
    expectEditorShell();
    expect(draftMutations.createDraft).not.toHaveBeenCalled();
    expect(draftMutations.createEditDraft).not.toHaveBeenCalled();
  });

  it("loads a draft route directly without entry creation", async () => {
    const route = renderStudioRouteUseCase("/studio?draftId=draft-1");

    await expectStudioLocation(route, { draftId: "draft-1" });
    expectDraftReachedEditor("draft-1");
    expectEditorShell();
    expect(draftMutations.createDraft).not.toHaveBeenCalled();
    expect(draftMutations.createEditDraft).not.toHaveBeenCalled();
    expect(screen.queryByText("Starting blueprint...")).not.toBeInTheDocument();
  });

  it("normalizes mixed blueprint and draft route before loading editor state", async () => {
    const route = renderStudioRouteUseCase(
      "/studio?blueprintId=blueprint-old&draftId=draft-active",
    );

    await expectStudioLocation(route, { draftId: "draft-active" });
    expectDraftReachedEditor("draft-active");
    expect(draftQueryMock).not.toHaveBeenCalledWith("blueprint-old");
    expectOnlyDraftQueryId("draft-active");
    expectOnlyControllerDraftRoute("draft-active");
    expectEditorShell();
    expect(draftMutations.createDraft).not.toHaveBeenCalled();
    expect(draftMutations.createEditDraft).not.toHaveBeenCalled();
    expect(draftMutations.createEditDraft).not.toHaveBeenCalledWith({
      questionBlueprintId: "blueprint-old",
    });
  });

  it("falls back to landing for malformed Studio search without creating work", async () => {
    renderStudioRouteUseCase("/studio?blueprintId=%20&draftId=%20&new=true");

    expect(
      await screen.findByRole("heading", {
        name: "Pick up your blueprint work.",
      }),
    ).toBeInTheDocument();
    expect(draftMutations.createDraft).not.toHaveBeenCalled();
    expect(draftMutations.createEditDraft).not.toHaveBeenCalled();
    expect(draftQueryMock).not.toHaveBeenCalled();
  });
});

function renderStudioRouteUseCase(initialEntry: string): StudioRouteRender {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
  const router = createRouter({
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
    routeTree,
  });

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  return { router };
}

async function expectStudioLocation(
  route: StudioRouteRender,
  search: StudioRouteSearch,
) {
  await waitFor(() => {
    expect(route.router.state.location.pathname).toBe("/studio");
    expect(route.router.state.location.search).toEqual(search);
  });
}

function expectDraftReachedEditor(draftId: string) {
  expect(draftQueryMock).toHaveBeenCalledWith(draftId);
  expect(
    studioControllerMock.mock.calls.some(([routeSearch]) =>
      routeSearchMatchesDraft(routeSearch, draftId),
    ),
  ).toBe(true);
}

function expectEditorShell() {
  expect(screen.getByText("Block editor")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
}

function expectOnlyDraftQueryId(draftId: string) {
  const queriedDraftIds = draftQueryMock.mock.calls.map(([queriedDraftId]) =>
    String(queriedDraftId),
  );

  expect(queriedDraftIds).toEqual(expect.arrayContaining([draftId]));
  expect(
    queriedDraftIds.every((queriedDraftId) => queriedDraftId === draftId),
  ).toBe(true);
}

function expectOnlyControllerDraftRoute(draftId: string) {
  const controllerSearches = studioControllerMock.mock.calls.map(
    ([routeSearch]) => routeSearch,
  );

  expect(controllerSearches).toEqual(
    expect.arrayContaining([expect.objectContaining({ draftId })]),
  );

  for (const routeSearch of controllerSearches) {
    expect(routeSearch).toEqual({ draftId });
  }
}

function routeSearchMatchesDraft(routeSearch: unknown, draftId: string) {
  return (
    typeof routeSearch === "object" &&
    routeSearch !== null &&
    "draftId" in routeSearch &&
    routeSearch.draftId === draftId
  );
}

function createControllerForRoute(routeSearch: StudioRouteSearch = {}) {
  const draftId = routeSearch.draftId ?? "draft-missing";
  return createReadyStudioControllerFixture({
    draftId,
  });
}

function createSavedBlueprintsState(input?: {
  blueprints?: Array<{
    description: string;
    id: string;
    metadata: string;
    title: string;
  }>;
  latestDraft?: StudioContinueCardViewModel | null;
}) {
  return {
    blueprints: input?.blueprints ?? [],
    blueprintAction: {
      onEditAsDraft: () => {},
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
    latestDraft: input?.latestDraft ?? null,
    loadMoreErrorMessage: null,
    onLoadMoreBlueprints: () => {},
    onLoadMoreDrafts: () => {},
    onOpenDraft: () => {},
    onRetry: () => {},
  };
}
