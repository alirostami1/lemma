// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioWorkbookSource } from "./studio-source-model";
import { StudioSourcePickerDialog } from "./studio-source-picker-dialog";

const mockParseLocalWorkbookFile = vi.fn();

vi.mock("#/domains/workbooks/local-xlsx", () => ({
  parseLocalWorkbookFile: (file: File) => mockParseLocalWorkbookFile(file),
}));

describe("StudioSourcePickerDialog", () => {
  beforeEach(() => {
    mockParseLocalWorkbookFile.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows local workbook flow only", () => {
    renderDialog();

    expect(screen.getByText("Workbook file")).toBeTruthy();
    expect(screen.getByText("Accepts .xlsx")).toBeTruthy();
    expect(screen.queryByText("Existing")).toBeNull();
    expect(screen.queryByText("Upload")).toBeNull();
    expect(screen.queryByText("Load more")).toBeNull();
  });

  it("parses xlsx file and creates local source", async () => {
    const user = userEvent.setup();
    const onCreateSource = vi.fn();
    mockParseLocalWorkbookFile.mockResolvedValue({
      status: "parsed",
      workbook: {
        byteSize: 16,
        cellsByKey: new Map(),
        fileName: "Budget Q1.xlsx",
        parsedAt: new Date("2026-06-21T00:00:00.000Z"),
        sheetCount: 2,
        sheets: [
          {
            columnCount: 3,
            name: "Sheet1",
            rowCount: 3,
            usedRange: "Sheet1!A1:C3",
          },
          {
            columnCount: 2,
            name: "Rates",
            rowCount: 2,
            usedRange: "Rates!A1:B2",
          },
        ],
      },
    });

    renderDialog({ onCreateSource });

    await user.upload(
      screen.getByLabelText("Choose workbook file"),
      workbookFile("Budget Q1.xlsx"),
    );

    expect(await screen.findByText("Parsed")).toBeTruthy();
    expect(screen.getByText("2 sheets")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Add workbook" }));

    expect(onCreateSource).toHaveBeenCalledWith(
      expect.objectContaining({
        backing: expect.objectContaining({
          kind: "local_file",
          parseStatus: "parsed",
        }),
        name: "Budget Q1",
        sourceId: "budget-q1",
      }),
    );
  });

  it("shows parse error and allows retry", async () => {
    const user = userEvent.setup();
    mockParseLocalWorkbookFile
      .mockResolvedValueOnce({
        error: {
          code: "parse_failed",
          message: "Workbook could not be parsed.",
        },
        status: "failed",
      })
      .mockResolvedValueOnce({
        status: "parsed",
        workbook: {
          byteSize: 16,
          cellsByKey: new Map(),
          fileName: "Budget Q1.xlsx",
          parsedAt: new Date("2026-06-21T00:00:00.000Z"),
          sheetCount: 1,
          sheets: [
            {
              columnCount: 1,
              name: "Sheet1",
              rowCount: 1,
              usedRange: "Sheet1!A1",
            },
          ],
        },
      });

    renderDialog();
    const input = screen.getByLabelText("Choose workbook file");

    await user.upload(input, workbookFile("Broken.xlsx"));
    expect(
      await screen.findByText("Workbook could not be parsed."),
    ).toBeTruthy();

    await user.upload(input, workbookFile("Budget Q1.xlsx"));
    await waitFor(() => {
      expect(screen.getByText("Parsed")).toBeTruthy();
    });
  });

  it("blocks duplicate local file", async () => {
    const user = userEvent.setup();
    mockParseLocalWorkbookFile.mockResolvedValue({
      status: "parsed",
      workbook: {
        byteSize: 16,
        cellsByKey: new Map(),
        fileName: "Budget.xlsx",
        parsedAt: new Date("2026-06-21T00:00:00.000Z"),
        sheetCount: 1,
        sheets: [
          {
            columnCount: 1,
            name: "Sheet1",
            rowCount: 1,
            usedRange: "Sheet1!A1",
          },
        ],
      },
    });

    renderDialog({
      existingSources: [
        existingLocalSource({
          byteSize: 4,
          lastModified: 5,
          originalName: "Budget.xlsx",
          sourceId: "budget",
        }),
      ],
    });

    await user.upload(
      screen.getByLabelText("Choose workbook file"),
      workbookFile("Budget.xlsx", 5),
    );

    expect(
      await screen.findByText("This file is already attached."),
    ).toBeTruthy();
  });
});

function renderDialog(input?: {
  existingSources?: readonly StudioWorkbookSource[];
  onCreateSource?: (source: StudioWorkbookSource) => void;
}) {
  return render(
    <StudioSourcePickerDialog
      existingSources={input?.existingSources ?? []}
      onCreateSource={input?.onCreateSource ?? (() => {})}
      onOpenChange={() => {}}
      open
    />,
  );
}

function workbookFile(name: string, lastModified = 1): File {
  return new File(["cell"], name, {
    lastModified,
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function existingLocalSource(input: {
  sourceId: string;
  originalName: string;
  byteSize: number;
  lastModified: number;
}): StudioWorkbookSource {
  return {
    backing: {
      byteSize: input.byteSize,
      file: workbookFile(input.originalName, input.lastModified),
      kind: "local_file",
      lastModified: input.lastModified,
      originalName: input.originalName,
      parsedWorkbook: null,
      parseError: null,
      parseStatus: "parsed",
      uploadError: null,
      uploadStatus: "not_uploaded",
      workbookId: null,
    },
    createdAt: new Date("2026-06-21T00:00:00.000Z"),
    name: input.originalName.replace(/\.xlsx$/u, ""),
    sourceId: input.sourceId,
    type: "workbook",
  };
}
