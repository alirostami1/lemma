// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { workbookKeys } from "#/domains/workbooks/keys";
import type { LocalWorkbookParseResult } from "#/domains/workbooks/local-xlsx";
import {
  buildLocalWorkbookPickerCells,
  WorkbookPickerDialog,
} from "./workbook-picker-dialog";

describe("workbook picker dialog", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows loading when a workbook filename is known but the file is not ready", () => {
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <WorkbookPickerDialog
          fileName="source.xlsx"
          onOpenChange={() => {}}
          onSelectRange={() => {}}
          open
          selectionRequirement={{}}
          sourceId={null}
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
        columnCount: 20,
        rowCount: 50,
        sheetIndex: 0,
        startColumn: 1,
        startRow: 1,
      }),
      {
        cellTypes: [["string"]],
        columnCount: 1,
        rowCount: 1,
        rows: [["First value"]],
        sheetIndex: 0,
        sheetName: "First",
        startColumn: 1,
        startRow: 1,
      },
    );
    queryClient.setQueryData(
      workbookKeys.snapshotCells(workbookSnapshotId, {
        columnCount: 20,
        rowCount: 50,
        sheetIndex: 1,
        startColumn: 1,
        startRow: 1,
      }),
      {
        cellTypes: [["string"]],
        columnCount: 1,
        rowCount: 1,
        rows: [["Second value"]],
        sheetIndex: 1,
        sheetName: "Second",
        startColumn: 1,
        startRow: 1,
      },
    );

    render(
      <QueryClientProvider client={queryClient}>
        <WorkbookPickerDialog
          fileName="source.xlsx"
          onOpenChange={() => {}}
          onSelectRange={() => {}}
          open
          selectionRequirement={{}}
          sourceId={null}
          workbookSheets={[
            {
              columnCount: 1,
              name: "First",
              nonEmptyCellCount: 1,
              rowCount: 1,
              sheetIndex: 0,
            },
            {
              columnCount: 1,
              name: "Second",
              nonEmptyCellCount: 1,
              rowCount: 1,
              sheetIndex: 1,
            },
          ]}
          workbookSnapshotId={workbookSnapshotId}
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
        columnCount: 20,
        rowCount: 50,
        sheetIndex: 0,
        startColumn: 1,
        startRow: 1,
      }),
      {
        cellTypes: [["string"]],
        columnCount: 1,
        rowCount: 1,
        rows: [["First value"]],
        sheetIndex: 0,
        sheetName: "First",
        startColumn: 1,
        startRow: 1,
      },
    );

    render(
      <QueryClientProvider client={queryClient}>
        <WorkbookPickerDialog
          fileName="source.xlsx"
          hasMoreSheets
          onLoadMoreSheets={onLoadMoreSheets}
          onOpenChange={() => {}}
          onSelectRange={() => {}}
          open
          selectionRequirement={{}}
          sourceId="source_1"
          workbookSheets={[
            {
              columnCount: 1,
              name: "First",
              nonEmptyCellCount: 1,
              rowCount: 1,
              sheetIndex: 0,
            },
          ]}
          workbookSnapshotId={workbookSnapshotId}
        />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole("button", { name: "More sheets" }));

    expect(onLoadMoreSheets).toHaveBeenCalledTimes(1);
  });

  it("builds local workbook picker cells without a snapshot", () => {
    const cells = buildLocalWorkbookPickerCells({
      columnCount: 2,
      rowCount: 2,
      sheet: {
        columnCount: 2,
        name: "Rates",
        nonEmptyCellCount: 2,
        rowCount: 2,
        sheetIndex: 0,
      },
      startColumn: 1,
      startRow: 1,
      workbook: localWorkbook(),
    });

    expect(cells.rows).toEqual([
      ["Name", ""],
      ["Alpha", ""],
    ]);
    expect(cells.cellTypes).toEqual([
      ["string", "blank"],
      ["string", "blank"],
    ]);
  });
});

function localWorkbook(): LocalWorkbookParseResult {
  return {
    byteSize: 12,
    cellsByKey: new Map([
      [
        "Rates::A1",
        {
          address: "A1",
          displayValue: "Name",
          formula: null,
          hasCachedValue: true,
          rawValue: "Name",
          sheetName: "Rates",
          type: "string",
        },
      ],
      [
        "Rates::A2",
        {
          address: "A2",
          displayValue: "Alpha",
          formula: null,
          hasCachedValue: true,
          rawValue: "Alpha",
          sheetName: "Rates",
          type: "string",
        },
      ],
      [
        "Notes::A1",
        {
          address: "A1",
          displayValue: "Hello",
          formula: null,
          hasCachedValue: true,
          rawValue: "Hello",
          sheetName: "Notes",
          type: "string",
        },
      ],
    ]),
    fileName: "local.xlsx",
    parsedAt: new Date("2026-06-21T00:00:00.000Z"),
    sheetCount: 2,
    sheets: [
      { columnCount: 2, name: "Rates", rowCount: 2, usedRange: "Rates!A1:B2" },
      { columnCount: 1, name: "Notes", rowCount: 1, usedRange: "Notes!A1" },
    ],
  };
}
