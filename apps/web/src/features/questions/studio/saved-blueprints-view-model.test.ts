import { describe, expect, it } from "vitest";
import type {
  QuestionBlueprint,
  QuestionBlueprintDraftSummary,
} from "#/domains/questions/model";
import {
  buildSavedBlueprintsViewModel,
  buildSavedDraftsViewModel,
} from "./saved-blueprints-view-model";

describe("saved blueprints view model", () => {
  it("maps source and timestamp metadata", () => {
    const result = buildSavedBlueprintsViewModel([
      createBlueprint({
        sources: [
          {
            byteSize: 1024,
            checksumSha256:
              "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            fileId: "file_1",
            name: "Source 1",
            originalName: "source-1.xlsx",
            sourceId: "source_1",
            type: "workbook",
            workbookId: "workbook_1",
          },
        ],
      }),
      createBlueprint({
        id: "blueprint_2",
        sources: [],
      }),
    ]);

    expect(result[0]?.metadata).toContain("Sources attached");
    expect(result[1]?.metadata).toContain("No sources");
    expect(result[0]?.metadata).toBe(
      "Published | Sources attached | Updated Jun 10, 2026, 12:00 AM UTC | Created Jun 9, 2026, 12:00 AM UTC",
    );
  });
});

describe("saved draft view model", () => {
  it("maps draft metadata and linked blueprint", () => {
    const result = buildSavedDraftsViewModel([
      createDraft({
        blueprintId: "blueprint-1",
        id: "draft-1",
        lastSavedAt: new Date("2026-06-21T00:00:00.000Z"),
        name: "Draft one",
        sourceCount: 2,
        updatedAt: new Date("2026-06-20T00:00:00.000Z"),
      }),
      createDraft({
        blueprintId: null,
        id: "draft-2",
        name: "Draft two",
        sourceCount: 1,
      }),
    ]);

    expect(result[0]?.metadata).toContain("Unpublished changes");
    expect(result[0]?.metadata).toContain("2 sources");
    expect(result[0]?.metadata).toContain(
      "Last edited Jun 21, 2026, 12:00 AM UTC",
    );
    expect(result[1]?.metadata).not.toContain("Blueprint");
  });
});

function createBlueprint(
  overrides: Partial<QuestionBlueprint> = {},
): QuestionBlueprint {
  return {
    archivedAt: null,
    createdAt: new Date("2026-06-09T00:00:00.000Z"),
    createdByUserId: "user_1",
    currentVersionId: "version_1",
    description: null,
    document: {
      blocks: [],
      responseFields: [],
      schemaVersion: 1,
    },
    id: "blueprint_1",
    name: "Saved blueprint",
    ownerUserId: "user_1",
    sources: [],
    status: "active",
    updatedAt: new Date("2026-06-10T00:00:00.000Z"),
    visibility: "private",
    ...overrides,
  };
}

function createDraft(
  overrides: Partial<QuestionBlueprintDraftSummary> = {},
): QuestionBlueprintDraftSummary {
  return {
    blueprintId: "blueprint-1",
    description: null,
    id: "draft_1",
    lastSavedAt: new Date("2026-06-10T00:00:00.000Z"),
    name: "Draft",
    sourceCount: 1,
    status: "draft",
    updatedAt: new Date("2026-06-09T00:00:00.000Z"),
    ...overrides,
  };
}
