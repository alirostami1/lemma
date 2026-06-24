import assert from "node:assert/strict";
import test from "node:test";
import {
  attachDraftSourceFile,
  createQuestionBlueprintDraft,
  createQuestionBlueprintVersion,
  markQuestionBlueprintDraftPublished,
  questionBlueprintDescription,
  questionBlueprintDocument,
  questionBlueprintDraftId,
  questionBlueprintDraftSources,
  questionBlueprintId,
  questionBlueprintName,
  questionBlueprintVersionId,
  questionBlueprintVersionNumber,
  reconstituteQuestionBlueprintDraft,
  reconstituteQuestionBlueprintVersion,
  updateQuestionBlueprintDraft,
  userId,
  workbookId,
} from "./index.js";

const at = new Date("2026-06-22T00:00:00.000Z");

test("draft permits referenced workbook source without file or workbook", () => {
  const draft = createQuestionBlueprintDraft(
    {
      blueprintId: null,
      baseVersionId: null,
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
  assert.equal(draft.revision, 1);
  assert.equal(draft.status, "draft");
});

test("draft can carry base version and update increments revision", () => {
  const draft = createQuestionBlueprintDraft(
    {
      baseVersionId: questionBlueprintVersionId(
        "0197a666-6666-7666-8666-666666666666",
      ),
      blueprintId: questionBlueprintId("0197a555-5555-7555-8555-555555555555"),
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

  const updated = updateQuestionBlueprintDraft(
    draft,
    {
      description: draft.description,
      document: draft.document,
      name: questionBlueprintName("Draft updated"),
      sources: draft.sources,
    },
    new Date("2026-06-22T00:01:00.000Z"),
  );

  assert.equal(draft.baseVersionId, "0197a666-6666-7666-8666-666666666666");
  assert.equal(updated.revision, 2);
});

test("draft rejects invalid target and base version pairs", () => {
  assert.throws(
    () =>
      createQuestionBlueprintDraft(
        {
          baseVersionId: null,
          blueprintId: questionBlueprintId(
            "0197a555-5555-7555-8555-555555555555",
          ),
          createdByUserId: userId("0197a222-2222-7222-8222-222222222222"),
          description: null,
          document: documentUsing("sourceA"),
          id: questionBlueprintDraftId("0197a111-1111-7111-8111-111111111111"),
          name: questionBlueprintName("Draft"),
          ownerUserId: userId("0197a222-2222-7222-8222-222222222222"),
          sources: sources(),
        },
        at,
      ),
    /targeted active question blueprint drafts must have a base version/,
  );
  assert.throws(
    () =>
      createQuestionBlueprintDraft(
        {
          baseVersionId: questionBlueprintVersionId(
            "0197a666-6666-7666-8666-666666666666",
          ),
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
      ),
    /question blueprint drafts cannot have a base version without a blueprint/,
  );
  assert.throws(
    () =>
      reconstituteQuestionBlueprintDraft({
        ...draftRow(),
        baseVersionId: null,
        blueprintId: "0197a555-5555-7555-8555-555555555555",
      }),
    /targeted active question blueprint drafts must have a base version/,
  );
});

test("blueprint version number must be positive", () => {
  assert.throws(
    () => questionBlueprintVersionNumber(0),
    /version number must be a positive integer/,
  );
});

test("creates immutable blueprint version snapshot", () => {
  const version = createQuestionBlueprintVersion(
    {
      blueprintId: questionBlueprintId("0197a555-5555-7555-8555-555555555555"),
      createdByUserId: userId("0197a222-2222-7222-8222-222222222222"),
      description: null,
      document: questionBlueprintDocument({
        blocks: [],
        references: [],
        responseFields: [],
        schemaVersion: 1,
      }),
      id: questionBlueprintVersionId("0197a666-6666-7666-8666-666666666666"),
      name: questionBlueprintName("Versioned"),
      ownerUserId: userId("0197a222-2222-7222-8222-222222222222"),
      parentVersionId: null,
      sources: [],
      versionNumber: questionBlueprintVersionNumber(1),
    },
    at,
  );

  assert.equal(version.versionNumber, 1);
  assert.equal(version.parentVersionId, null);
});

test("blueprint version snapshots only used sources", () => {
  const version = createQuestionBlueprintVersion(
    {
      blueprintId: questionBlueprintId("0197a555-5555-7555-8555-555555555555"),
      createdByUserId: userId("0197a222-2222-7222-8222-222222222222"),
      description: null,
      document: documentUsing("sourceA"),
      id: questionBlueprintVersionId("0197a666-6666-7666-8666-666666666666"),
      name: questionBlueprintName("Versioned"),
      ownerUserId: userId("0197a222-2222-7222-8222-222222222222"),
      parentVersionId: null,
      sources: publishedSources(),
      versionNumber: questionBlueprintVersionNumber(1),
    },
    at,
  );
  const reconstituted = reconstituteQuestionBlueprintVersion({
    ...version,
    sources: publishedSources(),
  });

  assert.deepEqual(
    version.sources.map((source) => source.sourceId),
    ["sourceA"],
  );
  assert.deepEqual(
    reconstituted.sources.map((source) => source.sourceId),
    ["sourceA"],
  );
});

test("blueprint version rejects missing referenced source", () => {
  assert.throws(
    () =>
      createQuestionBlueprintVersion(
        {
          blueprintId: questionBlueprintId(
            "0197a555-5555-7555-8555-555555555555",
          ),
          createdByUserId: userId("0197a222-2222-7222-8222-222222222222"),
          description: null,
          document: documentUsing("missingSource"),
          id: questionBlueprintVersionId(
            "0197a666-6666-7666-8666-666666666666",
          ),
          name: questionBlueprintName("Versioned"),
          ownerUserId: userId("0197a222-2222-7222-8222-222222222222"),
          parentVersionId: null,
          sources: publishedSources(),
          versionNumber: questionBlueprintVersionNumber(1),
        },
        at,
      ),
    /unknown question blueprint source id missingSource is not attached/,
  );
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

test("published new-blueprint draft keeps null base version", () => {
  const draft = createDraft();
  const blueprintId = questionBlueprintId(
    "0197a555-5555-7555-8555-555555555555",
  );
  const published = markQuestionBlueprintDraftPublished(
    draft,
    blueprintId,
    draft.sources,
    at,
  );
  const reconstituted = reconstituteQuestionBlueprintDraft({
    ...draftRow(),
    baseVersionId: null,
    blueprintId,
    publishedAt: at,
    status: "published",
  });

  assert.equal(published.status, "published");
  assert.equal(published.blueprintId, blueprintId);
  assert.equal(published.baseVersionId, null);
  assert.equal(reconstituted.status, "published");
  assert.equal(reconstituted.blueprintId, blueprintId);
  assert.equal(reconstituted.baseVersionId, null);
});

function createDraft() {
  return createQuestionBlueprintDraft(
    {
      blueprintId: null,
      baseVersionId: null,
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

function publishedSources() {
  return [
    {
      name: "Source A",
      sourceId: "sourceA",
      type: "workbook" as const,
      workbookId: workbookId("0197a444-4444-7444-8444-444444444444"),
    },
    {
      name: "Source B",
      sourceId: "sourceB",
      type: "workbook" as const,
      workbookId: workbookId("0197a444-4444-7444-8444-444444444445"),
    },
  ];
}

function draftRow() {
  return {
    baseVersionId: "0197a666-6666-7666-8666-666666666666",
    blueprintId: "0197a555-5555-7555-8555-555555555555",
    createdAt: at,
    createdByUserId: "0197a222-2222-7222-8222-222222222222",
    description: null,
    discardedAt: null,
    document: documentUsing("sourceA"),
    id: "0197a111-1111-7111-8111-111111111111",
    lastSavedAt: at,
    name: "Draft",
    ownerUserId: "0197a222-2222-7222-8222-222222222222",
    publishedAt: null,
    revision: 1,
    sources: sources(),
    status: "draft",
    updatedAt: at,
  };
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
