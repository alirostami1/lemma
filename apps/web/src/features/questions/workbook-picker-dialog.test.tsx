// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { workbookKeys } from "#/domains/workbooks/keys";
import { WorkbookPickerDialog } from "./workbook-picker-dialog";

describe("workbook picker dialog", () => {
  it("shows loading when a workbook filename is known but the file is not ready", () => {
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <WorkbookPickerDialog
          fileName="source.xlsx"
          previewSourceId={null}
          open
          onOpenChange={() => {}}
          selectionRequirement={{}}
          onSelectRange={() => {}}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByText("Loading source...")).toBeTruthy();
  });

  it("switches sheets from the sheet tabs", async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: Number.POSITIVE_INFINITY,
        },
      },
    });
    const workbookSnapshotId = "snapshot-1";

    queryClient.setQueryData(
      workbookKeys.snapshotCells(workbookSnapshotId, {
        sheetIndex: 0,
        startRow: 1,
        startColumn: 1,
        rowCount: 50,
        columnCount: 20,
      }),
      {
        sheetIndex: 0,
        sheetName: "First",
        startRow: 1,
        startColumn: 1,
        rowCount: 1,
        columnCount: 1,
        rows: [["First value"]],
        cellTypes: [["string"]],
      },
    );
    queryClient.setQueryData(
      workbookKeys.snapshotCells(workbookSnapshotId, {
        sheetIndex: 1,
        startRow: 1,
        startColumn: 1,
        rowCount: 50,
        columnCount: 20,
      }),
      {
        sheetIndex: 1,
        sheetName: "Second",
        startRow: 1,
        startColumn: 1,
        rowCount: 1,
        columnCount: 1,
        rows: [["Second value"]],
        cellTypes: [["string"]],
      },
    );

    render(
      <QueryClientProvider client={queryClient}>
        <WorkbookPickerDialog
          fileName="source.xlsx"
          previewSourceId={null}
          open
          onOpenChange={() => {}}
          selectionRequirement={{}}
          onSelectRange={() => {}}
          workbookSnapshotId={workbookSnapshotId}
          workbookSheets={[
            {
              sheetIndex: 0,
              name: "First",
              rowCount: 1,
              columnCount: 1,
              nonEmptyCellCount: 1,
            },
            {
              sheetIndex: 1,
              name: "Second",
              rowCount: 1,
              columnCount: 1,
              nonEmptyCellCount: 1,
            },
          ]}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByText("First value")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Second" }));

    expect(await screen.findByText("Second value")).toBeTruthy();
  });

  it("requests more sheet pages from the sheet tabs", async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: Number.POSITIVE_INFINITY,
        },
      },
    });
    const workbookSnapshotId = "snapshot-1";
    const onLoadMoreSheets = vi.fn();

    queryClient.setQueryData(
      workbookKeys.snapshotCells(workbookSnapshotId, {
        sheetIndex: 0,
        startRow: 1,
        startColumn: 1,
        rowCount: 50,
        columnCount: 20,
      }),
      {
        sheetIndex: 0,
        sheetName: "First",
        startRow: 1,
        startColumn: 1,
        rowCount: 1,
        columnCount: 1,
        rows: [["First value"]],
        cellTypes: [["string"]],
      },
    );

    render(
      <QueryClientProvider client={queryClient}>
        <WorkbookPickerDialog
          fileName="source.xlsx"
          previewSourceId="source_1"
          open
          onOpenChange={() => {}}
          selectionRequirement={{}}
          onSelectRange={() => {}}
          workbookSnapshotId={workbookSnapshotId}
          workbookSheets={[
            {
              sheetIndex: 0,
              name: "First",
              rowCount: 1,
              columnCount: 1,
              nonEmptyCellCount: 1,
            },
          ]}
          hasMoreSheets
          onLoadMoreSheets={onLoadMoreSheets}
        />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole("button", { name: "More sheets" }));

    expect(onLoadMoreSheets).toHaveBeenCalledTimes(1);
  });
});
