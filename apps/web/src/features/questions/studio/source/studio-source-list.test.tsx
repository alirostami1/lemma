// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getUsedSourceRemoveReason,
  type StudioSourceUsageSummary,
} from "./source-usage";
import { StudioSourceList } from "./studio-source-list";
import type { StudioWorkbookSource } from "./studio-source-model";

describe("StudioSourceList", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders collapsed aggregate bar and add source button", async () => {
    const user = userEvent.setup();
    const onAddSource = vi.fn();

    render(
      <StudioSourceList
        isExpanded={false}
        onAddSource={onAddSource}
        onExpandedChange={() => {}}
        onReattachSource={async () => ({ reason: "", status: "blocked" })}
        onRemoveSource={() => {}}
        sources={[]}
        usageBySourceId={new Map()}
      />,
    );

    expect(screen.getByText("Sources")).toBeTruthy();
    expect(screen.getByText("0 attached")).toBeTruthy();
    expect(screen.queryByText("No sources attached.")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Add source" }));
    expect(onAddSource).toHaveBeenCalledTimes(1);
  });

  it("renders expanded source rows and removes unused source", async () => {
    const user = userEvent.setup();
    const onRemoveSource = vi.fn();
    const source = localSource("budget-q1");

    render(
      <StudioSourceList
        isExpanded={true}
        onAddSource={() => {}}
        onExpandedChange={() => {}}
        onReattachSource={async () => ({ reason: "", status: "blocked" })}
        onRemoveSource={onRemoveSource}
        sources={[source]}
        usageBySourceId={
          new Map([[source.sourceId, removableUsage(source.sourceId)]])
        }
      />,
    );

    expect(screen.getByText("Workbook · 1 sheets · not used")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Remove budget-q1" }));
    expect(onRemoveSource).toHaveBeenCalledWith("budget-q1");
  });

  it("blocks removal for used source and shows canonical usage details", async () => {
    const user = userEvent.setup();
    const source = localSource("alpha");
    const reason = getUsedSourceRemoveReason();

    render(
      <StudioSourceList
        isExpanded={true}
        onAddSource={() => {}}
        onExpandedChange={() => {}}
        onReattachSource={async () => ({ reason: "", status: "blocked" })}
        onRemoveSource={() => {}}
        sources={[source]}
        usageBySourceId={
          new Map([
            [
              source.sourceId,
              {
                isUsed: true,
                referenceCount: 1,
                removal: {
                  reason,
                  removable: false,
                },
                sourceId: source.sourceId,
                usedWhere: [
                  {
                    kind: "block",
                    label: "Text block 1",
                    referenceId: "ref_1",
                    referenceKind: "cell",
                    referenceName: "workbook:alpha:cell:Sheet1:A1",
                    sourceRef: "Sheet1!A1",
                  },
                ],
              } satisfies StudioSourceUsageSummary,
            ],
          ])
        }
      />,
    );

    expect(screen.getByRole("button", { name: "Remove alpha" })).toBeDisabled();
    await user.click(
      screen.getByRole("button", {
        name: "Source details for alpha",
      }),
    );

    expect(
      screen.getByText("Text block 1 · workbook:alpha:cell:Sheet1:A1"),
    ).toBeTruthy();
  });

  it("renders restoring source without missing-file issue", () => {
    render(
      <StudioSourceList
        isExpanded={true}
        onAddSource={() => {}}
        onExpandedChange={() => {}}
        onReattachSource={async () => ({ reason: "", status: "blocked" })}
        onRemoveSource={() => {}}
        sources={[restoringSource("budget-q1")]}
        usageBySourceId={new Map()}
      />,
    );

    expect(screen.getByText("Workbook · restoring · not used")).toBeTruthy();
    expect(screen.queryByText(/Workbook file missing/u)).toBeNull();
  });

  it("renders reattach action for missing local file", async () => {
    const user = userEvent.setup();

    render(
      <StudioSourceList
        isExpanded={true}
        onAddSource={() => {}}
        onExpandedChange={() => {}}
        onReattachSource={async () => ({ reason: "", status: "blocked" })}
        onRemoveSource={() => {}}
        sources={[missingSource("budget-q1")]}
        usageBySourceId={new Map()}
      />,
    );

    const detailsButton = screen.getAllByRole("button", {
      name: "Source details for budget-q1",
    })[0];
    if (!detailsButton) {
      throw new Error("Expected source details button.");
    }
    await user.click(detailsButton);

    expect(screen.getByRole("button", { name: "Reattach file" })).toBeTruthy();
    expect(
      screen.getByText(
        "Saved source file could not be restored. Reattach the file to continue.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/draft/i)).toBeNull();
  });

  it("shows saved work wording for persisted sources", () => {
    render(
      <StudioSourceList
        isExpanded={true}
        onAddSource={() => {}}
        onExpandedChange={() => {}}
        onReattachSource={async () => ({ reason: "", status: "blocked" })}
        onRemoveSource={() => {}}
        sources={[savedWorkSource("budget-q1")]}
        usageBySourceId={new Map()}
      />,
    );

    expect(screen.getByText("Workbook · 1 sheets · not used")).toBeTruthy();
    expect(screen.getByText("saved in current work")).toBeTruthy();
    expect(screen.queryByText(/saved in draft/i)).toBeNull();
  });
});

function removableUsage(sourceId: string): StudioSourceUsageSummary {
  return {
    isUsed: false,
    referenceCount: 0,
    removal: { removable: true },
    sourceId,
    usedWhere: [],
  };
}

function localSource(name: string): StudioWorkbookSource {
  return {
    backing: {
      byteSize: 4,
      file: new File(["test"], `${name}.xlsx`, {
        lastModified: 1,
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      kind: "local_file",
      lastModified: 1,
      originalName: `${name}.xlsx`,
      parsedWorkbook: {
        byteSize: 4,
        cellsByKey: new Map(),
        fileName: `${name}.xlsx`,
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
      parseError: null,
      parseStatus: "parsed",
      uploadError: null,
      uploadStatus: "not_uploaded",
      workbookId: null,
    },
    createdAt: new Date("2026-06-21T00:00:00.000Z"),
    name,
    sourceId: name,
    type: "workbook",
  };
}

function restoringSource(name: string): StudioWorkbookSource {
  return {
    backing: {
      byteSize: 4,
      kind: "restoring_local_file",
      lastModified: 1,
      originalName: `${name}.xlsx`,
      workbookId: null,
    },
    createdAt: new Date("2026-06-21T00:00:00.000Z"),
    name,
    sourceId: name,
    type: "workbook",
  };
}

function missingSource(name: string): StudioWorkbookSource {
  return {
    backing: {
      byteSize: 4,
      kind: "missing_local_file",
      lastModified: 1,
      originalName: `${name}.xlsx`,
      parseError:
        "Saved source file could not be restored. Reattach the file to continue.",
      workbookId: null,
    },
    createdAt: new Date("2026-06-21T00:00:00.000Z"),
    name,
    sourceId: name,
    type: "workbook",
  };
}

function savedWorkSource(name: string): StudioWorkbookSource {
  return {
    backing: {
      byteSize: 4,
      checksumSha256: "checksum-1",
      fileId: "file-1",
      kind: "draft_file",
      originalName: `${name}.xlsx`,
      parsedWorkbook: {
        byteSize: 4,
        cellsByKey: new Map(),
        fileName: `${name}.xlsx`,
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
      previewError: null,
      previewStatus: "loaded",
      workbookId: null,
    },
    createdAt: new Date("2026-06-21T00:00:00.000Z"),
    name,
    sourceId: name,
    type: "workbook",
  };
}
