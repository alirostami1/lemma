import { describe, expect, it } from "vitest";
import { mapQuestionBlueprintDraftSummary } from "./mappers";

describe("mapQuestionBlueprintDraftSummary", () => {
  it("maps status and required/nullable fields", () => {
    const summary = mapQuestionBlueprintDraftSummary({
      blueprintId: null,
      createdAt: "2026-06-20T00:00:00.000Z",
      createdByUserId: "owner-1",
      description: null,
      document: {
        blocks: [],
        references: [],
        responseFields: [],
        schemaVersion: 1,
      },
      id: "draft-1",
      lastSavedAt: "2026-06-22T00:00:00.000Z",
      name: "Draft",
      ownerUserId: "owner-1",
      sources: [
        {
          byteSize: null,
          checksumSha256: null,
          fileId: null,
          name: "Source",
          originalName: null,
          sourceId: "source_1",
          status: "invalid",
          type: "workbook",
          workbookId: null,
        },
      ],
      status: "published",
      updatedAt: "2026-06-22T00:00:00.000Z",
    });

    expect(summary).toEqual({
      blueprintId: null,
      description: null,
      id: "draft-1",
      lastSavedAt: new Date("2026-06-22T00:00:00.000Z"),
      name: "Draft",
      sourceCount: 1,
      status: "published",
      updatedAt: new Date("2026-06-22T00:00:00.000Z"),
    });
  });
});
