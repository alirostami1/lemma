import { describe, expect, it } from "vitest";
import {
  buildBlueprintListItems,
  buildCreatePageViewModel,
} from "./create-page-view-model";

function blueprint(
  id: string,
  input?: {
    status?: "active" | "archived" | "deleted";
    visibility?: "private" | "shared" | "system";
    sources?: Array<{
      sourceId: string;
      name: string;
      workbookId: string;
    }>;
  },
) {
  return {
    id,
    name: `Blueprint ${id}`,
    sources: input?.sources ?? [],
    status: input?.status ?? "active",
    visibility: input?.visibility ?? "private",
  };
}

describe("create page view model", () => {
  it("limits recent blueprints to three items", () => {
    const viewModel = buildCreatePageViewModel({
      blueprints: ["1", "2", "3", "4"].map((id) => blueprint(id)),
    });

    expect(viewModel.savedBlueprints.recentItems).toHaveLength(3);
  });

  it("excludes deleted and system blueprints", () => {
    expect(
      buildBlueprintListItems([
        blueprint("active"),
        blueprint("deleted", { status: "deleted" }),
        blueprint("system", { visibility: "system" }),
      ]).map((item) => item.id),
    ).toEqual(["active"]);
  });

  it("builds stable empty states and Studio search params", () => {
    const viewModel = buildCreatePageViewModel({
      blueprints: [],
    });
    const blueprintItem = buildBlueprintListItems([
      blueprint("blueprint-1"),
    ])[0];
    const sourcedBlueprintItem = buildBlueprintListItems([
      blueprint("blueprint-2", {
        sources: [
          {
            name: "Workbook 1",
            sourceId: "source-1",
            workbookId: "workbook-1",
          },
        ],
      }),
    ])[0];

    expect(viewModel.savedBlueprints.emptyMessage).toBe(
      "No saved blueprints yet.",
    );
    expect(blueprintItem?.action.search).toEqual({
      blueprintId: "blueprint-1",
    });
    expect(blueprintItem?.description).toBe("No sources attached");
    expect(sourcedBlueprintItem?.description).toBe("Sources attached");
  });
});
