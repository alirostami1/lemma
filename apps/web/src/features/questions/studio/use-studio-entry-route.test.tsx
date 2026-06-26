// @vitest-environment jsdom

import { renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  parseStudioRouteIntent,
  type StudioRouteSearch,
} from "./studio-route-intent";
import { useStudioEntryRoute } from "./use-studio-entry-route";

const draftMutations = vi.hoisted(() => ({
  createDraft: vi.fn(),
  createEditDraft: vi.fn(),
}));

vi.mock("#/domains/questions", () => ({
  useCreateQuestionBlueprintDraft: () => ({
    mutateAsync: draftMutations.createDraft,
  }),
  useCreateQuestionBlueprintEditDraft: () => ({
    mutateAsync: draftMutations.createEditDraft,
  }),
}));

function renderEntryRoute(
  routeSearch: StudioRouteSearch,
  options?: { strict?: boolean },
) {
  const navigate = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) =>
    options?.strict ? <StrictMode>{children}</StrictMode> : children;
  const intent = parseStudioRouteIntent(routeSearch);
  if (intent.type === "landing" || intent.type === "edit_draft") {
    throw new Error("Expected Studio entry route intent.");
  }
  const result = renderHook(
    () =>
      useStudioEntryRoute({
        intent,
        navigate,
      }),
    { wrapper },
  );

  return { navigate, ...result };
}

describe("useStudioEntryRoute", () => {
  beforeEach(() => {
    draftMutations.createDraft.mockReset();
    draftMutations.createDraft.mockResolvedValue({
      draft: { id: "draft-new" },
    });
    draftMutations.createEditDraft.mockReset();
    draftMutations.createEditDraft.mockResolvedValue({
      draft: { id: "draft-edit" },
      resolution: "created",
    });
  });

  it("creates draft for new route and replaces with draftId", async () => {
    const { navigate } = renderEntryRoute({ new: "1" });

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        replace: true,
        search: { draftId: "draft-new" },
        to: "/studio",
      }),
    );
    expect(draftMutations.createDraft).toHaveBeenCalledOnce();
  });

  it("creates or resumes edit draft for blueprint route", async () => {
    const { navigate } = renderEntryRoute({ blueprintId: "blueprint-1" });

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        replace: true,
        search: { draftId: "draft-edit" },
        to: "/studio",
      }),
    );
    expect(draftMutations.createEditDraft).toHaveBeenCalledWith({
      questionBlueprintId: "blueprint-1",
    });
  });

  it("does not duplicate new draft creation under Strict Mode", async () => {
    let resolveDraft: (result: { draft: { id: string } }) => void = () => {};
    draftMutations.createDraft.mockReturnValue(
      new Promise((resolve) => {
        resolveDraft = resolve;
      }),
    );

    const { navigate } = renderEntryRoute({ new: "1" }, { strict: true });

    await waitFor(() =>
      expect(draftMutations.createDraft).toHaveBeenCalledOnce(),
    );
    resolveDraft({ draft: { id: "draft-strict" } });
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        replace: true,
        search: { draftId: "draft-strict" },
        to: "/studio",
      }),
    );
  });
});
