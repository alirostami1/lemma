import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { AppApiError } from "#/api/errors";
import { getWorkbookSourceEditRecoveryMessage } from "#/lib/errors/api-error";
import {
  useCompleteQuestionBlueprintDraftWorkbookEditorUpload,
  useCreateQuestionBlueprintDraftWorkbookEditorUpload,
  useRetryQuestionGenerationRun,
  useSaveQuestionBlueprintDraftWorkbookSourceRevision,
} from "./hooks";
import { questionKeys } from "./keys";
import type {
  QuestionBlueprintDraft,
  QuestionGenerationRun,
  SaveQuestionBlueprintDraftWorkbookSourceRevisionResult,
} from "./model";

const mocks = vi.hoisted(() => ({
  createQuestionBlueprintDraftWorkbookEditorUpload: vi.fn(),
  completeQuestionBlueprintDraftWorkbookEditorUpload: vi.fn(),
  retryQuestionGenerationRun: vi.fn(),
  saveQuestionBlueprintDraftWorkbookSourceRevision: vi.fn(),
}));

vi.mock("./api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api")>()),
  createQuestionBlueprintDraftWorkbookEditorUpload:
    mocks.createQuestionBlueprintDraftWorkbookEditorUpload,
  completeQuestionBlueprintDraftWorkbookEditorUpload:
    mocks.completeQuestionBlueprintDraftWorkbookEditorUpload,
  retryQuestionGenerationRun: mocks.retryQuestionGenerationRun,
  saveQuestionBlueprintDraftWorkbookSourceRevision:
    mocks.saveQuestionBlueprintDraftWorkbookSourceRevision,
}));

describe("useCreateQuestionBlueprintDraftWorkbookEditorUpload", () => {
  it("creates a scoped editor upload through the questions domain API", async () => {
    const response = {
      upload: {
        checksumSha256: "b".repeat(64),
        completedAt: null,
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        createdAt: new Date("2026-06-23T00:00:00.000Z"),
        createdByUserId: "owner-1",
        expectedByteSize: 1234,
        id: "upload-1",
        originalName: "source.xlsx",
        status: "initiated",
        updatedAt: new Date("2026-06-23T00:00:00.000Z"),
        uploadExpiresAt: new Date("2026-06-24T00:00:00.000Z"),
      },
      uploadUrl: {
        expiresInSeconds: 900,
        headers: {},
        method: "PUT",
        url: "https://storage.example/upload",
      },
    };
    mocks.createQuestionBlueprintDraftWorkbookEditorUpload.mockResolvedValue(
      response,
    );
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () => useCreateQuestionBlueprintDraftWorkbookEditorUpload(),
      { wrapper },
    );

    await act(() =>
      result.current.mutateAsync({
        byteSize: 1234,
        checksumSha256: "b".repeat(64),
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        draftId: "draft-1",
        expectedRevision: 1,
        originalName: "source.xlsx",
        sourceId: "source-1",
      }),
    );

    expect(
      mocks.createQuestionBlueprintDraftWorkbookEditorUpload,
    ).toHaveBeenCalledWith(
      {
        byteSize: 1234,
        checksumSha256: "b".repeat(64),
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        draftId: "draft-1",
        expectedRevision: 1,
        originalName: "source.xlsx",
        sourceId: "source-1",
      },
      expect.anything(),
    );
  });
});

describe("useCompleteQuestionBlueprintDraftWorkbookEditorUpload", () => {
  it("completes a scoped editor upload through the questions domain API", async () => {
    const response = {
      editorOutputFile: {
        byteSize: 1234,
        checksumSha256: "b".repeat(64),
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        id: "editor-file-1",
        originalName: "source.xlsx",
      },
    };
    mocks.completeQuestionBlueprintDraftWorkbookEditorUpload.mockResolvedValue(
      response,
    );
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () => useCompleteQuestionBlueprintDraftWorkbookEditorUpload(),
      { wrapper },
    );

    await act(() =>
      result.current.mutateAsync({
        draftId: "draft-1",
        expectedRevision: 2,
        sourceId: "source-1",
        uploadId: "upload-1",
      }),
    );

    expect(
      mocks.completeQuestionBlueprintDraftWorkbookEditorUpload,
    ).toHaveBeenCalledWith(
      {
        draftId: "draft-1",
        expectedRevision: 2,
        sourceId: "source-1",
        uploadId: "upload-1",
      },
      expect.anything(),
    );
  });
});

