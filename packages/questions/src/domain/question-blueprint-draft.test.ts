import assert from "node:assert/strict";
import test from "node:test";
import {
  attachDraftSourceFile,
  createQuestionBlueprintDraft,
  markQuestionBlueprintDraftPublished,
  questionBlueprintDescription,
  questionBlueprintDocument,
  questionBlueprintDraftId,
  questionBlueprintDraftSources,
  questionBlueprintId,
  questionBlueprintName,
  userId,
  workbookId,
} from "./index.js";

const at = new Date("2026-06-22T00:00:00.000Z");

test("draft permits referenced workbook source without file or workbook", () => {
  const draft = createQuestionBlueprintDraft(
    {
      blueprintId: null,
      createdByUserId: userId("0197a222-2222-7222-8222-222222222222"),
      description: questionBlueprintDescription(null),
      document: documentUsing("sourceA"),
      id: questionBlueprintDraftId("0197a111-1111-7111-8111-111111111111"),
      name: questionBlueprintName("Draft"),
      ownerUserId: userId("0197a222-2222-7222-8222-222222222222"),
      sources: sources(),
    },
    at,
  );

  assert.equal(draft.sources[0]?.fileId, null);
  assert.equal(draft.status, "draft");
});

test("attaching draft source file does not create workbook", () => {
  const draft = createDraft();
  const attached = attachDraftSourceFile(
    draft,
    {
      byteSize: 128,
      checksumSha256: "a".repeat(64),
      fileId: "0197a333-3333-7333-8333-333333333333",
      originalName: "source.xlsx",
      sourceId: "sourceA",
    },
    at,
  );

  assert.equal(
    attached.sources[0]?.fileId,
    "0197a333-3333-7333-8333-333333333333",
  );
  assert.equal(attached.sources[0]?.workbookId, null);
  assert.equal(attached.sources[0]?.status, "uploaded");
});

test("published draft keeps source history and registered workbook id", () => {
  const draft = createDraft();
  const sourcesWithWorkbook = draft.sources.map((source) => ({
    ...source,
    status: "validated" as const,
    workbookId: workbookId("0197a444-4444-7444-8444-444444444444"),
  }));
  const published = markQuestionBlueprintDraftPublished(
    draft,
    questionBlueprintId("0197a555-5555-7555-8555-555555555555"),
    sourcesWithWorkbook,
    at,
  );

  assert.equal(published.status, "published");
  assert.equal(
    published.sources[0]?.workbookId,
    "0197a444-4444-7444-8444-444444444444",
  );
});

function createDraft() {
  return createQuestionBlueprintDraft(
    {
      blueprintId: null,
      createdByUserId: userId("0197a222-2222-7222-8222-222222222222"),
      description: null,
      document: documentUsing("sourceA"),
      id: questionBlueprintDraftId("0197a111-1111-7111-8111-111111111111"),
      name: questionBlueprintName("Draft"),
      ownerUserId: userId("0197a222-2222-7222-8222-222222222222"),
      sources: sources(),
    },
    at,
  );
}

function sources() {
  return questionBlueprintDraftSources([
    {
      byteSize: null,
      checksumSha256: null,
      fileId: null,
      name: "Source A",
      originalName: null,
      sourceId: "sourceA",
      status: "local",
      type: "workbook",
      workbookId: null,
    },
  ]);
}

function documentUsing(sourceId: string) {
  return questionBlueprintDocument({
    blocks: [],
    references: [
      {
        id: `workbook:${sourceId}:cell:Sheet1:A1`,
        name: "workbook:sourceA:Sheet1!A1",
        source: {
          ref: "Sheet1!A1",
          schemaVersion: 1,
          sourceId,
          type: "workbook_cell",
        },
      },
    ],
    responseFields: [],
    schemaVersion: 1,
  });
}
