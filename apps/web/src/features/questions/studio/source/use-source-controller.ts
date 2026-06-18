import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import { getBlueprintSourceRequirement } from "#/domains/questions/source-requirements";
import {
  useCreateWorkbookCalculation,
  useValidateWorkbook,
  useWorkbookQuery,
  useWorkbooksQuery,
} from "#/domains/workbooks/hooks";
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
    onCreated(workbook: Workbook): void | Promise<void>;
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

const SOURCE_PREPARATION_REFETCH_INTERVAL_MS = 1_000;
const SOURCE_PREVIEW_REQUESTED_COUNT = 1;

export function useSourceController(input: {
  loadWorkbookPickerPreview: boolean;
  model: ComposedEditorModel;
  selectedWorkbookId: string | null;
  onSelectedWorkbookIdChange(workbookId: string | null): void;
}): SourceController {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [sourcePreparation, setSourcePreparation] = useState<{
    workbookId: string;
    calculationRequested: boolean;
  } | null>(null);
  const [sourcePreparationError, setSourcePreparationError] = useState<
    string | null
  >(null);
  const requestedPreviewCalculationWorkbookIdsRef = useRef(new Set<string>());
  const workbooksQuery = useWorkbooksQuery();
  const selectedWorkbookQuery = useWorkbookQuery(
    input.selectedWorkbookId ?? "",
    {
      enabled: Boolean(input.selectedWorkbookId),
      refetchInterval: (query) => {
        const workbook = query.state.data;
        return workbook?.status === "pending_validation"
          ? SOURCE_PREPARATION_REFETCH_INTERVAL_MS
          : false;
      },
    },
  );
  const { mutateAsync: validateWorkbookAsync } = useValidateWorkbook();
  const { mutateAsync: createWorkbookCalculationAsync } =
    useCreateWorkbookCalculation();
  const sourceRequirement = useMemo(
    () => getBlueprintSourceRequirement(input.model),
    [input.model],
  );
  const workbooks = workbooksQuery.data?.workbooks ?? [];
  const selectedWorkbookFromList =
    workbooks.find((workbook) => workbook.id === input.selectedWorkbookId) ??
    null;
  const selectedWorkbook =
    selectedWorkbookQuery.data ?? selectedWorkbookFromList ?? null;
  const workbookPreviewController = useSelectedWorkbookPreview({
    loadPickerPreview: input.loadWorkbookPickerPreview,
    selectedWorkbook: selectedWorkbook
      ? {
          id: selectedWorkbook.id,
          originalName: selectedWorkbook.originalName,
          status: selectedWorkbook.status,
        }
      : null,
  });
  const readySources = workbooks.filter(isWorkbookUsableAsSource);
  const isSelectedWorkbookLoading = input.selectedWorkbookId
    ? !selectedWorkbook &&
      (workbooksQuery.isLoading || selectedWorkbookQuery.isLoading)
    : false;

  const sourceCard = getStudioSourceViewState({
    sourceRequirement,
    selectedWorkbookId: input.selectedWorkbookId,
    selectedWorkbook,
    isWorkbooksLoading: isSelectedWorkbookLoading,
    previewStatus: sourcePreparationError
      ? "error"
      : workbookPreviewController.previewStatus,
    previewError:
      sourcePreparationError ?? workbookPreviewController.workbookPreviewError,
  });

  const requestPreviewCalculation = useCallback(
    (workbookId: string) => {
      if (requestedPreviewCalculationWorkbookIdsRef.current.has(workbookId)) {
        return false;
      }

      requestedPreviewCalculationWorkbookIdsRef.current.add(workbookId);

      void createWorkbookCalculationAsync({
        workbookId,
        requestedCount: SOURCE_PREVIEW_REQUESTED_COUNT,
        correlationId: `studio-source-preview:${workbookId}`,
      })
        .catch(() => {
          setSourcePreparationError("Source preview could not be requested.");
        })
        .finally(() => {
          setSourcePreparation((current) =>
            current?.workbookId === workbookId ? null : current,
          );
        });

      return true;
    },
    [createWorkbookCalculationAsync],
  );

  useEffect(() => {
    if (!sourcePreparation || sourcePreparation.calculationRequested) {
      return;
    }

    if (
      !selectedWorkbook ||
      selectedWorkbook.id !== sourcePreparation.workbookId ||
      selectedWorkbook.status === "pending_validation"
    ) {
      return;
    }

    if (selectedWorkbook.status !== "valid") {
      setSourcePreparation(null);
      return;
    }

    const workbookId = selectedWorkbook.id;
    if (requestPreviewCalculation(workbookId)) {
      setSourcePreparation({
        workbookId,
        calculationRequested: true,
      });
      return;
    }

    setSourcePreparation(null);
  }, [requestPreviewCalculation, selectedWorkbook, sourcePreparation]);

  useEffect(() => {
    if (
      !selectedWorkbook ||
      selectedWorkbook.status !== "valid" ||
      !workbookPreviewController.needsWorkbookPreviewCalculation
    ) {
      return;
    }

    requestPreviewCalculation(selectedWorkbook.id);
  }, [
    requestPreviewCalculation,
    selectedWorkbook,
    workbookPreviewController.needsWorkbookPreviewCalculation,
  ]);

  function selectSource(workbookId: string) {
    setSourcePreparation(null);
    setSourcePreparationError(null);
    requestedPreviewCalculationWorkbookIdsRef.current.delete(workbookId);
    input.onSelectedWorkbookIdChange(workbookId);
    setIsPickerOpen(false);
  }

  function openUpload() {
    setSourcePreparationError(null);
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
      onCreated: async (workbook) => {
        setSourcePreparationError(null);
        const validatingWorkbook = await validateWorkbookAsync({
          workbookId: workbook.id,
        });

        notifySourceUploaded({
          context: "studio",
          sourceName: validatingWorkbook.name,
        });
        setSourcePreparation({
          workbookId: validatingWorkbook.id,
          calculationRequested: false,
        });
        input.onSelectedWorkbookIdChange(validatingWorkbook.id);
        setIsUploadOpen(false);
      },
    },
    actions: {
      addSource: () => setIsPickerOpen(true),
      changeSource: () => setIsPickerOpen(true),
      uploadSource: openUpload,
      removeSource: () => {
        setSourcePreparation(null);
        setSourcePreparationError(null);
        requestedPreviewCalculationWorkbookIdsRef.current.clear();
        input.onSelectedWorkbookIdChange(null);
      },
    },
    getWorkbookName: (workbookId) =>
      workbooks.find((workbook) => workbook.id === workbookId)?.name ?? null,
    selectedWorkbook,
    sourceRequirement,
    workbookPreviewController,
  };
}
