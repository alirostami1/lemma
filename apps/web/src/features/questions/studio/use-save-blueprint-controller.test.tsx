// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import type { StudioSource } from "./source/studio-source-model";
import { useSaveBlueprintController } from "./use-save-blueprint-controller";

const fileUploadMocks = vi.hoisted(() => ({
  completeFileUpload: vi.fn(),
  createFileUpload: vi.fn(),
}));
const questionDraftMocks = vi.hoisted(() => ({
  attachDraftFile: vi.fn(),
  createServerDraft: vi.fn(),
  updateServerDraft: vi.fn(),
}));
const questionBlueprintMocks = vi.hoisted(() => ({
  createQuestionBlueprint: vi.fn(),
  updateQuestionBlueprint: vi.fn(),
}));
const questionGenerationMocks = vi.hoisted(() => ({
  publishQuestionBlueprintDraft: vi.fn(),
}));
const workbookMocks = vi.hoisted(() => ({
  createWorkbook: vi.fn(),
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
  useCreateQuestionBlueprint: () => ({
    isPending: false,
    mutateAsync: questionBlueprintMocks.createQuestionBlueprint,
  }),
  useCreateQuestionBlueprintDraft: () => ({
    isPending: false,
    mutateAsync: questionDraftMocks.createServerDraft,
  }),
  usePublishQuestionBlueprintDraft: () => ({
    isPending: false,
    mutateAsync: questionGenerationMocks.publishQuestionBlueprintDraft,
  }),
  useUpdateQuestionBlueprint: () => ({
    isPending: false,
    mutateAsync: questionBlueprintMocks.updateQuestionBlueprint,
  }),
  useUpdateQuestionBlueprintDraft: () => ({
    isPending: false,
    mutateAsync: questionDraftMocks.updateServerDraft,
  }),
}));

vi.mock("#/domains/workbooks/hooks", () => ({
  useCreateWorkbook: () => ({
    isPending: false,
    mutateAsync: workbookMocks.createWorkbook,
  }),
}));

vi.mock("#/features/notifications", () => ({
  notifyBlueprintSaved: vi.fn(),
  notifyBlueprintSaveFailed: vi.fn(),
}));