describe("useRetryQuestionGenerationRun", () => {
  it("caches replacement run under replacement id", async () => {
    const replacementRun: QuestionGenerationRun = {
      attemptNumber: 2,
      attempts: 0,
      blueprintId: "blueprint-1",
      blueprintVersionId: "blueprint-version-1",
      createdAt: new Date("2026-06-21T00:00:00.000Z"),
      createdByUserId: "user-1",
      errorMessage: null,
      finishedAt: null,
      id: "run-replacement",
      ownerUserId: "user-1",
      requestedCount: 2,
      result: null,
      retryOfRunId: "run-failed",
      startedAt: null,
      status: "queued",
      targetQuestionSetId: "question-set-1",
      updatedAt: new Date("2026-06-21T00:00:00.000Z"),
      workbookCalculationId: null,
    };
    const response = { questionGenerationRun: replacementRun };
    mocks.retryQuestionGenerationRun.mockResolvedValue(response);
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useRetryQuestionGenerationRun(), {
      wrapper,
    });

    await act(() =>
      result.current.mutateAsync({
        questionGenerationRunId: "run-failed",
        questionSetId: "question-set-1",
      }),
    );

    expect(
      queryClient.getQueryData(
        questionKeys.generationRunDetail("run-replacement"),
      ),
    ).toEqual(response);
    expect(
      queryClient.getQueryData(questionKeys.generationRunDetail("run-failed")),
    ).toBeUndefined();
  });
});

describe("useSaveQuestionBlueprintDraftWorkbookSourceRevision", () => {
  it("caches the moved draft binding and invalidates draft lists", async () => {
    const response = savedRevisionResult();
    mocks.saveQuestionBlueprintDraftWorkbookSourceRevision.mockResolvedValue(
      response,
    );
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const listKey = questionKeys.questionBlueprintDraftsInfiniteList();
    queryClient.setQueryData(listKey, { drafts: [], nextCursor: null });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () => useSaveQuestionBlueprintDraftWorkbookSourceRevision(),
      { wrapper },
    );

    await act(() =>
      result.current.mutateAsync({
        draftId: response.draft.id,
        editorOutputFileId: "editor-file-2",
        expectedRevision: 1,
        sourceId: "source_1",
      }),
    );

    expect(
      queryClient.getQueryData(
        questionKeys.questionBlueprintDraftDetail(response.draft.id),
      ),
    ).toEqual({ draft: response.draft });
    expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true);
  });

  it("surfaces workbook editor save recovery details without internal ids", async () => {
    const recoveryError = createWorkbookSourceEditRecoveryError();
    mocks.saveQuestionBlueprintDraftWorkbookSourceRevision.mockRejectedValue(
      recoveryError,
    );
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () => useSaveQuestionBlueprintDraftWorkbookSourceRevision(),
      { wrapper },
    );

    await expect(
      act(() =>
        result.current.mutateAsync({
          draftId: "draft-1",
          editorOutputFileId: "editor-file-2",
          expectedRevision: 1,
          sourceId: "source_1",
        }),
      ),
    ).rejects.toBe(recoveryError);

    const message = getWorkbookSourceEditRecoveryMessage(recoveryError);
    expect(message).toContain("Some inserted values need attention.");
    expect(message).toContain(
      "Revenue total: The referenced cell is no longer available.",
    );
    expect(message).toContain(
      "Remove or replace the affected inserted values before saving this workbook.",
    );
    expect(message).not.toMatch(
      /workbook:|sourceDocumentId|sourceRevisionId|sourceArtifactId|workbookId|referenceId|019e9315/,
    );
  });
});

function createWorkbookSourceEditRecoveryError() {
  return new AppApiError({
    body: null,
    headers: new Headers(),
    payload: {
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
      requestId: "request-1",
    },
    status: 409,
  });
}

function savedRevisionResult(): SaveQuestionBlueprintDraftWorkbookSourceRevisionResult {
  const at = new Date("2026-06-23T00:00:00.000Z");
  const draft: QuestionBlueprintDraft = {
    baseVersionId: "version-1",
    blueprintId: "blueprint-1",
    createdAt: at,
    createdByUserId: "user-1",
    description: null,
    discardedAt: null,
    document: {
      blocks: [],
      references: [],
      responseFields: [],
      schemaVersion: 2,
    },
    id: "draft-1",
    lastSavedAt: at,
    name: "Draft",
    ownerUserId: "user-1",
    publishedAt: null,
    publishedVersionId: null,
    revision: 2,
    sources: [],
    status: "draft",
    updatedAt: at,
  };
  return {
    draft,
    sourceArtifact: {
      createdAt: at,
      id: "artifact-2",
      kind: "workbook",
      processor: "lemma-workbook",
      processorVersion: "1",
      sourceRevisionId: "revision-2",
      status: "pending_validation",
      updatedAt: at,
      validationError: null,
      workbookId: "workbook-2",
    },
    sourceRevision: {
      byteSize: 2048,
      checksumSha256: "a".repeat(64),
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      createdAt: at,
      createdByUserId: "user-1",
      id: "revision-2",
      kind: "workbook",
      parentRevisionId: "revision-1",
      sourceDocumentId: "document-1",
    },
  };
}
