import { describe, expect, it } from "vitest";
import type { QuestionBlueprint } from "#/domains/questions/model";
import {
  buildHomePageViewModel,
  buildRecentBlueprintItems,
  buildRecentQuestionSetItems,
} from "./home-page-view-model";

function blueprint(
  id: string,
  input?: {
    status?: "active" | "archived" | "deleted";
    visibility?: "private" | "shared" | "system";
  },
): QuestionBlueprint {
  return {
    id,
    ownerUserId: "owner",
    createdByUserId: "creator",
    name: `Blueprint ${id}`,
    description: null,
    document: { schemaVersion: 1, blocks: [], responseFields: [] },
    workbookId: null,
    visibility: input?.visibility ?? "private",
    status: input?.status ?? "active",
    archivedAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  };
}

function questionSet(id: string) {
  return {
    id,
    ownerUserId: "owner",
    createdByUserId: "creator",
    name: `Question Set ${id}`,
    description: `Desc ${id}`,
    status: "active" as const,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  };
}

describe("home page view model", () => {
  it("limits recent items to three", () => {
    const viewModel = buildHomePageViewModel({
      blueprints: ["1", "2", "3", "4"].map((id) => blueprint(id)),
      questionSets: ["1", "2", "3", "4"].map((id) => questionSet(id)),
    });

    expect(viewModel.recentBlueprints).toHaveLength(3);
    expect(viewModel.recentQuestionSets).toHaveLength(3);
  });

  it("builds stable action params", () => {
    const blueprintItem = buildRecentBlueprintItems([blueprint("b1")])[0];
    const questionSetItem = buildRecentQuestionSetItems([questionSet("q1")])[0];

    expect(
      blueprintItem && "search" in blueprintItem && blueprintItem.search,
    ).toEqual({
      blueprintId: "b1",
    });
    expect(
      questionSetItem && "params" in questionSetItem && questionSetItem.params,
    ).toEqual({
      questionSetId: "q1",
    });
  });

  it("keeps stable empty-state copy", () => {
    const viewModel = buildHomePageViewModel({
      blueprints: [],
      questionSets: [],
    });

    expect(viewModel.emptyState).toEqual({
      title: "Create your first blueprint",
      description:
        "Start in Studio, save your blueprint, then generate questions into a question set.",
      action: {
        label: "Create blueprint",
        to: "/create",
        variant: "primary",
      },
    });
  });

  it("filters deleted and system blueprints", () => {
    expect(
      buildRecentBlueprintItems([
        blueprint("active"),
        blueprint("deleted", { status: "deleted" }),
        blueprint("system", { visibility: "system" }),
      ]).map((item) => item.id),
    ).toEqual(["active"]);
  });
});
