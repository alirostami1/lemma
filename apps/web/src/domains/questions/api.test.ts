import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  listQuestionBlueprintDraftSummaries,
  listQuestionBlueprintDrafts,
} from "./api";

const generatedMocks = vi.hoisted(() => ({
  listQuestionBlueprintDrafts: vi.fn(),
}));

vi.mock("#/api/generated/questions/questions", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("#/api/generated/questions/questions")
  >()),
  listQuestionBlueprintDrafts: generatedMocks.listQuestionBlueprintDrafts,
}));

describe("questions api", () => {
  beforeEach(() => {
    generatedMocks.listQuestionBlueprintDrafts.mockReset();
  });

  it("sends status filtering through to the generated draft list client", async () => {
    generatedMocks.listQuestionBlueprintDrafts.mockResolvedValue({
      drafts: [],
      nextCursor: null,
    });

    await listQuestionBlueprintDraftSummaries({
      limit: 10,
      status: "draft",
    });

    expect(generatedMocks.listQuestionBlueprintDrafts).toHaveBeenCalledWith({
      limit: 10,
      status: "draft",
    });
  });

  it("passes status through for full draft list requests too", async () => {
    generatedMocks.listQuestionBlueprintDrafts.mockResolvedValue({
      drafts: [],
      nextCursor: null,
    });

    await listQuestionBlueprintDrafts({
      limit: 5,
      status: "published",
    });

    expect(generatedMocks.listQuestionBlueprintDrafts).toHaveBeenCalledWith({
      limit: 5,
      status: "published",
    });
  });
});
