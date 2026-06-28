import { describe, expect, it } from "vitest";
import { primaryNavigation } from "./app-navigation";

describe("primaryNavigation", () => {
  it("uses Studio as the only authoring destination", () => {
    expect(primaryNavigation).toEqual([
      { label: "Home", to: "/" },
      { label: "Studio", to: "/studio" },
      { label: "Question Sets", to: "/question-sets" },
    ]);
  });
});
