// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppApiError } from "#/api/errors";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import type { StudioSource } from "./source/studio-source-model";
import { useStudioDraftSaveController } from "./use-studio-draft-save-controller";

const fileUploadMocks = vi.hoisted(() => ({
  completeFileUpload: vi.fn(),
  createFileUpload: vi.fn(),
}));
const questionDraftMocks = vi.hoisted(() => ({
  attachDraftFile: vi.fn(),
  updateServerDraft: vi.fn(),
}));
const questionGenerationMocks = vi.hoisted(() => ({
  publishQuestionBlueprintDraft: vi.fn(),
}));

vi.mock("#/domains/files/hooks", () => ({
  useCompleteFileUpload: () => ({
    isPending: false,
    mutateAsync: fileUploadMocks.completeFileUpload,
  }),
  useCreateFileUpload: () => ({
    isPending: false,
    mutateAsync: fileUploadMocks.createFileUpload,
  }),
}));

vi.mock("#/domains/questions", () => ({
  useAttachQuestionBlueprintDraftSourceFile: () => ({
    isPending: false,
    mutateAsync: questionDraftMocks.attachDraftFile,
  }),
  usePublishQuestionBlueprintDraft: () => ({
    isPending: false,
    mutateAsync: questionGenerationMocks.publishQuestionBlueprintDraft,
  }),
  useUpdateQuestionBlueprintDraft: () => ({
    isPending: false,
    mutateAsync: questionDraftMocks.updateServerDraft,
  }),
}));

vi.mock("#/features/notifications", () => ({
  notifyDraftPublished: vi.fn(),
  notifyDraftPublishFailed: vi.fn(),
}));

