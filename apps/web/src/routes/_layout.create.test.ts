import { isRedirect } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";
import { Route, redirectCreateToStudio } from "./_layout.create";

describe("create route", () => {
  it("redirects to Studio", () => {
    try {
      redirectCreateToStudio();
      expect.unreachable("Expected /create to redirect");
    } catch (error) {
      expect(isRedirect(error)).toBe(true);
      if (isRedirect(error)) {
        expect(error.options).toMatchObject({
          replace: true,
          to: "/studio",
        });
      }
    }
  });

  it("wires the route beforeLoad to the Studio redirect", () => {
    expect(Route.options.beforeLoad).toBe(redirectCreateToStudio);
  });
});
