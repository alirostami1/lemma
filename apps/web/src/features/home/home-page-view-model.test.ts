import { describe, expect, it } from "vitest";
import type { QuestionBlueprint } from "#/domains/questions/model";
import {
  buildHomePageViewModel,
  buildRecentBlueprintItems,
  buildRecentQuestionSetItems,
  HOME_CREATE_BLUEPRINT_ACTION,
} from "./home-page-view-model";

function blueprint(
  id: string,
  input?: {
    status?: "active" | "archived" | "deleted";
    visibility?: "private" | "shared" | "system";
  },
): QuestionBlueprint {
  return {
    archivedAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    createdByUserId: "creator",
    currentVersionId: `version-${id}`,
    description: null,
    document: { blocks: [], responseFields: [], schemaVersion: 1 },
    id,
    name: `Blueprint ${id}`,
    ownerUserId: "owner",
    sources: [],
    status: input?.status ?? "active",
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    visibility: input?.visibility ?? "private",
  };
}

function questionSet(id: string) {
  return {
    createdAt: new Date("2026-01-01T00:00:00Z"),
    createdByUserId: "creator",
    description: `Desc ${id}`,
    id,
    name: `Question Set ${id}`,
    ownerUserId: "owner",
    status: "active" as const,
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
      action: HOME_CREATE_BLUEPRINT_ACTION,
      description:
        "Start in Studio, save your blueprint, then generate questions into a question set.",
      title: "Create your first blueprint",
    });
    expect(viewModel.hero.primaryAction).toEqual(HOME_CREATE_BLUEPRINT_ACTION);
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
