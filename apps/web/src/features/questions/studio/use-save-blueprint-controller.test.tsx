// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
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
