// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkbookPickerDialog } from "./workbook-picker-dialog";

describe("workbook picker dialog", () => {
  it("shows loading when a workbook filename is known but the file is not ready", () => {
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <WorkbookPickerDialog
          fileName="source.xlsx"
          open
          onOpenChange={() => {}}
          selectionRequirement={{}}
          onSelectRange={() => {}}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByText("Loading source...")).toBeTruthy();
  });
});
