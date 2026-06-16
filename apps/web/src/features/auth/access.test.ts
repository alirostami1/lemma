import { describe, expect, it } from "vitest";
import {
  canAccess,
  getRolesFromDecodedToken,
  hasAllRoles,
  hasAnyRole,
  hasRole,
} from "./access";

const user = { roles: ["author", "reviewer"] };

describe("auth access helpers", () => {
  it("extracts realm roles", () => {
    expect(
      getRolesFromDecodedToken({
        realm_access: { roles: ["author", "reviewer"] },
      }),
    ).toEqual(["author", "reviewer"]);
    expect(getRolesFromDecodedToken(null)).toEqual([]);
  });

  it("matches roles exactly", () => {
    expect(hasRole(user, "author")).toBe(true);
    expect(hasRole(user, "Author")).toBe(false);
    expect(hasAllRoles(user, ["author", "reviewer"])).toBe(true);
    expect(hasAnyRole(user, ["admin", "reviewer"])).toBe(true);
  });

  it("handles empty role requirements intentionally", () => {
    expect(canAccess(user, { type: "all_roles", roles: [] })).toBe(true);
    expect(canAccess(user, { type: "any_role", roles: [] })).toBe(false);
  });

  it("requires a logged-in user for every requirement", () => {
    expect(canAccess(null, { type: "login" })).toBe(false);
    expect(canAccess(user, { type: "login" })).toBe(true);
  });
});
