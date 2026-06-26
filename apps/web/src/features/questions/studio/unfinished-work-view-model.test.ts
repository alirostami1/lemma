import { describe, expect, it } from "vitest";
import type { QuestionBlueprintDraftSummary } from "#/domains/questions/model";
import {
  buildStudioContinueCardViewModel,
  formatUnfinishedWorkLastEditedLabel,
  selectLatestUnfinishedWork,
} from "./unfinished-work-view-model";

describe("unfinished work view model", () => {
  it("selects latest unfinished work by last edited time", () => {
    const result = buildStudioContinueCardViewModel([
      createDraft({
        id: "draft-1",
        lastSavedAt: new Date("2026-06-20T00:00:00.000Z"),
        name: "Earlier work",
        updatedAt: new Date("2026-06-20T00:00:00.000Z"),
      }),
      createDraft({
        id: "draft-2",
        lastSavedAt: new Date("2026-06-22T00:00:00.000Z"),
        name: "Latest work",
        updatedAt: new Date("2026-06-21T00:00:00.000Z"),
      }),
    ]);

    expect(result).toEqual({
      draftId: "draft-2",
      lastEditedLabel: "Last edited Jun 22, 2026, 12:00 AM UTC",
      title: "Latest work",
      unpublishedChangesLabel: "Unpublished changes",
    });
  });

  it("uses updatedAt when it is newer than lastSavedAt", () => {
    expect(
      formatUnfinishedWorkLastEditedLabel(
        createDraft({
          id: "draft-1",
          lastSavedAt: new Date("2026-06-20T00:00:00.000Z"),
          updatedAt: new Date("2026-06-23T12:30:00.000Z"),
        }),
      ),
    ).toBe("Last edited Jun 23, 2026, 12:30 PM UTC");
  });

  it("ignores non-draft items and returns null when no unfinished work exists", () => {
    expect(
      selectLatestUnfinishedWork([
        createDraft({ id: "draft-1", status: "published" }),
        createDraft({ id: "draft-2", status: "discarded" }),
      ]),
    ).toBeNull();
  });
});

function createDraft(
  overrides: Partial<QuestionBlueprintDraftSummary> = {},
): QuestionBlueprintDraftSummary {
  return {
    blueprintId: null,
    description: null,
    id: "draft-1",
    lastSavedAt: new Date("2026-06-10T00:00:00.000Z"),
    name: "Blueprint work",
    sourceCount: 0,
    status: "draft",
    updatedAt: new Date("2026-06-10T00:00:00.000Z"),
    ...overrides,
  };
}
