import { describe, expect, it } from "vitest";
import { buildQuestionSetListViewModel } from "./question-set-list-view-model";

function questionSet(id: string, updatedAt: Date) {
  return {
    id,
    ownerUserId: "owner",
    createdByUserId: "creator",
    name: `Question Set ${id}`,
    description: null,
    status: "active" as const,
    createdAt: updatedAt,
    updatedAt,
  };
}

describe("question set list view model", () => {
  it("builds stable header and item copy", () => {
    const viewModel = buildQuestionSetListViewModel({
      questionSets: [questionSet("1", new Date("2026-01-02T03:04:00Z"))],
    });

    expect(viewModel.title).toBe("Question sets");
    expect(viewModel.sectionDescription).toBe("1 question set");
    expect(viewModel.items[0]).toEqual({
      id: "1",
      title: "Question Set 1",
      metadata: "Updated Jan 2, 2026, 3:04 AM UTC",
    });
  });

  it("pluralizes count", () => {
    expect(
      buildQuestionSetListViewModel({ questionSets: [] }).sectionDescription,
    ).toBe("0 question sets");

    expect(
      buildQuestionSetListViewModel({
        questionSets: [
          questionSet("1", new Date("2026-01-02T03:04:00Z")),
          questionSet("2", new Date("2026-01-02T03:04:00Z")),
        ],
      }).sectionDescription,
    ).toBe("2 question sets");
  });
});
