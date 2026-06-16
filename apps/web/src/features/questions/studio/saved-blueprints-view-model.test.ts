import { describe, expect, it } from "vitest";
import type { QuestionBlueprint } from "#/domains/questions/model";
import { buildSavedBlueprintsViewModel } from "./saved-blueprints-view-model";

describe("saved blueprints view model", () => {
  it("maps source and timestamp metadata", () => {
    const result = buildSavedBlueprintsViewModel([
      createBlueprint({
        workbookId: "workbook_1",
      }),
      createBlueprint({
        id: "blueprint_2",
        workbookId: null,
      }),
    ]);

    expect(result[0]?.metadata).toContain("Source attached");
    expect(result[1]?.metadata).toContain("No source");
    expect(result[0]?.metadata).toBe(
      "Source attached | Updated Jun 10, 2026, 12:00 AM UTC | Created Jun 9, 2026, 12:00 AM UTC",
    );
  });
});

function createBlueprint(
  overrides: Partial<QuestionBlueprint> = {},
): QuestionBlueprint {
  return {
    id: "blueprint_1",
    ownerUserId: "user_1",
    createdByUserId: "user_1",
    name: "Saved blueprint",
    description: null,
    document: {
      schemaVersion: 1,
      blocks: [],
      responseFields: [],
    },
    workbookId: null,
    visibility: "private",
    status: "active",
    archivedAt: null,
    createdAt: new Date("2026-06-09T00:00:00.000Z"),
    updatedAt: new Date("2026-06-10T00:00:00.000Z"),
    ...overrides,
  };
}