describe("useStudioDraftSaveController", () => {
  beforeEach(() => {
    fileUploadMocks.createFileUpload.mockReset();
    fileUploadMocks.completeFileUpload.mockReset();
    questionDraftMocks.updateServerDraft.mockReset();
    questionDraftMocks.attachDraftFile.mockReset();
    questionGenerationMocks.publishQuestionBlueprintDraft.mockReset();
  });

  it("does not create a draft from the save controller when draft identity is missing", async () => {
    const onDraftSaved = vi.fn();

    const { result } = renderHook(() =>
      useStudioDraftSaveController({
        authoringModel: createModel(),
        blueprintDescription: "",
        blueprintName: "Draft",
        initialDraftId: null,
        initialDraftRevision: null,
        onDraftSaved,
        onDraftPublished: () => {},
        onSourcesChange: () => {},
        readiness: {
          canGenerate: true,
          canSave: true,
          issues: [],
        },
        sources: [],
      }),
    );

    act(() => {
      result.current.commandBarSave.onSaveDraft();
    });

    await waitFor(() => {
      expect(result.current.commandBarSave.saveError).toBe(
        "This work could not be saved.",
      );
    });

    expect(questionDraftMocks.updateServerDraft).not.toHaveBeenCalled();
    expect(onDraftSaved).not.toHaveBeenCalled();
  });

  it("blocks save when name is missing", async () => {
    const { result } = renderHook(() =>
      useStudioDraftSaveController({
        authoringModel: createModel(),
        blueprintDescription: "",
        blueprintName: "",
        initialDraftId: "draft_existing",
        initialDraftRevision: 1,
        onDraftSaved: () => {},
        onDraftPublished: () => {},
        onSourcesChange: () => {},
        readiness: {
          canGenerate: false,
          canSave: false,
          issues: [
            {
              id: "missing_blueprint_name",
              message: "Add a blueprint name.",
              severity: "error",
            },
          ],
        },
        sources: [],
      }),
    );

    act(() => {
      result.current.commandBarSave.onSaveDraft();
    });

    await waitFor(() => {
      expect(result.current.commandBarSave.saveError).toBe(
        "Add a blueprint name.",
      );
    });
    expect(questionDraftMocks.updateServerDraft).not.toHaveBeenCalled();
    expect(questionDraftMocks.attachDraftFile).not.toHaveBeenCalled();
    expect(fileUploadMocks.createFileUpload).not.toHaveBeenCalled();
  });

  it("blocks save when workbook-backed references are missing sources", async () => {
    const { result } = renderHook(() =>
      useStudioDraftSaveController({
        authoringModel: createModel(),
        blueprintDescription: "",
        blueprintName: "Draft",
        initialDraftId: "draft_existing",
        initialDraftRevision: 1,
        onDraftSaved: () => {},
        onDraftPublished: () => {},
        onSourcesChange: () => {},
        readiness: {
          canGenerate: false,
          canSave: false,
          issues: [
            {
              id: "source_not_ready",
              message: "Add a workbook before saving.",
              severity: "error",
            },
          ],
        },
        sources: [createLocalSource()],
      }),
    );

    act(() => {
      result.current.commandBarSave.onSaveDraft();
    });

    await waitFor(() => {
      expect(result.current.commandBarSave.saveError).toBe(
        "Add a workbook before saving.",
      );
    });
    expect(questionDraftMocks.updateServerDraft).not.toHaveBeenCalled();
    expect(questionDraftMocks.attachDraftFile).not.toHaveBeenCalled();
    expect(fileUploadMocks.createFileUpload).not.toHaveBeenCalled();
  });

  it("shows publish recovery copy for unavailable inserted values", () => {
    const { result } = renderHook(() =>
      useStudioDraftSaveController({
        authoringModel: createModel(),
        blueprintDescription: "",
        blueprintName: "Draft",
        initialDraftId: "draft_existing",
        initialDraftRevision: 1,
        onDraftSaved: () => {},
        onDraftPublished: () => {},
        onSourcesChange: () => {},
        readiness: {
          canGenerate: false,
          canSave: false,
          issues: [
            {
              id: "inserted_value_unavailable_ref_1",
              message: "Some inserted values need attention.",
              publishMessage: "Review affected values before publishing.",
              severity: "error",
            },
          ],
        },
        sources: [createLocalSource()],
      }),
    );

    expect(result.current.publishDialog.state.validationIssue).toBe(
      "Review affected values before publishing.",
    );
  });

  it("blocks direct publish for inserted values that are still being checked", async () => {
    const { result } = renderHook(() =>
      useStudioDraftSaveController({
        authoringModel: createModel(),
        blueprintDescription: "",
        blueprintName: "Draft",
        initialDraftId: "draft_existing",
        initialDraftRevision: 1,
        onDraftSaved: () => {},
        onDraftPublished: () => {},
        onSourcesChange: () => {},
        readiness: readinessWithCheckingInsertedValue(),
        sources: [],
      }),
    );

    act(() => {
      result.current.publishDialog.onPublish();
    });

    await waitFor(() => {
      expect(result.current.commandBarSave.saveError).toBe(
        "Wait for workbook values to finish loading before publishing.",
      );
    });
    expect(questionDraftMocks.updateServerDraft).not.toHaveBeenCalled();
    expect(
      questionGenerationMocks.publishQuestionBlueprintDraft,
    ).not.toHaveBeenCalled();
  });

  it("allows save while inserted values are still being checked", async () => {
    questionDraftMocks.updateServerDraft.mockResolvedValue(
      createDraftResult("draft_existing", 2),
    );

    const { result } = renderHook(() =>
      useStudioDraftSaveController({
        authoringModel: createModel(),
        blueprintDescription: "",
        blueprintName: "Draft",
        initialDraftId: "draft_existing",
        initialDraftRevision: 1,
        onDraftSaved: () => {},
        onDraftPublished: () => {},
        onSourcesChange: () => {},
        readiness: readinessWithCheckingInsertedValue(),
        sources: [],
      }),
    );

    act(() => {
      result.current.commandBarSave.onSaveDraft();
    });

    await waitFor(() => {
      expect(questionDraftMocks.updateServerDraft).toHaveBeenCalledOnce();
    });
    expect(
      questionGenerationMocks.publishQuestionBlueprintDraft,
    ).not.toHaveBeenCalled();
  });

  it("blocks save and publish when inserted values are unavailable", async () => {
    const { result } = renderHook(() =>
      useStudioDraftSaveController({
        authoringModel: createModel(),
        blueprintDescription: "",
        blueprintName: "Draft",
        initialDraftId: "draft_existing",
        initialDraftRevision: 1,
        onDraftSaved: () => {},
        onDraftPublished: () => {},
        onSourcesChange: () => {},
        readiness: readinessWithUnavailableInsertedValue(),
        sources: [],
      }),
    );

    act(() => {
      result.current.commandBarSave.onSaveDraft();
    });

    await waitFor(() => {
      expect(result.current.commandBarSave.saveError).toBe(
        "Some inserted values need attention.",
      );
    });

    act(() => {
      result.current.publishDialog.onPublish();
    });

    await waitFor(() => {
      expect(result.current.commandBarSave.saveError).toBe(
        "Review affected values before publishing.",
      );
    });
    expect(questionDraftMocks.updateServerDraft).not.toHaveBeenCalled();
    expect(
      questionGenerationMocks.publishQuestionBlueprintDraft,
    ).not.toHaveBeenCalled();
  });

  it("updates an existing draft and calls onDraftSaved with the saved draft", async () => {
    questionDraftMocks.updateServerDraft.mockResolvedValue({
      draft: {
        blueprintId: "blueprint-1",
        createdAt: new Date("2026-06-20T00:00:00.000Z"),
        createdByUserId: "owner-1",
        description: null,
        document: createDocument(),
        id: "draft_existing",
        lastSavedAt: new Date("2026-06-21T00:00:00.000Z"),
        name: "Draft existing",
        ownerUserId: "owner-1",
        revision: 2,
        sources: [],
        status: "draft",
        updatedAt: new Date("2026-06-21T00:00:00.000Z"),
      },
    });

    const onDraftSaved = vi.fn();

    const { result } = renderHook(() =>
      useStudioDraftSaveController({
        authoringModel: createModel(),
        blueprintDescription: "",
        blueprintName: "Draft",
        initialDraftId: "draft_existing",
        initialDraftRevision: 1,
        onDraftSaved,
        onDraftPublished: () => {},
        onSourcesChange: () => {},
        readiness: {
          canGenerate: true,
          canSave: true,
          issues: [],
        },
        sources: [],
      }),
    );

    act(() => {
      result.current.commandBarSave.onSaveDraft();
    });

    await waitFor(() => {
      expect(questionDraftMocks.updateServerDraft).toHaveBeenCalledTimes(1);
      expect(onDraftSaved).toHaveBeenCalledOnce();
    });
    expect(onDraftSaved).toHaveBeenCalledExactlyOnceWith({
      authoringModel: createModel(),
      draft: expect.objectContaining({
        id: "draft_existing",
        revision: 2,
      }),
      sources: [],
    });
  });

  it("saves source intent before local upload and attaches with returned revision", async () => {
    const localSource = createLocalSource();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));
    fileUploadMocks.createFileUpload.mockResolvedValue({
      upload: { id: "upload_1" },
      uploadUrl: {
        headers: {},
        method: "PUT",
        url: "https://uploads.example/file",
      },
    });
    fileUploadMocks.completeFileUpload.mockResolvedValue({
      byteSize: 512,
      checksumSha256:
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      id: "file_1",
      originalName: "local.xlsx",
    });
    questionDraftMocks.updateServerDraft.mockResolvedValue(
      createDraftResult("draft_existing", 2),
    );
    questionDraftMocks.attachDraftFile.mockResolvedValue({
      draft: {
        ...createDraftResult("draft_existing", 3).draft,
        sources: [
          {
            byteSize: 1024,
            checksumSha256:
              "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
            fileId: "file_1",
            name: "Local source",
            originalName: "server-local.xlsx",
            sourceId: "source_1",
            status: "validated",
            type: "workbook",
            workbookId: "workbook_1",
          },
        ],
      },
    });

    const onDraftSaved = vi.fn();
    const onSourcesChange = vi.fn();
    const { result } = renderHook(() =>
      useStudioDraftSaveController({
        authoringModel: createModel(),
        blueprintDescription: "",
        blueprintName: "Draft",
        initialDraftId: "draft_existing",
        initialDraftRevision: 1,
        onDraftPublished: () => {},
        onDraftSaved,
        onSourcesChange,
        readiness: {
          canGenerate: true,
          canSave: true,
          issues: [],
        },
        sources: [localSource],
      }),
    );

    act(() => {
      result.current.commandBarSave.onSaveDraft();
    });

    await waitFor(() => {
      expect(onDraftSaved).toHaveBeenCalledOnce();
    });

    expect(
      questionDraftMocks.updateServerDraft.mock.invocationCallOrder[0],
    ).toBeLessThan(
      questionDraftMocks.attachDraftFile.mock.invocationCallOrder[0] ?? 0,
    );
    expect(questionDraftMocks.updateServerDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedRevision: 1,
        sources: [
          {
            name: "Local source",
            sourceId: "source_1",
            type: "workbook",
          },
        ],
      }),
    );
    const updatePayload =
      questionDraftMocks.updateServerDraft.mock.calls[0]?.[0];
    expect(JSON.stringify(updatePayload)).not.toMatch(
      /fileId|workbookId|checksumSha256|byteSize|status|originalName/,
    );
    expect(questionDraftMocks.attachDraftFile).toHaveBeenCalledWith({
      draftId: "draft_existing",
      expectedRevision: 2,
      fileId: "file_1",
      sourceId: "source_1",
    });
    expect(onDraftSaved).toHaveBeenCalledWith(
      expect.objectContaining({
        draft: expect.objectContaining({ revision: 3 }),
      }),
    );
    expect(onSourcesChange).toHaveBeenCalledWith([
      expect.objectContaining({
        backing: expect.objectContaining({
          byteSize: 1024,
          kind: "persisted_workbook",
          originalName: "server-local.xlsx",
          workbookId: "workbook_1",
        }),
      }),
    ]);

    fetchMock.mockRestore();
  });

  it("publishes a loaded draft through the draft API and preserves draft sources", async () => {
    const draftFileSource = createDraftFileSource();
    questionDraftMocks.updateServerDraft.mockResolvedValue({
      draft: {
        blueprintId: "blueprint-1",
        createdAt: new Date("2026-06-20T00:00:00.000Z"),
        createdByUserId: "owner-1",
        description: null,
        document: createDocument(),
        id: "draft_loaded",
        lastSavedAt: new Date("2026-06-21T00:00:00.000Z"),
        name: "Draft loaded",
        ownerUserId: "owner-1",
        revision: 2,
        sources: [],
        status: "draft",
        updatedAt: new Date("2026-06-21T00:00:00.000Z"),
      },
    });
    const publishResult = {
      draft: {
        id: "draft_loaded",
        revision: 3,
      },
      questionBlueprint: {
        description: null,
        id: "blueprint-1",
        name: "Published",
        sources: [
          {
            name: "Server source",
            sourceId: "source_1",
            workbookId: "workbook_1",
          },
        ],
      },
      questionBlueprintVersion: {
        blueprintId: "blueprint-1",
        id: "version-1",
      },
    };
    questionGenerationMocks.publishQuestionBlueprintDraft.mockResolvedValue(
      publishResult,
    );

    const onDraftPublished = vi.fn();

    const { result } = renderHook(() =>
      useStudioDraftSaveController({
        authoringModel: createModel(),
        blueprintDescription: "",
        blueprintName: "Draft",
        initialDraftId: "draft_loaded",
        initialDraftRevision: 1,
        onDraftSaved: () => {},
        onDraftPublished,
        onSourcesChange: () => {},
        readiness: {
          canGenerate: true,
          canSave: true,
          issues: [],
        },
        sources: [draftFileSource],
      }),
    );

    act(() => {
      result.current.publishDialog.onPublish();
    });

    await waitFor(() => {
      expect(
        questionGenerationMocks.publishQuestionBlueprintDraft,
      ).toHaveBeenCalledOnce();
    });

    expect(questionDraftMocks.updateServerDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        draftId: "draft_loaded",
        sources: [
          expect.objectContaining({
            name: "Server source",
            sourceId: "source_1",
            type: "workbook",
          }),
        ],
      }),
    );
    expect(
      questionGenerationMocks.publishQuestionBlueprintDraft,
    ).toHaveBeenCalledWith({
      draftId: "draft_loaded",
      expectedRevision: 2,
      idempotencyKey: expect.any(String),
    });
    expect(onDraftPublished).toHaveBeenCalledWith(publishResult);
  });

  it("reuses the publish idempotency key when retrying the same failed attempt", async () => {
    questionDraftMocks.updateServerDraft.mockResolvedValue({
      draft: {
        blueprintId: "blueprint-1",
        createdAt: new Date("2026-06-20T00:00:00.000Z"),
        createdByUserId: "owner-1",
        description: null,
        document: createDocument(),
        id: "draft_loaded",
        lastSavedAt: new Date("2026-06-21T00:00:00.000Z"),
        name: "Draft loaded",
        ownerUserId: "owner-1",
        revision: 2,
        sources: [],
        status: "draft",
        updatedAt: new Date("2026-06-21T00:00:00.000Z"),
      },
    });
    questionGenerationMocks.publishQuestionBlueprintDraft
      .mockRejectedValueOnce(new Error("Network timeout"))
      .mockResolvedValueOnce(createPublishResult());

    const onDraftPublished = vi.fn();
    const { result } = renderHook(() =>
      useStudioDraftSaveController({
        authoringModel: createModel(),
        blueprintDescription: "",
        blueprintName: "Draft",
        initialDraftId: "draft_loaded",
        initialDraftRevision: 1,
        onDraftPublished,
        onDraftSaved: () => {},
        onSourcesChange: () => {},
        readiness: {
          canGenerate: true,
          canSave: true,
          issues: [],
        },
        sources: [],
      }),
    );

    act(() => {
      result.current.publishDialog.onPublish();
    });

    await waitFor(() => {
      expect(result.current.commandBarSave.saveError).toBe("Network timeout");
    });

    act(() => {
      result.current.publishDialog.onPublish();
    });

    await waitFor(() => {
      expect(onDraftPublished).toHaveBeenCalledOnce();
    });
    const firstKey =
      questionGenerationMocks.publishQuestionBlueprintDraft.mock.calls[0]?.[0]
        ?.idempotencyKey;
    const retryKey =
      questionGenerationMocks.publishQuestionBlueprintDraft.mock.calls[1]?.[0]
        ?.idempotencyKey;

    expect(questionDraftMocks.updateServerDraft).toHaveBeenCalledOnce();
    expect(firstKey).toBeTruthy();
    expect(retryKey).toBe(firstKey);
  });

  it("invalidates a failed publish attempt when the draft changes before retry", async () => {
    questionDraftMocks.updateServerDraft
      .mockResolvedValueOnce({
        draft: {
          blueprintId: "blueprint-1",
          createdAt: new Date("2026-06-20T00:00:00.000Z"),
          createdByUserId: "owner-1",
          description: null,
          document: createDocument(),
          id: "draft_loaded",
          lastSavedAt: new Date("2026-06-21T00:00:00.000Z"),
          name: "Draft loaded",
          ownerUserId: "owner-1",
          revision: 2,
          sources: [],
          status: "draft",
          updatedAt: new Date("2026-06-21T00:00:00.000Z"),
        },
      })
      .mockResolvedValueOnce({
        draft: {
          blueprintId: "blueprint-1",
          createdAt: new Date("2026-06-20T00:00:00.000Z"),
          createdByUserId: "owner-1",
          description: "Edited",
          document: createDocument(),
          id: "draft_loaded",
          lastSavedAt: new Date("2026-06-21T00:00:00.000Z"),
          name: "Edited draft",
          ownerUserId: "owner-1",
          revision: 7,
          sources: [],
          status: "draft",
          updatedAt: new Date("2026-06-21T00:00:00.000Z"),
        },
      });
    questionGenerationMocks.publishQuestionBlueprintDraft
      .mockRejectedValueOnce(new Error("Network timeout"))
      .mockResolvedValueOnce(createPublishResult());

    const onDraftPublished = vi.fn();
    const { result } = renderHook(() =>
      useStudioDraftSaveController({
        authoringModel: createModel(),
        blueprintDescription: "",
        blueprintName: "Draft",
        initialDraftId: "draft_loaded",
        initialDraftRevision: 1,
        onDraftPublished,
        onDraftSaved: () => {},
        onSourcesChange: () => {},
        readiness: {
          canGenerate: true,
          canSave: true,
          issues: [],
        },
        sources: [],
      }),
    );

    act(() => {
      result.current.publishDialog.onPublish();
    });

    await waitFor(() => {
      expect(result.current.commandBarSave.saveError).toBe("Network timeout");
    });

    act(() => {
      result.current.markDraftChanged();
      result.current.publishDialog.onPublish();
    });

    await waitFor(() => {
      expect(onDraftPublished).toHaveBeenCalledOnce();
    });
    expect(questionDraftMocks.updateServerDraft).toHaveBeenCalledTimes(2);
    expect(
      questionGenerationMocks.publishQuestionBlueprintDraft,
    ).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        expectedRevision: 7,
      }),
    );
    const firstKey =
      questionGenerationMocks.publishQuestionBlueprintDraft.mock.calls[0]?.[0]
        ?.idempotencyKey;
    const secondKey =
      questionGenerationMocks.publishQuestionBlueprintDraft.mock.calls[1]?.[0]
        ?.idempotencyKey;
    expect(firstKey).toBeTruthy();
    expect(secondKey).toBeTruthy();
    expect(secondKey).not.toBe(firstKey);
  });

  it("invalidates a failed publish attempt after an explicit draft save", async () => {
    questionDraftMocks.updateServerDraft
      .mockResolvedValueOnce(createDraftResult("draft_loaded", 2))
      .mockResolvedValueOnce(createDraftResult("draft_loaded", 7))
      .mockResolvedValueOnce(createDraftResult("draft_loaded", 8));
    questionGenerationMocks.publishQuestionBlueprintDraft
      .mockRejectedValueOnce(new Error("Network timeout"))
      .mockResolvedValueOnce(createPublishResult());

    const onDraftPublished = vi.fn();
    const { result } = renderHook(() =>
      useStudioDraftSaveController({
        authoringModel: createModel(),
        blueprintDescription: "",
        blueprintName: "Draft",
        initialDraftId: "draft_loaded",
        initialDraftRevision: 1,
        onDraftPublished,
        onDraftSaved: () => {},
        onSourcesChange: () => {},
        readiness: {
          canGenerate: true,
          canSave: true,
          issues: [],
        },
        sources: [],
      }),
    );

    act(() => {
      result.current.publishDialog.onPublish();
    });

    await waitFor(() => {
      expect(result.current.commandBarSave.saveError).toBe("Network timeout");
    });
    const staleKey =
      questionGenerationMocks.publishQuestionBlueprintDraft.mock.calls[0]?.[0]
        ?.idempotencyKey;

    act(() => {
      result.current.commandBarSave.onSaveDraft();
    });

    await waitFor(() => {
      expect(questionDraftMocks.updateServerDraft).toHaveBeenCalledTimes(2);
    });

    act(() => {
      result.current.publishDialog.onPublish();
    });

    await waitFor(() => {
      expect(onDraftPublished).toHaveBeenCalledOnce();
    });
    expect(questionDraftMocks.updateServerDraft).toHaveBeenCalledTimes(3);
    expect(
      questionGenerationMocks.publishQuestionBlueprintDraft,
    ).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        draftId: "draft_loaded",
        expectedRevision: 8,
      }),
    );
    const freshKey =
      questionGenerationMocks.publishQuestionBlueprintDraft.mock.calls[1]?.[0]
        ?.idempotencyKey;
    expect(staleKey).toBeTruthy();
    expect(freshKey).toBeTruthy();
    expect(freshKey).not.toBe(staleKey);
  });

  it("invalidates a failed publish attempt when draft identity changes", async () => {
    questionDraftMocks.updateServerDraft
      .mockResolvedValueOnce(createDraftResult("draft_a", 2))
      .mockResolvedValueOnce(createDraftResult("draft_b", 5));
    questionGenerationMocks.publishQuestionBlueprintDraft
      .mockRejectedValueOnce(new Error("Network timeout"))
      .mockResolvedValueOnce(createPublishResult());

    const onDraftPublished = vi.fn();
    const { result, rerender } = renderHook(
      (props: { draftId: string; revision: number }) =>
        useStudioDraftSaveController({
          authoringModel: createModel(),
          blueprintDescription: "",
          blueprintName: "Draft",
          initialDraftId: props.draftId,
          initialDraftRevision: props.revision,
          onDraftPublished,
          onDraftSaved: () => {},
          onSourcesChange: () => {},
          readiness: {
            canGenerate: true,
            canSave: true,
            issues: [],
          },
          sources: [],
        }),
      {
        initialProps: {
          draftId: "draft_a",
          revision: 1,
        },
      },
    );

    act(() => {
      result.current.publishDialog.onPublish();
    });

    await waitFor(() => {
      expect(result.current.commandBarSave.saveError).toBe("Network timeout");
    });
    const staleKey =
      questionGenerationMocks.publishQuestionBlueprintDraft.mock.calls[0]?.[0]
        ?.idempotencyKey;

    rerender({ draftId: "draft_b", revision: 4 });

    act(() => {
      result.current.publishDialog.onPublish();
    });

    await waitFor(() => {
      expect(onDraftPublished).toHaveBeenCalledOnce();
    });
    expect(questionDraftMocks.updateServerDraft).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        draftId: "draft_b",
        expectedRevision: 4,
      }),
    );
    expect(
      questionGenerationMocks.publishQuestionBlueprintDraft,
    ).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        draftId: "draft_b",
        expectedRevision: 5,
      }),
    );
    const freshKey =
      questionGenerationMocks.publishQuestionBlueprintDraft.mock.calls[1]?.[0]
        ?.idempotencyKey;
    expect(staleKey).toBeTruthy();
    expect(freshKey).toBeTruthy();
    expect(freshKey).not.toBe(staleKey);
  });

  it("shows a blocking draft revision conflict state", async () => {
    questionDraftMocks.updateServerDraft.mockRejectedValue(
      createApiError("DRAFT_REVISION_CONFLICT"),
    );

    const { result } = renderHook(() =>
      useStudioDraftSaveController({
        authoringModel: createModel(),
        blueprintDescription: "",
        blueprintName: "Draft",
        initialDraftId: "draft_loaded",
        initialDraftRevision: 1,
        onDraftPublished: () => {},
        onDraftSaved: () => {},
        onSourcesChange: () => {},
        readiness: {
          canGenerate: true,
          canSave: true,
          issues: [],
        },
        sources: [],
      }),
    );

    act(() => {
      result.current.commandBarSave.onSaveDraft();
    });

    await waitFor(() => {
      expect(result.current.conflict?.type).toBe("revision_conflict");
    });
    expect(result.current.commandBarSave.saveError).toBe(
      "This changed in another tab.",
    );
  });

  it("shows a blocking base version conflict state", async () => {
    questionDraftMocks.updateServerDraft.mockResolvedValue({
      draft: {
        blueprintId: "blueprint-1",
        createdAt: new Date("2026-06-20T00:00:00.000Z"),
        createdByUserId: "owner-1",
        description: null,
        document: createDocument(),
        id: "draft_loaded",
        lastSavedAt: new Date("2026-06-21T00:00:00.000Z"),
        name: "Draft loaded",
        ownerUserId: "owner-1",
        revision: 2,
        sources: [],
        status: "draft",
        updatedAt: new Date("2026-06-21T00:00:00.000Z"),
      },
    });
    questionGenerationMocks.publishQuestionBlueprintDraft.mockRejectedValue(
      createApiError("BLUEPRINT_BASE_VERSION_CONFLICT"),
    );

    const { result } = renderHook(() =>
      useStudioDraftSaveController({
        authoringModel: createModel(),
        blueprintDescription: "",
        blueprintName: "Draft",
        initialDraftId: "draft_loaded",
        initialDraftRevision: 1,
        onDraftPublished: () => {},
        onDraftSaved: () => {},
        onSourcesChange: () => {},
        readiness: {
          canGenerate: true,
          canSave: true,
          issues: [],
        },
        sources: [],
      }),
    );

    act(() => {
      result.current.publishDialog.onPublish();
    });

    await waitFor(() => {
      expect(result.current.conflict?.type).toBe("base_version_conflict");
    });
    expect(result.current.commandBarSave.saveError).toBe(
      "This changed in another tab. Reload before publishing.",
    );
  });

  it("uses the latest loaded server draft id instead of stale private state", async () => {
    questionDraftMocks.updateServerDraft.mockImplementation(
      async (input: { draftId: string }) => ({
        draft: {
          blueprintId: "blueprint-1",
          createdAt: new Date("2026-06-20T00:00:00.000Z"),
          createdByUserId: "owner-1",
          description: null,
          document: createDocument(),
          id: input.draftId,
          lastSavedAt: new Date("2026-06-21T00:00:00.000Z"),
          name: "Draft existing",
          ownerUserId: "owner-1",
          revision: 2,
          sources: [],
          status: "draft",
          updatedAt: new Date("2026-06-21T00:00:00.000Z"),
        },
      }),
    );

    const { result, rerender } = renderHook(
      (props: { draftId: string }) =>
        useStudioDraftSaveController({
          authoringModel: createModel(),
          blueprintDescription: "",
          blueprintName: "Draft",
          initialDraftId: props.draftId,
          initialDraftRevision: 1,
          onDraftSaved: () => {},
          onDraftPublished: () => {},
          onSourcesChange: () => {},
          readiness: {
            canGenerate: true,
            canSave: true,
            issues: [],
          },
          sources: [],
        }),
      {
        initialProps: {
          draftId: "draft_old",
        },
      },
    );

    rerender({ draftId: "draft_loaded" });

    act(() => {
      result.current.commandBarSave.onSaveDraft();
    });

    await waitFor(() => {
      expect(questionDraftMocks.updateServerDraft).toHaveBeenCalledOnce();
    });
    expect(questionDraftMocks.updateServerDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        draftId: "draft_loaded",
      }),
    );
  });

  it("calls onDraftSaved for repeated draft saves", async () => {
    questionDraftMocks.updateServerDraft.mockResolvedValue({
      draft: {
        blueprintId: "blueprint-1",
        createdAt: new Date("2026-06-20T00:00:00.000Z"),
        createdByUserId: "owner-1",
        description: null,
        document: createDocument(),
        id: "draft_existing",
        lastSavedAt: new Date("2026-06-21T00:00:00.000Z"),
        name: "Draft existing",
        ownerUserId: "owner-1",
        revision: 2,
        sources: [],
        status: "draft",
        updatedAt: new Date("2026-06-21T00:00:00.000Z"),
      },
    });

    const onDraftSaved = vi.fn();
    const { result } = renderHook(() =>
      useStudioDraftSaveController({
        authoringModel: createModel(),
        blueprintDescription: "",
        blueprintName: "Draft",
        initialDraftId: "draft_existing",
        initialDraftRevision: 1,
        onDraftSaved,
        onDraftPublished: () => {},
        onSourcesChange: () => {},
        readiness: {
          canGenerate: true,
          canSave: true,
          issues: [],
        },
        sources: [],
      }),
    );

    act(() => {
      result.current.commandBarSave.onSaveDraft();
      result.current.commandBarSave.onSaveDraft();
    });

    await waitFor(() => {
      expect(onDraftSaved).toHaveBeenCalledTimes(2);
    });
    expect(onDraftSaved).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        draft: expect.objectContaining({
          id: "draft_existing",
          revision: 2,
        }),
      }),
    );
    expect(onDraftSaved).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        draft: expect.objectContaining({
          id: "draft_existing",
          revision: 2,
        }),
      }),
    );
  });
});

