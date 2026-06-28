// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { RecentWorkSection } from "./home-page-sections";
import { HOME_CREATE_BLUEPRINT_ACTION } from "./home-page-view-model";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    ...props
  }: {
    children: ReactNode;
    to: string;
  } & ComponentPropsWithoutRef<"a">) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

describe("RecentWorkSection", () => {
  it("links the create-blueprint action to Studio", () => {
    render(
      <RecentWorkSection
        action={{ ...HOME_CREATE_BLUEPRINT_ACTION, variant: "secondary" }}
        emptyMessage="No saved blueprints yet."
        errorMessage={null}
        isLoading={false}
        items={[]}
        onRetry={() => {}}
        title="Saved blueprints"
      />,
    );

    expect(
      screen
        .getByRole("link", { name: "Create blueprint" })
        .getAttribute("href"),
    ).toBe("/studio");
  });
});
