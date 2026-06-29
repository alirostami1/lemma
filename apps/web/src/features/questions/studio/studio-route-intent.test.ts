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

  it("preserves valid trimmed route search params", () => {
    expect(
      parseStudioRouteSearch({
        blueprintId: " blueprint-1 ",
        draftId: " draft-1 ",
        new: "1",
      }),
    ).toEqual({
      blueprintId: "blueprint-1",
      draftId: "draft-1",
      new: "1",
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
        blueprintId: 42,
        draftId: 42,
        new: 1,
      }),
    ).toEqual({
      blueprintId: undefined,
      draftId: undefined,
      new: "1",
    });
  });

  it("normalizes numeric new route search from browser URL parsing", () => {
    expect(parseStudioRouteSearch({ new: 1 })).toEqual({
      blueprintId: undefined,
      draftId: undefined,
      new: "1",
    });
    expect(parseStudioRouteIntent(parseStudioRouteSearch({ new: 1 }))).toEqual({
      type: "new_draft",
    });
    expect(normalizeStudioRoute(parseStudioRouteSearch({ new: 1 }))).toEqual({
      new: "1",
    });
  });

  it("accepts only explicit new draft route markers", () => {
    expect(parseStudioRouteSearch({ new: "1" })).toEqual({
      blueprintId: undefined,
      draftId: undefined,
      new: "1",
    });
    expect(parseStudioRouteSearch({ new: 1 })).toEqual({
      blueprintId: undefined,
      draftId: undefined,
      new: "1",
    });

    expect(parseStudioRouteSearch({ new: true })).toEqual({
      blueprintId: undefined,
      draftId: undefined,
      new: undefined,
    });
    expect(parseStudioRouteSearch({ new: "true" })).toEqual({
      blueprintId: undefined,
      draftId: undefined,
      new: undefined,
    });
    expect(parseStudioRouteSearch({ new: 2 })).toEqual({
      blueprintId: undefined,
      draftId: undefined,
      new: undefined,
    });
    expect(parseStudioRouteSearch({ new: "2" })).toEqual({
      blueprintId: undefined,
      draftId: undefined,
      new: undefined,
    });
    expect(parseStudioRouteSearch({ new: "" })).toEqual({
      blueprintId: undefined,
      draftId: undefined,
      new: undefined,
    });
    expect(parseStudioRouteSearch({ new: {} })).toEqual({
      blueprintId: undefined,
      draftId: undefined,
      new: undefined,
    });
    expect(parseStudioRouteSearch({ new: [] })).toEqual({
      blueprintId: undefined,
      draftId: undefined,
      new: undefined,
    });
  });
});
