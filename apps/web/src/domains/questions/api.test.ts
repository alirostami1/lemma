import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ErrorResponse,
  QuestionBlueprintDraftSourceConflictResponse,
  WorkbookSourceEditInvalidatesReferencesErrorResponse,
} from "#/api/generated/model";
import {
  completeQuestionBlueprintDraftWorkbookEditorUpload,
  createQuestionBlueprintDraftWorkbookEditorUpload,
  listQuestionBlueprintDraftSummaries,
  listQuestionBlueprintDrafts,
  saveQuestionBlueprintDraftWorkbookSourceRevision,
} from "./api";

const generatedMocks = vi.hoisted(() => ({
  createQuestionBlueprintDraftWorkbookEditorUpload: vi.fn(),
  completeQuestionBlueprintDraftWorkbookEditorUpload: vi.fn(),
  listQuestionBlueprintDrafts: vi.fn(),
  saveQuestionBlueprintDraftWorkbookSourceRevision: vi.fn(),
}));

vi.mock("#/api/generated/questions/questions", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("#/api/generated/questions/questions")
  >()),
  createQuestionBlueprintDraftWorkbookEditorUpload:
    generatedMocks.createQuestionBlueprintDraftWorkbookEditorUpload,
  completeQuestionBlueprintDraftWorkbookEditorUpload:
    generatedMocks.completeQuestionBlueprintDraftWorkbookEditorUpload,
  listQuestionBlueprintDrafts: generatedMocks.listQuestionBlueprintDrafts,
  saveQuestionBlueprintDraftWorkbookSourceRevision:
    generatedMocks.saveQuestionBlueprintDraftWorkbookSourceRevision,
}));

describe("questions api", () => {
  beforeEach(() => {
    generatedMocks.createQuestionBlueprintDraftWorkbookEditorUpload.mockReset();
    generatedMocks.completeQuestionBlueprintDraftWorkbookEditorUpload.mockReset();
    generatedMocks.listQuestionBlueprintDrafts.mockReset();
    generatedMocks.saveQuestionBlueprintDraftWorkbookSourceRevision.mockReset();
  });

  it("keeps source-edit 409 client errors typed as generic or recovery conflicts", () => {
    const genericConflict = {
      error: {
        code: "DRAFT_REVISION_CONFLICT",
        message: "This draft changed.",
      },
    } satisfies ErrorResponse;
    const recoveryConflict = {
      error: {
        code: "WORKBOOK_SOURCE_EDIT_INVALIDATES_REFERENCES",
        details: {
          affectedInsertedValues: [
            {
              label: "Revenue total",
              problem: "The referenced cell is no longer available.",
            },
          ],
          recoveryAction:
            "Remove or replace the affected inserted values before saving this workbook.",
          summary: "Some inserted values need attention.",
        },
        message: "Some inserted values need attention.",
      },
    } satisfies WorkbookSourceEditInvalidatesReferencesErrorResponse;

    const sourceConflicts: QuestionBlueprintDraftSourceConflictResponse[] = [
      genericConflict,
      recoveryConflict,
    ];

    expect(sourceConflicts.map((item) => item.error.code)).toEqual([
      "DRAFT_REVISION_CONFLICT",
      "WORKBOOK_SOURCE_EDIT_INVALIDATES_REFERENCES",
    ]);
  });

  it("sends editor upload completion intent and maps the editor output file", async () => {
    generatedMocks.completeQuestionBlueprintDraftWorkbookEditorUpload.mockResolvedValue(
      {
        editorOutputFile: {
          byteSize: 1234,
          checksumSha256: "b".repeat(64),
          contentType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          id: "editor-file-1",
          originalName: "source.xlsx",
        },
      },
    );

    const result = await completeQuestionBlueprintDraftWorkbookEditorUpload({
      draftId: "draft-1",
      expectedRevision: 2,
      sourceId: "source-1",
      uploadId: "upload-1",
    });

    expect(
      generatedMocks.completeQuestionBlueprintDraftWorkbookEditorUpload,
    ).toHaveBeenCalledWith("draft-1", "source-1", "upload-1", {
      expectedRevision: 2,
    });
    expect(result.editorOutputFile.id).toBe("editor-file-1");
  });

  it("sends editor upload metadata and maps the upload response", async () => {
    generatedMocks.createQuestionBlueprintDraftWorkbookEditorUpload.mockResolvedValue(
      editorUploadResponse(),
    );

    const result = await createQuestionBlueprintDraftWorkbookEditorUpload({
      byteSize: 1234,
      checksumSha256: "b".repeat(64),
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      draftId: "draft-1",
      expectedRevision: 1,
      originalName: "source.xlsx",
      sourceId: "source-1",
    });

    expect(
      generatedMocks.createQuestionBlueprintDraftWorkbookEditorUpload,
    ).toHaveBeenCalledWith("draft-1", "source-1", {
      byteSize: 1234,
      checksumSha256: "b".repeat(64),
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      expectedRevision: 1,
      originalName: "source.xlsx",
    });
    expect(result.upload.createdAt).toBeInstanceOf(Date);
  });

  it("sends editor output intent and maps the lifecycle response", async () => {
    generatedMocks.saveQuestionBlueprintDraftWorkbookSourceRevision.mockResolvedValue(
      revisionResponse(),
    );

    const result = await saveQuestionBlueprintDraftWorkbookSourceRevision({
      draftId: "draft-1",
      editorOutputFileId: "editor-file-2",
      expectedRevision: 1,
      sourceId: "source-1",
    });

    expect(
      generatedMocks.saveQuestionBlueprintDraftWorkbookSourceRevision,
    ).toHaveBeenCalledWith("draft-1", "source-1", {
      editorOutputFileId: "editor-file-2",
      expectedRevision: 1,
    });
    expect(result.sourceRevision.createdAt).toBeInstanceOf(Date);
    expect(result.sourceArtifact.updatedAt).toBeInstanceOf(Date);
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

function revisionResponse() {
  return {
    draft: {
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
      lastSavedAt: "2026-06-23T00:00:00.000Z",
      name: "Draft",
      ownerUserId: "owner-1",
      publishedAt: null,
      publishedVersionId: null,
      revision: 2,
      sources: [],
      status: "draft",
      updatedAt: "2026-06-23T00:00:00.000Z",
    },
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
  };
}

function editorUploadResponse() {
  return {
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
  };
}
