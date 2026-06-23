// @vitest-environment jsdom

import {
  ResourceList,
  ResourceListItem,
} from "@lemma/ui/components/resource-list";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(() => cleanup());

describe("ResourceList", () => {
  it("renders a navigation item as one full-row link", () => {
    render(
      <ResourceList>
        <ResourceListItem
          description="Open blueprint"
          navigationAccessory={<span>Next</span>}
          renderLink={(children, className) => (
            <a className={className} href="/blueprint">
              {children}
            </a>
          )}
          title="Saved blueprint"
          variant="navigation"
        />
      </ResourceList>,
    );

    const link = screen.getByRole("link", { name: /Saved blueprint/ });
    expect(link.className).toContain("px-3");
    expect(link.className).toContain("py-2.5");
    expect(link.className).toContain("hover:bg-muted/40");
    expect(link.contains(screen.getByText("Next"))).toBe(true);
  });

  it("keeps display item actions outside item content", () => {
    render(
      <ResourceList>
        <ResourceListItem
          title="Saved blueprint"
          trailingAction={<button type="button">Generate</button>}
          variant="display"
        />
      </ResourceList>,
    );

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByRole("button", { name: "Generate" })).toBeTruthy();
  });

  it("renders stacked lists with explicit spacing", () => {
    const { container } = render(
      <ResourceList variant="stacked">
        <ResourceListItem title="One" variant="display" />
        <ResourceListItem title="Two" variant="display" />
      </ResourceList>,
    );

    expect(container.firstElementChild?.className).toContain("grid");
    expect(container.firstElementChild?.className).toContain("gap-2");
    expect(container.firstElementChild?.className).not.toContain("divide-y");
  });
});
