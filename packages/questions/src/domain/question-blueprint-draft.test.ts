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
  questionBlueprintDraftSourceIntents,
  questionBlueprintDraftSourcesFromRows,
  questionBlueprintId,
  questionBlueprintName,
  questionBlueprintVersionId,
  questionBlueprintVersionNumber,
  reconstituteQuestionBlueprintDraft,
  reconstituteQuestionBlueprintVersion,
  sourceArtifactId,
  sourceDocumentId,
  sourceRevisionId,
  updateQuestionBlueprintDraft,
  userId,
  workbookId,
} from "./index.js";

const at = new Date("2026-06-22T00:00:00.000Z");
const testSourceDocumentId = sourceDocumentId(
  "0197a555-5555-7555-8555-555555555555",
);
const testSourceRevisionId = sourceRevisionId(
  "0197a666-6666-7666-8666-666666666666",
);
const testSourceArtifactId = sourceArtifactId(
  "0197a777-7777-7777-8777-777777777777",
);

test("rejects Python draft source intent while its runtime is deferred", () => {
  assert.throws(
    () =>
      questionBlueprintDraftSourceIntents([
        { name: "Generator", sourceId: "generator", type: "python" },
      ]),
    /question blueprint draft source intent type is invalid/,
  );
});

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
        schemaVersion: 2,
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

test("published blueprint reconstitution rejects missing source document pin", () => {
  assert.throws(
    () =>
      reconstituteQuestionBlueprintVersion({
        ...versionRow(),
        sources: [
          {
            ...publishedSources()[0],
            sourceDocumentId: null,
          },
        ],
      }),
    /sourceDocumentId must be present for version workbook sources/,
  );
});

test("published blueprint version reconstitution rejects missing source revision pin", () => {
  assert.throws(
    () =>
      reconstituteQuestionBlueprintVersion({
        ...versionRow(),
        sources: [
          {
            ...publishedSources()[0],
            sourceRevisionId: null,
          },
        ],
      }),
    /sourceRevisionId must be present for version workbook sources/,
  );
});

test("published blueprint version reconstitution rejects missing source artifact pin", () => {
  assert.throws(
    () =>
      reconstituteQuestionBlueprintVersion({
        ...versionRow(),
        sources: [
          {
            ...publishedSources()[0],
            sourceArtifactId: null,
          },
        ],
      }),
    /sourceArtifactId must be present for version workbook sources/,
  );
});

test("attaching draft source file materializes workbook state", () => {
  const draft = createDraft();
  const attachedWorkbookId = workbookId("0197a444-4444-7444-8444-444444444444");
  const attached = attachDraftSourceFile(
    draft,
    {
      byteSize: 128,
      checksumSha256: "a".repeat(64),
      fileId: "0197a333-3333-7333-8333-333333333333",
      originalName: "source.xlsx",
      sourceArtifactId: testSourceArtifactId,
      sourceDocumentId: testSourceDocumentId,
      sourceId: "sourceA",
      sourceRevisionId: testSourceRevisionId,
      status: "validated",
      workbookId: attachedWorkbookId,
    },
    at,
  );

  assert.equal(
    attached.sources[0]?.fileId,
    "0197a333-3333-7333-8333-333333333333",
  );
  assert.equal(attached.sources[0]?.workbookId, attachedWorkbookId);
  assert.equal(attached.sources[0]?.status, "validated");
});

test("published draft keeps source history and registered workbook id", () => {
  const draft = createDraft();
  const [validated] = publishedSources();
  if (!validated) throw new Error("missing source fixture");
  const published = markQuestionBlueprintDraftPublished(
    draft,
    {
      blueprintId: questionBlueprintId("0197a555-5555-7555-8555-555555555555"),
      idempotencyKey: "publish-once",
      sources: [validated],
      versionId: questionBlueprintVersionId(
        "0197a666-6666-7666-8666-666666666666",
      ),
    },
    at,
  );

  assert.equal(published.status, "published");
  assert.equal(
    published.sources[0]?.workbookId,
    "0197a444-4444-7444-8444-444444444444",
  );
});

test("published draft rejects validated workbook source without pins", () => {
  const draft = createDraft();
  const [source] = draft.sources;
  if (!source) throw new Error("missing source fixture");

  assert.throws(
    () =>
      markQuestionBlueprintDraftPublished(
        draft,
        {
          blueprintId: questionBlueprintId(
            "0197a555-5555-7555-8555-555555555555",
          ),
          idempotencyKey: "publish-once",
          sources: [
            {
              ...source,
              status: "validated" as const,
              workbookId: workbookId("0197a444-4444-7444-8444-444444444444"),
            },
          ],
          versionId: questionBlueprintVersionId(
            "0197a666-6666-7666-8666-666666666666",
          ),
        },
        at,
      ),
    /published workbook sources must pin source document, revision, artifact, and workbook/,
  );
});

