import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSavedBlueprintsController } from "./use-saved-blueprints-controller";

const queryMocks = vi.hoisted(() => ({
  fetchBlueprintsNextPage: vi.fn(),
  fetchDraftsNextPage: vi.fn(),
  refetchBlueprints: vi.fn(),
  refetchDrafts: vi.fn(),
}));

const queryState = vi.hoisted(() => ({
  blueprints: {
    data: {
      nextCursor: null,
      pages: [
        {
          nextCursor: "cursor-blueprints",
          questionBlueprints: [
            {
              archivedAt: null,
              createdAt: new Date("2026-06-21T00:00:00.000Z"),
              createdByUserId: "user-1",
              description: "Published",
              document: {
                blocks: [],
                responseFields: [],
                schemaVersion: 1,
              },
              id: "blueprint-1",
              name: "Blueprint one",
              ownerUserId: "user-1",
              sources: [],
              status: "active",
              updatedAt: new Date("2026-06-22T00:00:00.000Z"),
              visibility: "private",
            },
            {
              archivedAt: null,
              createdAt: new Date("2026-06-20T00:00:00.000Z"),
              createdByUserId: "user-1",
              description: null,
              document: {
                blocks: [],
                responseFields: [],
                schemaVersion: 1,
              },
              id: "blueprint-2",
              name: "Blueprint two",
              ownerUserId: "user-1",
              sources: [],
              status: "active",
              updatedAt: new Date("2026-06-21T00:00:00.000Z"),
              visibility: "private",
            },
          ],
        },
      ],
    },
    fetchNextPage: queryMocks.fetchBlueprintsNextPage,
    hasNextPage: true,
    isError: false,
    isFetchingNextPage: false,
    isFetchNextPageError: false,
    isLoading: false,
    isLoadingError: false,
    refetch: queryMocks.refetchBlueprints,
  },
  drafts: {
    data: {
      nextCursor: null,
      pages: [
        {
          drafts: [
            {
              blueprintId: "blueprint-1",
              description: "Draft notes",
              id: "draft-1",
              lastSavedAt: new Date("2026-06-20T00:00:00.000Z"),
              name: "Draft one",
              sourceCount: 2,
              status: "draft",
              updatedAt: new Date("2026-06-21T00:00:00.000Z"),
            },
            {
              blueprintId: null,
              description: "No blueprint",
              id: "draft-2",
              lastSavedAt: new Date("2026-06-21T00:00:00.000Z"),
              name: "Draft two",
              sourceCount: 0,
              status: "draft",
              updatedAt: new Date("2026-06-22T00:00:00.000Z"),
            },
          ],
          nextCursor: "cursor-drafts",
        },
      ],
    },
    fetchNextPage: queryMocks.fetchDraftsNextPage,
    hasNextPage: true,
    isError: false,
    isFetchingNextPage: false,
    isFetchNextPageError: false,
    isLoading: false,
    isLoadingError: false,
    refetch: queryMocks.refetchDrafts,
  },
}));

function resetQueryStates() {
  queryMocks.fetchDraftsNextPage.mockReset();
  queryMocks.fetchBlueprintsNextPage.mockReset();
  queryMocks.refetchDrafts.mockReset();
  queryMocks.refetchBlueprints.mockReset();
  queryState.drafts.isError = false;
  queryState.drafts.isFetchNextPageError = false;
  queryState.blueprints.isError = false;
  queryState.blueprints.isFetchNextPageError = false;
}

beforeEach(() => {
  resetQueryStates();
});

vi.mock("#/domains/questions", () => ({
  useQuestionBlueprintDraftsInfiniteQuery: () => queryState.drafts,
  useQuestionBlueprintsInfiniteQuery: () => queryState.blueprints,
}));

describe("useSavedBlueprintsController", () => {
  it("loads recent drafts and saved blueprints", () => {
    const { result } = renderHook(() =>
      useSavedBlueprintsController({
        onEditBlueprintAsDraft: vi.fn(),
        onOpenDraft: vi.fn(),
      }),
    );

    expect(result.current.drafts).toHaveLength(2);
    expect(result.current.blueprints).toHaveLength(2);
    expect(result.current.drafts[0]?.id).toBe("draft-1");
    expect(result.current.blueprints[0]?.id).toBe("blueprint-1");
    expect(result.current.latestDraft?.draftId).toBe("draft-2");
    expect(result.current.latestDraft?.title).toBe("Draft two");
  });

  it("routes open and explicit blueprint action callbacks", () => {
    const onOpenDraft = vi.fn();
    const onSelectBlueprint = vi.fn();
    const { result } = renderHook(() =>
      useSavedBlueprintsController({
        onEditBlueprintAsDraft: onSelectBlueprint,
        onOpenDraft,
      }),
    );

    result.current.onOpenDraft("draft-1");
    result.current.blueprintAction.onEditAsDraft("blueprint-1");

    expect(onOpenDraft).toHaveBeenCalledWith("draft-1");
    expect(onSelectBlueprint).toHaveBeenCalledWith(
      expect.objectContaining({ id: "blueprint-1" }),
    );
  });

  it("forwards pagination and retry callbacks", () => {
    const { result } = renderHook(() =>
      useSavedBlueprintsController({
        onEditBlueprintAsDraft: vi.fn(),
        onOpenDraft: vi.fn(),
      }),
    );

    result.current.onLoadMoreDrafts();
    result.current.onLoadMoreBlueprints();
    result.current.onRetry();

    expect(queryMocks.fetchDraftsNextPage).toHaveBeenCalledTimes(1);
    expect(queryMocks.fetchBlueprintsNextPage).toHaveBeenCalledTimes(1);
    expect(queryMocks.refetchDrafts).toHaveBeenCalledTimes(1);
    expect(queryMocks.refetchBlueprints).toHaveBeenCalledTimes(1);
  });

  it("maps initial and load-more errors separately for drafts", () => {
    queryState.drafts.isError = true;
    queryState.drafts.isFetchNextPageError = false;
    const { result } = renderHook(() =>
      useSavedBlueprintsController({
        onEditBlueprintAsDraft: vi.fn(),
        onOpenDraft: vi.fn(),
      }),
    );

    expect(result.current.draftsErrorMessage).toBe(
      "Recent work could not be loaded.",
    );
    expect(result.current.draftLoadMoreErrorMessage).toBeNull();
  });

  it("maps initial blueprint success and fetch-next-page errors separately", () => {
    queryState.blueprints.isError = false;
    queryState.blueprints.isFetchNextPageError = true;
    queryState.drafts.isFetchNextPageError = true;
    const { result } = renderHook(() =>
      useSavedBlueprintsController({
        onEditBlueprintAsDraft: vi.fn(),
        onOpenDraft: vi.fn(),
      }),
    );

    expect(result.current.errorMessage).toBeNull();
    expect(result.current.loadMoreErrorMessage).toBe(
      "More saved blueprints could not be loaded.",
    );
    expect(result.current.draftLoadMoreErrorMessage).toBe(
      "More recent work could not be loaded.",
    );
  });
});