describe("useSaveBlueprintController", () => {
  beforeEach(() => {
    fileUploadMocks.createFileUpload.mockReset();
    fileUploadMocks.completeFileUpload.mockReset();
    questionDraftMocks.createServerDraft.mockReset();
    questionDraftMocks.updateServerDraft.mockReset();
    questionDraftMocks.attachDraftFile.mockReset();
    questionGenerationMocks.publishQuestionBlueprintDraft.mockReset();
    questionBlueprintMocks.createQuestionBlueprint.mockReset();
    questionBlueprintMocks.updateQuestionBlueprint.mockReset();
    workbookMocks.createWorkbook.mockReset();
  });

  it("creates a new draft and invokes onDraftSaved with the new draft id", async () => {
    questionDraftMocks.createServerDraft.mockResolvedValue({
      draft: {
        blueprintId: null,
        createdAt: new Date("2026-06-20T00:00:00.000Z"),
        createdByUserId: "owner-1",
        description: null,
        document: createDocument(),
        id: "draft_new",
        lastSavedAt: new Date("2026-06-21T00:00:00.000Z"),
        name: "Test draft",
        ownerUserId: "owner-1",
        sources: [],
        status: "draft",
        updatedAt: new Date("2026-06-21T00:00:00.000Z"),
      },
    });
    questionDraftMocks.updateServerDraft.mockResolvedValue({
      draft: {
        blueprintId: null,
        createdAt: new Date("2026-06-20T00:00:00.000Z"),
        createdByUserId: "owner-1",
        description: null,
        document: createDocument(),
        id: "draft_new",
        lastSavedAt: new Date("2026-06-21T00:00:00.000Z"),
        name: "Test draft",
        ownerUserId: "owner-1",
        sources: [],
        status: "draft",
        updatedAt: new Date("2026-06-21T00:00:00.000Z"),
      },
    });

    const onDraftSaved = vi.fn();

    const { result } = renderHook(() =>
      useSaveBlueprintController({
        authoringModel: createModel(),
        blueprintDescription: "",
        blueprintName: "Draft",
        hasUnsavedChanges: false,
        initialDraftId: null,
        loadedBlueprintId: null,
        onDraftSaved,
        onSaved: () => {},
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
      expect(questionDraftMocks.createServerDraft).toHaveBeenCalledTimes(1);
      expect(questionDraftMocks.updateServerDraft).toHaveBeenCalledTimes(1);
      expect(onDraftSaved).toHaveBeenCalledOnce();
    });

    expect(onDraftSaved).toHaveBeenCalledExactlyOnceWith({
      draftId: "draft_new",
    });
  });

  it("updates an existing draft and calls onDraftSaved with the existing draft id", async () => {
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
        sources: [],
        status: "draft",
        updatedAt: new Date("2026-06-21T00:00:00.000Z"),
      },
    });

    const onDraftSaved = vi.fn();

    const { result } = renderHook(() =>
      useSaveBlueprintController({
        authoringModel: createModel(),
        blueprintDescription: "",
        blueprintName: "Draft",
        hasUnsavedChanges: false,
        initialDraftId: "draft_existing",
        loadedBlueprintId: null,
        onDraftSaved,
        onSaved: () => {},
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
      draftId: "draft_existing",
    });
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
        sources: [],
        status: "draft",
        updatedAt: new Date("2026-06-21T00:00:00.000Z"),
      },
    });
    questionGenerationMocks.publishQuestionBlueprintDraft.mockResolvedValue({
      draft: {
        id: "draft_loaded",
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
    });

    const onSaved = vi.fn();

    const { result } = renderHook(() =>
      useSaveBlueprintController({
        authoringModel: createModel(),
        blueprintDescription: "",
        blueprintName: "Draft",
        hasUnsavedChanges: false,
        initialDraftId: "draft_loaded",
        loadedBlueprintId: "blueprint-1",
        onDraftSaved: () => {},
        onSaved,
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
      result.current.saveDialog.onSave({
        mode: "update_existing",
        name: "Draft",
      });
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
            byteSize: 512,
            checksumSha256: "checksum-1",
            fileId: "file_1",
            name: "Server source",
            originalName: "server-source.xlsx",
            sourceId: "source_1",
            status: "uploaded",
            type: "workbook",
            workbookId: null,
          }),
        ],
      }),
    );
    expect(
      questionGenerationMocks.publishQuestionBlueprintDraft,
    ).toHaveBeenCalledWith("draft_loaded");
    expect(
      questionBlueprintMocks.createQuestionBlueprint,
    ).not.toHaveBeenCalled();
    expect(
      questionBlueprintMocks.updateQuestionBlueprint,
    ).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledOnce();
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
          sources: [],
          status: "draft",
          updatedAt: new Date("2026-06-21T00:00:00.000Z"),
        },
      }),
    );

    const { result, rerender } = renderHook(
      (props: { draftId: string }) =>
        useSaveBlueprintController({
          authoringModel: createModel(),
          blueprintDescription: "",
          blueprintName: "Draft",
          hasUnsavedChanges: false,
          initialDraftId: props.draftId,
          loadedBlueprintId: null,
          onDraftSaved: () => {},
          onSaved: () => {},
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
    expect(questionDraftMocks.createServerDraft).not.toHaveBeenCalled();
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
        sources: [],
        status: "draft",
        updatedAt: new Date("2026-06-21T00:00:00.000Z"),
      },
    });

    const onDraftSaved = vi.fn();
    const { result } = renderHook(() =>
      useSaveBlueprintController({
        authoringModel: createModel(),
        blueprintDescription: "",
        blueprintName: "Draft",
        hasUnsavedChanges: false,
        initialDraftId: "draft_existing",
        loadedBlueprintId: null,
        onDraftSaved,
        onSaved: () => {},
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
    expect(onDraftSaved).toHaveBeenNthCalledWith(1, {
      draftId: "draft_existing",
    });
    expect(onDraftSaved).toHaveBeenNthCalledWith(2, {
      draftId: "draft_existing",
    });
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