function createModel(): ComposedEditorModel {
  return {
    blocks: [],
    references: [],
    responseFields: [],
    schemaVersion: 1,
  };
}

function readinessWithCheckingInsertedValue() {
  return {
    canGenerate: false,
    canSave: true,
    issues: [
      {
        blockedActions: ["publish", "generate_saved_blueprint"] as const,
        id: "inserted_value_checking_ref_1",
        message: "Some inserted values are still being checked.",
        publishMessage:
          "Wait for workbook values to finish loading before publishing.",
        severity: "warning" as const,
      },
    ],
  };
}

function readinessWithUnavailableInsertedValue() {
  return {
    canGenerate: false,
    canSave: false,
    issues: [
      {
        blockedActions: [
          "save",
          "publish",
          "generate_saved_blueprint",
        ] as const,
        id: "inserted_value_unavailable_ref_1",
        message: "Some inserted values need attention.",
        publishMessage: "Review affected values before publishing.",
        severity: "error" as const,
      },
    ],
  };
}

function createDocument() {
  return {
    blocks: [],
    references: [],
    responseFields: [],
    schemaVersion: 1,
  };
}

function createDraftFileSource(): StudioSource {
  return {
    backing: {
      byteSize: 512,
      checksumSha256: "checksum-1",
      fileId: "file_1",
      kind: "draft_file",
      originalName: "server-source.xlsx",
      parsedWorkbook: null,
      previewError: null,
      previewStatus: "loaded",
      workbookId: null,
    },
    createdAt: new Date("2026-06-21T00:00:00.000Z"),
    name: "Server source",
    sourceId: "source_1",
    type: "workbook",
  };
}

