import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import { getBlueprintSourceRequirement } from "#/domains/questions/source-requirements";
import {
  useCreateWorkbookCalculation,
  useValidateWorkbook,
  useWorkbookQuery,
} from "#/domains/workbooks/hooks";
import type { Workbook } from "#/domains/workbooks/model";
import { notifySourceUploaded } from "#/features/notifications";
import {
  type SelectedWorkbookPreviewController,
  useSelectedWorkbookPreview,
} from "../use-selected-workbook-preview";
import {
  type StudioSourceSessionSource,
  useSourceSessionRegistry,
} from "./source-session-registry";
import {
  getStudioSourceViewState,
  type StudioSourceViewState,
} from "./source-state";

export type SourceController = {
  sourceCard: StudioSourceViewState;
  sources: StudioSourceSessionSource[];
  activeSource: StudioSourceSessionSource | null;
  uploadDialog: {
    open: boolean;
    onOpenChange(open: boolean): void;
    onCreated(workbook: Workbook): void | Promise<void>;
  };
  actions: {
    addSource(): void;
    changeSource(): void;
    removeSource(): void;
  };
  getWorkbookName(workbookId: string | null): string | null;
  getSourceById(sourceId: string): StudioSourceSessionSource | null;
  getSourceByName(sourceName: string): StudioSourceSessionSource | null;
  selectedWorkbook: Workbook | null;
  sourceRequirement: ReturnType<typeof getBlueprintSourceRequirement>;
  workbookPreviewController: SelectedWorkbookPreviewController;
};

const SOURCE_PREPARATION_REFETCH_INTERVAL_MS = 1_000;
const SOURCE_PREVIEW_REQUESTED_COUNT = 1;

export function useSourceController(input: {
  loadWorkbookPickerPreview: boolean;
  model: ComposedEditorModel;
  initialSources?: StudioSourceSessionSource[];
  selectedWorkbookId: string | null;
  isVersionBoundSource: boolean;
  onSelectedWorkbookIdChange(workbookId: string | null): void;
}): SourceController {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [sourcePreparation, setSourcePreparation] = useState<{
    workbookId: string;
    calculationRequested: boolean;
  } | null>(null);
  const [sourcePreparationError, setSourcePreparationError] = useState<
    string | null
  >(null);
  const requestedPreviewCalculationWorkbookIdsRef = useRef(new Set<string>());
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
  const selectedWorkbook = selectedWorkbookQuery.data ?? null;
  const sourceRegistry = useSourceSessionRegistry({
    activeWorkbook: selectedWorkbook,
    initialSources: input.initialSources ?? [],
    selectedWorkbookId: input.selectedWorkbookId,
    onSelectedWorkbookIdChange: input.onSelectedWorkbookIdChange,
  });
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
  const isSelectedWorkbookLoading = input.selectedWorkbookId
    ? !selectedWorkbook && selectedWorkbookQuery.isLoading
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
    isVersionBoundSource: input.isVersionBoundSource,
  });

  const requestPreviewCalculation = useCallback(
    (workbookId: string, activeSource: StudioSourceSessionSource | null) => {
      if (!activeSource || activeSource.workbookId !== workbookId) {
        return false;
      }

      if (requestedPreviewCalculationWorkbookIdsRef.current.has(workbookId)) {
        return false;
      }

      requestedPreviewCalculationWorkbookIdsRef.current.add(workbookId);

      void createWorkbookCalculationAsync({
        workbookId,
        requestedCount: SOURCE_PREVIEW_REQUESTED_COUNT,
        correlationId: `studio-source-preview:${workbookId}`,
        workbookSources: [
          {
            sourceId: activeSource.sourceId,
            workbookId: activeSource.workbookId,
          },
        ],
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
    if (requestPreviewCalculation(workbookId, sourceRegistry.activeSource)) {
      setSourcePreparation({
        workbookId,
        calculationRequested: true,
      });
      return;
    }

    setSourcePreparation(null);
  }, [
    requestPreviewCalculation,
    selectedWorkbook,
    sourcePreparation,
    sourceRegistry.activeSource,
  ]);

  useEffect(() => {
    if (
      !selectedWorkbook ||
      selectedWorkbook.status !== "valid" ||
      !workbookPreviewController.needsWorkbookPreviewCalculation
    ) {
      return;
    }

    requestPreviewCalculation(selectedWorkbook.id, sourceRegistry.activeSource);
  }, [
    requestPreviewCalculation,
    selectedWorkbook,
    sourceRegistry.activeSource,
    workbookPreviewController.needsWorkbookPreviewCalculation,
  ]);

  function openUpload() {
    setSourcePreparationError(null);
    setIsUploadOpen(true);
  }

  return {
    sourceCard: {
      ...sourceCard,
      sources: sourceRegistry.sources,
      activeSourceId: sourceRegistry.activeSource?.sourceId ?? null,
      onActivateSourceId: sourceRegistry.activateSourceById,
    },
    sources: sourceRegistry.sources,
    activeSource: sourceRegistry.activeSource,
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
        sourceRegistry.attachWorkbook(validatingWorkbook);
        setIsUploadOpen(false);
      },
    },
    actions: {
      addSource: openUpload,
      changeSource: openUpload,
      removeSource: () => {
        setSourcePreparation(null);
        setSourcePreparationError(null);
        requestedPreviewCalculationWorkbookIdsRef.current.clear();
        sourceRegistry.removeActiveSource();
      },
    },
    getWorkbookName: sourceRegistry.getWorkbookName,
    getSourceById: sourceRegistry.getSourceById,
    getSourceByName: sourceRegistry.getSourceByName,
    selectedWorkbook,
    sourceRequirement,
    workbookPreviewController,
  };
}
