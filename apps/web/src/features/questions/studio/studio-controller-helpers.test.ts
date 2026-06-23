import { describe, expect, it, vi } from "vitest";
import {
  navigateToStudioBlueprint,
  navigateToStudioDraft,
  toStudioSearch,
} from "./studio-controller-helpers";

describe("studio controller helpers", () => {
  it("maps draft target to only draftId", () => {
    expect(toStudioSearch({ draftId: "draft-1", kind: "draft" })).toEqual({
      draftId: "draft-1",
    });
  });

  it("maps blueprint target to only blueprintId", () => {
    expect(
      toStudioSearch({ blueprintId: "blueprint-1", kind: "blueprint" }),
    ).toEqual({
      blueprintId: "blueprint-1",
    });
  });

  it("maps blank target to empty object", () => {
    expect(toStudioSearch({ kind: "blank" })).toEqual({});
  });
});

describe("navigation helpers", () => {
  it("navigates with route-only search payloads", () => {
    const navigate = vi.fn();

    void navigateToStudioDraft(navigate, "draft-1", { replace: true });
    void navigateToStudioBlueprint(navigate, "blueprint-1", { replace: true });

    expect(navigate).toHaveBeenNthCalledWith(1, {
      replace: true,
      search: { draftId: "draft-1" },
      to: "/studio",
    });
    expect(navigate).toHaveBeenNthCalledWith(2, {
      replace: true,
      search: { blueprintId: "blueprint-1" },
      to: "/studio",
    });
  });
});