test("published draft reconstitution rejects validated workbook source without pins", () => {
  const [source] = draftRow().sources;
  if (!source) throw new Error("missing source fixture");

  assert.throws(
    () =>
      reconstituteQuestionBlueprintDraft({
        ...draftRow(),
        publishedAt: at,
        publishedVersionId: "0197a666-6666-7666-8666-666666666666",
        publishIdempotencyKey: "publish-once",
        sources: [
          {
            ...source,
            status: "validated",
            workbookId: "0197a444-4444-7444-8444-444444444444",
          },
        ],
        status: "published",
      }),
    /published workbook sources must pin source document, revision, artifact, and workbook/,
  );
});

test("published draft reconstitution rejects used local workbook source", () => {
  const [source] = draftRow().sources;
  if (!source) throw new Error("missing source fixture");

  assert.throws(
    () =>
      reconstituteQuestionBlueprintDraft({
        ...draftRow(),
        publishedAt: at,
        publishedVersionId: "0197a666-6666-7666-8666-666666666666",
        publishIdempotencyKey: "publish-once",
        sources: [
          {
            ...source,
            byteSize: null,
            checksumSha256: null,
            fileId: null,
            originalName: null,
            sourceArtifactId: null,
            sourceDocumentId: null,
            sourceRevisionId: null,
            status: "local",
            workbookId: null,
          },
        ],
        status: "published",
      }),
    /published workbook sources must pin source document, revision, artifact, and workbook/,
  );
});

test("published new-blueprint draft keeps null base version", () => {
  const draft = createDraft();
  const blueprintId = questionBlueprintId(
    "0197a555-5555-7555-8555-555555555555",
  );
  const versionId = questionBlueprintVersionId(
    "0197a666-6666-7666-8666-666666666666",
  );
  const published = markQuestionBlueprintDraftPublished(
    draft,
    {
      blueprintId,
      idempotencyKey: "publish-once",
      sources: publishedSources(),
      versionId,
    },
    at,
  );
  const reconstituted = reconstituteQuestionBlueprintDraft({
    ...draftRow(),
    baseVersionId: null,
    blueprintId,
    publishedAt: at,
    publishedVersionId: versionId,
    publishIdempotencyKey: "publish-once",
    sources: publishedSources(),
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
  return questionBlueprintDraftSourcesFromRows([
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
      byteSize: 1234,
      checksumSha256:
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      fileId: "0197a444-4444-7444-8444-444444444440",
      name: "Source A",
      originalName: "source-a.xlsx",
      sourceArtifactId: testSourceArtifactId,
      sourceDocumentId: testSourceDocumentId,
      sourceId: "sourceA",
      sourceRevisionId: testSourceRevisionId,
      status: "validated" as const,
      type: "workbook" as const,
      workbookId: workbookId("0197a444-4444-7444-8444-444444444444"),
    },
    {
      byteSize: 2345,
      checksumSha256:
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      fileId: "0197a444-4444-7444-8444-444444444441",
      name: "Source B",
      originalName: "source-b.xlsx",
      sourceArtifactId: sourceArtifactId(
        "0197a888-8888-7888-8888-888888888888",
      ),
      sourceDocumentId: sourceDocumentId(
        "0197a999-9999-7999-8999-999999999999",
      ),
      sourceId: "sourceB",
      sourceRevisionId: sourceRevisionId(
        "0197aaaa-aaaa-7aaa-8aaa-aaaaaaaaaaaa",
      ),
      status: "validated" as const,
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
    publishedVersionId: null,
    publishIdempotencyKey: null,
    revision: 1,
    sources: sources(),
    status: "draft",
    updatedAt: at,
  };
}

function versionRow() {
  return {
    blueprintId: "0197a555-5555-7555-8555-555555555555",
    createdAt: at,
    createdByUserId: "0197a222-2222-7222-8222-222222222222",
    description: null,
    document: documentUsing("sourceA"),
    id: "0197a666-6666-7666-8666-666666666666",
    name: "Versioned",
    ownerUserId: "0197a222-2222-7222-8222-222222222222",
    parentVersionId: null,
    publishedAt: at,
    sources: publishedSources(),
    versionNumber: 1,
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
    schemaVersion: 2,
  });
}
