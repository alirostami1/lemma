import { useMemo, useState } from "react";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import { getBlueprintSourceRequirement } from "#/domains/questions/source-requirements";
import { useWorkbooksQuery } from "#/domains/workbooks/hooks";
import type { Workbook } from "#/domains/workbooks/model";
import { isWorkbookUsableAsSource } from "#/domains/workbooks/source-status";
import { notifySourceUploaded } from "#/features/notifications";
import {
  type SelectedWorkbookPreviewController,
  useSelectedWorkbookPreview,
} from "../use-selected-workbook-preview";
import {
  getStudioSourceViewState,
  type StudioSourceViewState,
} from "./source-state";

export type SourceController = {
  sourceCard: StudioSourceViewState;
  pickerDialog: {
    open: boolean;
    sources: Workbook[];
    isLoading: boolean;
    errorMessage: string | null;
    onOpenChange(open: boolean): void;
    onSelectSource(workbookId: string): void;
    onUploadSource(): void;
  };
  uploadDialog: {
    open: boolean;
    onOpenChange(open: boolean): void;
    onCreated(workbook: Workbook): void;
  };
  actions: {
    addSource(): void;
    changeSource(): void;
    uploadSource(): void;
    removeSource(): void;
  };
  getWorkbookName(workbookId: string | null): string | null;
  selectedWorkbook: Workbook | null;
  sourceRequirement: ReturnType<typeof getBlueprintSourceRequirement>;
  workbookPreviewController: SelectedWorkbookPreviewController;
};

export function useSourceController(input: {
  model: ComposedEditorModel;
  selectedWorkbookId: string | null;
  onSelectedWorkbookIdChange(workbookId: string | null): void;
}): SourceController {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const workbooksQuery = useWorkbooksQuery();
  const sourceRequirement = useMemo(
    () => getBlueprintSourceRequirement(input.model),
    [input.model],
  );
  const workbooks = workbooksQuery.data?.workbooks ?? [];
  const selectedWorkbook =
    workbooks.find((workbook) => workbook.id === input.selectedWorkbookId) ??
    null;
  const workbookPreviewController = useSelectedWorkbookPreview({
    selectedWorkbook: selectedWorkbook
      ? {
          fileId: selectedWorkbook.fileId,
          originalName: selectedWorkbook.originalName,
          status: selectedWorkbook.status,
        }
      : null,
  });
  const readySources = workbooks.filter(isWorkbookUsableAsSource);

  const sourceCard = getStudioSourceViewState({
    sourceRequirement,
    selectedWorkbookId: input.selectedWorkbookId,
    selectedWorkbook,
    isWorkbooksLoading: workbooksQuery.isLoading,
    previewStatus: workbookPreviewController.previewStatus,
    previewError: workbookPreviewController.workbookPreviewError,
  });

  function selectSource(workbookId: string) {
    input.onSelectedWorkbookIdChange(workbookId);
    setIsPickerOpen(false);
  }

  function openUpload() {
    setIsPickerOpen(false);
    setIsUploadOpen(true);
  }

  return {
    sourceCard,
    pickerDialog: {
      open: isPickerOpen,
      sources: readySources,
      isLoading: workbooksQuery.isLoading,
      errorMessage: workbooksQuery.isError
        ? "Sources could not be loaded."
        : null,
      onOpenChange: setIsPickerOpen,
      onSelectSource: selectSource,
      onUploadSource: openUpload,
    },
    uploadDialog: {
      open: isUploadOpen,
      onOpenChange: setIsUploadOpen,
      onCreated: (workbook) => {
        notifySourceUploaded({
          context: "studio",
          sourceName: workbook.name,
        });
        input.onSelectedWorkbookIdChange(workbook.id);
        setIsUploadOpen(false);
      },
    },
    actions: {
      addSource: () => setIsPickerOpen(true),
      changeSource: () => setIsPickerOpen(true),
      uploadSource: openUpload,
      removeSource: () => input.onSelectedWorkbookIdChange(null),
    },
    getWorkbookName: (workbookId) =>
      workbooks.find((workbook) => workbook.id === workbookId)?.name ?? null,
    selectedWorkbook,
    sourceRequirement,
    workbookPreviewController,
  };
}
