import { describe, expect, it } from "vitest";
import {
  normalizeStudioRoute,
  parseStudioRouteIntent,
  parseStudioRouteSearch,
} from "./studio-route-intent";

describe("Studio route intent", () => {
  it("parses landing for empty studio route", () => {
    expect(parseStudioRouteIntent({})).toEqual({ type: "landing" });
    expect(normalizeStudioRoute({})).toEqual({});
  });

  it("parses new draft intent", () => {
    expect(parseStudioRouteIntent({ new: "1" })).toEqual({
      type: "new_draft",
    });
    expect(normalizeStudioRoute({ new: "1" })).toEqual({ new: "1" });
  });

  it("parses blueprint edit intent", () => {
    expect(parseStudioRouteIntent({ blueprintId: "blueprint-1" })).toEqual({
      blueprintId: "blueprint-1",
      type: "edit_blueprint",
    });
    expect(normalizeStudioRoute({ blueprintId: "blueprint-1" })).toEqual({
      blueprintId: "blueprint-1",
    });
  });

  it("prefers draftId over new and blueprintId", () => {
    expect(
      parseStudioRouteIntent({
        blueprintId: "blueprint-1",
        draftId: "draft-1",
        new: "1",
      }),
    ).toEqual({ draftId: "draft-1", type: "edit_draft" });
    expect(
      normalizeStudioRoute({
        blueprintId: "blueprint-1",
        draftId: "draft-1",
        new: "1",
      }),
    ).toEqual({ draftId: "draft-1" });
  });

  it("prefers new over blueprintId", () => {
    expect(
      parseStudioRouteIntent({ blueprintId: "blueprint-1", new: "1" }),
    ).toEqual({ type: "new_draft" });
    expect(
      normalizeStudioRoute({ blueprintId: "blueprint-1", new: "1" }),
    ).toEqual({ new: "1" });
  });

  it("coerces route search params in one place", () => {
    expect(
      parseStudioRouteSearch({
        blueprintId: "blueprint-1",
        draftId: 42,
        new: "1",
      }),
    ).toEqual({
      blueprintId: "blueprint-1",
      draftId: undefined,
      new: "1",
    });
  });
});
