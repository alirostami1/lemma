import { describe, expect, it } from "vitest";
import {
  mapCompleteQuestionBlueprintDraftWorkbookEditorUploadResponse,
  mapCreateQuestionBlueprintDraftWorkbookEditorUploadResponse,
  mapQuestionBlueprint,
  mapQuestionBlueprintDraftSummary,
  mapSaveQuestionBlueprintDraftWorkbookSourceRevisionResponse,
} from "./mappers";

describe("mapQuestionBlueprint", () => {
  it("maps sanitized source-backed input status without authoring references", () => {
    const blueprint = mapQuestionBlueprint({
      archivedAt: null,
      createdAt: "2026-06-20T00:00:00.000Z",
      createdByUserId: "019e9315-6a87-715f-9861-8654df075001",
      currentVersionId: "019e9315-6a87-715f-9861-8654df075002",
      description: null,
      document: {
        blocks: [
          {
            id: "choice_input",
            input: {
              defaultValueStatus: "source_backed",
              optionsStatus: "source_backed",
              schemaVersion: 1,
              type: "select",
              validation: { required: true },
            },
            kind: "primitive",
            responseFieldId: "choice_answer",
            type: "input",
          },
        ],
        responseFields: [{ id: "choice_answer", type: "select" }],
        schemaVersion: 2,
      },
      id: "019e9315-6a87-715f-9861-8654df075003",
      name: "Blueprint",
      ownerUserId: "019e9315-6a87-715f-9861-8654df075001",
      sources: [],
      status: "active",
      updatedAt: "2026-06-20T00:00:00.000Z",
      visibility: "private",
    });

    expect(JSON.stringify(blueprint.document)).toContain(
      '"optionsStatus":"source_backed"',
    );
    expect(JSON.stringify(blueprint.document)).not.toContain("referenceId");
  });
});

describe("mapQuestionBlueprintDraftSummary", () => {
  it("maps status and required/nullable fields", () => {
    const summary = mapQuestionBlueprintDraftSummary({
      baseVersionId: null,
      blueprintId: null,
      createdAt: "2026-06-20T00:00:00.000Z",
      createdByUserId: "owner-1",
      description: null,
      discardedAt: null,
      document: {
        blocks: [],
        references: [],
        responseFields: [],
        schemaVersion: 2,
      },
      id: "draft-1",
      lastSavedAt: "2026-06-22T00:00:00.000Z",
      name: "Draft",
      ownerUserId: "owner-1",
      publishedAt: "2026-06-22T00:00:00.000Z",
      publishedVersionId: "version-1",
      revision: 1,
      sources: [
        {
          byteSize: null,
          checksumSha256: null,
          fileId: null,
          name: "Source",
          originalName: null,
          sourceId: "source_1",
          status: "local",
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

describe("mapCreateQuestionBlueprintDraftWorkbookEditorUploadResponse", () => {
  it("maps upload timestamps", () => {
    const result = mapCreateQuestionBlueprintDraftWorkbookEditorUploadResponse({
      upload: {
        checksumSha256: "b".repeat(64),
        completedAt: null,
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        createdAt: "2026-06-23T00:00:00.000Z",
        createdByUserId: "owner-1",
        expectedByteSize: 1234,
        id: "upload-1",
        originalName: "source.xlsx",
        status: "initiated",
        updatedAt: "2026-06-23T00:00:00.000Z",
        uploadExpiresAt: "2026-06-24T00:00:00.000Z",
      },
      uploadUrl: {
        expiresInSeconds: 900,
        headers: {},
        method: "PUT",
        url: "https://storage.example/upload",
      },
    });

    expect(result.upload.createdAt).toEqual(
      new Date("2026-06-23T00:00:00.000Z"),
    );
    expect(result.upload.uploadExpiresAt).toEqual(
      new Date("2026-06-24T00:00:00.000Z"),
    );
  });
});

describe("mapCompleteQuestionBlueprintDraftWorkbookEditorUploadResponse", () => {
  it("maps the editor output file without public file purpose fields", () => {
    const result =
      mapCompleteQuestionBlueprintDraftWorkbookEditorUploadResponse({
        editorOutputFile: {
          byteSize: 1234,
          checksumSha256: "b".repeat(64),
          contentType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          id: "editor-file-1",
          originalName: "source.xlsx",
        },
      });

    expect(result.editorOutputFile).toEqual({
      byteSize: 1234,
      checksumSha256: "b".repeat(64),
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      id: "editor-file-1",
      originalName: "source.xlsx",
    });
  });
});

describe("mapSaveQuestionBlueprintDraftWorkbookSourceRevisionResponse", () => {
  it("maps draft and lifecycle timestamps", () => {
    const result = mapSaveQuestionBlueprintDraftWorkbookSourceRevisionResponse({
      draft: draftDto(),
      sourceArtifact: {
        createdAt: "2026-06-23T00:00:00.000Z",
        id: "artifact-2",
        kind: "workbook",
        processor: "lemma-workbook",
        processorVersion: "1",
        sourceRevisionId: "revision-2",
        status: "pending_validation",
        updatedAt: "2026-06-23T00:00:00.000Z",
        validationError: null,
        workbookId: "workbook-2",
      },
      sourceRevision: {
        byteSize: 2048,
        checksumSha256: "a".repeat(64),
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        createdAt: "2026-06-23T00:00:00.000Z",
        createdByUserId: "owner-1",
        id: "revision-2",
        kind: "workbook",
        parentRevisionId: "revision-1",
        sourceDocumentId: "document-1",
      },
    });

    expect(result.draft.updatedAt).toEqual(
      new Date("2026-06-22T00:00:00.000Z"),
    );
    expect(result.sourceRevision.createdAt).toEqual(
      new Date("2026-06-23T00:00:00.000Z"),
    );
    expect(result.sourceArtifact.updatedAt).toEqual(
      new Date("2026-06-23T00:00:00.000Z"),
    );
  });
});

function draftDto() {
  return {
    baseVersionId: null,
    blueprintId: null,
    createdAt: "2026-06-20T00:00:00.000Z",
    createdByUserId: "owner-1",
    description: null,
    discardedAt: null,
    document: {
      blocks: [],
      references: [],
      responseFields: [],
      schemaVersion: 2 as const,
    },
    id: "draft-1",
    lastSavedAt: "2026-06-22T00:00:00.000Z",
    name: "Draft",
    ownerUserId: "owner-1",
    publishedAt: null,
    publishedVersionId: null,
    revision: 2,
    sources: [],
    status: "draft" as const,
    updatedAt: "2026-06-22T00:00:00.000Z",
  };
}