function createLocalSource(): StudioSource {
  const file = new File(["xlsx"], "local.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  return {
    backing: {
      byteSize: file.size,
      file,
      kind: "local_file",
      lastModified: file.lastModified,
      originalName: file.name,
      parseError: null,
      parseStatus: "parsed",
      parsedWorkbook: null,
      uploadError: null,
      uploadStatus: "not_uploaded",
      workbookId: null,
    },
    createdAt: new Date("2026-06-21T00:00:00.000Z"),
    name: "Local source",
    sourceId: "source_1",
    type: "workbook",
  };
}

function createApiError(code: string) {
  return new AppApiError({
    body: null,
    headers: new Headers(),
    payload: {
      code,
      message: code,
      requestId: "request-1",
    },
    status: 409,
  });
}

function createPublishResult() {
  return {
    draft: {
      id: "draft_loaded",
      revision: 3,
    },
    questionBlueprint: {
      description: null,
      id: "blueprint-1",
      name: "Published",
      sources: [],
    },
    questionBlueprintVersion: {
      blueprintId: "blueprint-1",
      id: "version-1",
    },
  };
}

function createDraftResult(draftId: string, revision: number) {
  return {
    draft: {
      blueprintId: "blueprint-1",
      createdAt: new Date("2026-06-20T00:00:00.000Z"),
      createdByUserId: "owner-1",
      description: null,
      document: createDocument(),
      id: draftId,
      lastSavedAt: new Date("2026-06-21T00:00:00.000Z"),
      name: "Draft loaded",
      ownerUserId: "owner-1",
      revision,
      sources: [],
      status: "draft",
      updatedAt: new Date("2026-06-21T00:00:00.000Z"),
    },
  };
}
