import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import { getUsedWorkbookSourceCountsFromComposedEditorModel } from "#/domains/questions/authoring";
import {
  useCreateWorkbookCalculation,
  useWorkbookQuery,
} from "#/domains/workbooks/hooks";
import type { Workbook } from "#/domains/workbooks/model";
import type { QuestionBlueprintWorkbookSource } from "#/domains/questions/model";
import {
  type SelectedWorkbookPreviewController,
  useSelectedWorkbookPreview,
} from "../use-selected-workbook-preview";
import {
  getStudioSourceViewState,
  isLocalWorkbookSource,
  type StudioSourceViewState,
} from "./source-state";

export type SourceController = {
  sourceCard: StudioSourceViewState;
  sources: QuestionBlueprintWorkbookSource[];
  previewSourceId: string | null;
  actions: {
    addSource(): void;
    removeSource(sourceId: string): void;
    setPreviewSourceId(sourceId: string | null): void;
  };
  getSourceById(sourceId: string): QuestionBlueprintWorkbookSource | null;
  getSourceByName(sourceName: string): QuestionBlueprintWorkbookSource | null;
  previewSourceWorkbook: Workbook | null;
  isPreviewSourceLoading: boolean;
  workbookPreviewController: SelectedWorkbookPreviewController;
};

const SOURCE_PREPARATION_REFETCH_INTERVAL_MS = 1_000;
const SOURCE_PREVIEW_REQUESTED_COUNT = 1;

export function useSourceController(input: {
  loadWorkbookPickerPreview: boolean;
  model: ComposedEditorModel;
  sources: QuestionBlueprintWorkbookSource[];
  onSourcesChange(sources: QuestionBlueprintWorkbookSource[]): void;
}): SourceController {
  const [previewSourceId, setPreviewSourceId] = useState<string | null>(
    () => input.sources[0]?.sourceId ?? null,
  );
  const [sourcePreparationError, setSourcePreparationError] = useState<
    string | null
  >(null);
  const [sourcePreparation, setSourcePreparation] = useState<{
    sourceId: string;
    calculationRequested: boolean;
  } | null>(null);
  const requestedPreviewCalculationSourceIdsRef = useRef(new Set<string>());
  const nextSourceNumberRef = useRef(getNextSourceNumber(input.sources));
  const { mutateAsync: createWorkbookCalculationAsync } =
    useCreateWorkbookCalculation();
  const sourceUsageCounts = useMemo(
    () =>
      Object.fromEntries(
        getUsedWorkbookSourceCountsFromComposedEditorModel(input.model),
      ),
    [input.model],
  );
  const previewSource = useMemo(
    () =>
      previewSourceId
        ? input.sources.find((source) => source.sourceId === previewSourceId) ??
          null
        : null,
    [input.sources, previewSourceId],
  );
  const previewSourceIsLocal = previewSource
    ? isLocalWorkbookSource(previewSource.workbookId)
    : false;
  const previewSourceWorkbookQuery = useWorkbookQuery(
    previewSource?.workbookId ?? "",
    {
      enabled: Boolean(previewSource) && !previewSourceIsLocal,
      refetchInterval: (query) => {
        const workbook = query.state.data;
        return workbook?.status === "pending_validation"
          ? SOURCE_PREPARATION_REFETCH_INTERVAL_MS
          : false;
      },
    },
  );
  const previewSourceWorkbook = previewSourceWorkbookQuery.data ?? null;
  const previewSourceWorkbookQueryIsLoading = previewSource
    ? previewSourceWorkbookQuery.isLoading
    : false;
  const previewSourceWorkbookQueryIsError = previewSource
    ? previewSourceWorkbookQuery.isError
    : false;
  const workbookPreviewController = useSelectedWorkbookPreview({
    loadPickerPreview: input.loadWorkbookPickerPreview,
    selectedWorkbook: previewSourceWorkbook
      ? {
          id: previewSourceWorkbook.id,
          originalName: previewSourceWorkbook.originalName,
          status: previewSourceWorkbook.status,
        }
      : null,
  });
  const isSelectedWorkbookLoading = previewSource
    ? previewSourceWorkbookQueryIsLoading && !previewSourceIsLocal
    : false;
  const previewSourceStatusError =
    sourcePreparationError ??
    (previewSourceWorkbookQueryIsError && !previewSourceIsLocal
      ? "Source could not be loaded."
      : null);

  const sourceCard = useMemo(
    () =>
      getStudioSourceViewState({
        sources: input.sources,
        previewSourceId,
        previewSourceWorkbook,
        isPreviewSourceLoading: isSelectedWorkbookLoading,
        previewStatus: previewSourceStatusError
          ? "error"
          : workbookPreviewController.previewStatus,
        previewError:
          previewSourceStatusError ??
          workbookPreviewController.workbookPreviewError,
        sourceUsageCounts,
      }),
    [
      input.sources,
      isSelectedWorkbookLoading,
      previewSourceId,
      previewSourceStatusError,
      previewSourceWorkbook,
      sourceUsageCounts,
      workbookPreviewController.previewStatus,
      workbookPreviewController.workbookPreviewError,
    ],
  );

  useEffect(() => {
    nextSourceNumberRef.current = Math.max(
      nextSourceNumberRef.current,
      getNextSourceNumber(input.sources),
    );
  }, [input.sources]);

  const requestPreviewCalculation = useCallback(
    (source: QuestionBlueprintWorkbookSource | null) => {
      if (!source) {
        return false;
      }

      if (
        sourcePreparation?.sourceId === source.sourceId &&
        sourcePreparation.calculationRequested
      ) {
        return false;
      }

      if (requestedPreviewCalculationSourceIdsRef.current.has(source.sourceId)) {
        return false;
      }

      requestedPreviewCalculationSourceIdsRef.current.add(source.sourceId);

      void createWorkbookCalculationAsync({
        workbookId: source.workbookId,
        requestedCount: SOURCE_PREVIEW_REQUESTED_COUNT,
        correlationId: `studio-source-preview:${source.sourceId}`,
        sources: [
          {
            sourceId: source.sourceId,
            workbookId: source.workbookId,
            name: source.name,
          },
        ],
      })
        .catch(() => {
          setSourcePreparationError("Source preview could not be requested.");
        })
        .finally(() => {
          setSourcePreparation((current) =>
            current?.sourceId === source.sourceId ? null : current,
          );
        });

      return true;
    },
    [createWorkbookCalculationAsync, sourcePreparation],
  );

  useEffect(() => {
    if (!sourcePreparation || sourcePreparation.calculationRequested) {
      return;
    }

    if (
      !previewSource ||
      previewSource.sourceId !== sourcePreparation.sourceId ||
      previewSourceWorkbook?.status === "pending_validation"
    ) {
      return;
    }

    if (previewSourceWorkbook?.status !== "valid") {
      setSourcePreparation(null);
      return;
    }

    if (requestPreviewCalculation(previewSource)) {
      setSourcePreparation({
        sourceId: previewSource.sourceId,
        calculationRequested: true,
      });
      return;
    }

    setSourcePreparation(null);
  }, [
    previewSource,
    previewSourceWorkbook,
    requestPreviewCalculation,
    sourcePreparation,
  ]);

  useEffect(() => {
    if (
      !previewSource ||
      previewSourceWorkbook?.status !== "valid" ||
      !workbookPreviewController.needsWorkbookPreviewCalculation
    ) {
      return;
    }

    requestPreviewCalculation(previewSource);
  }, [
    previewSource,
    previewSourceWorkbook,
    requestPreviewCalculation,
    workbookPreviewController.needsWorkbookPreviewCalculation,
  ]);

  useEffect(() => {
    if (!previewSource || previewSourceStatusError) {
      return;
    }

    if (!sourcePreparation?.calculationRequested) {
      return;
    }

    if (previewSource.sourceId !== sourcePreparation.sourceId) {
      setSourcePreparation(null);
    }
  }, [previewSource, previewSourceStatusError, sourcePreparation]);

  useEffect(() => {
    if (input.sources.length === 0) {
      if (previewSourceId !== null) {
        setPreviewSourceId(null);
      }
      return;
    }

    if (
      !previewSourceId ||
      !input.sources.some((source) => source.sourceId === previewSourceId)
    ) {
      setPreviewSourceId(input.sources[0]?.sourceId ?? null);
    }
  }, [input.sources, previewSourceId]);

  const addSource = useCallback(() => {
    setSourcePreparationError(null);
    const source = createLocalSource(nextSourceNumberRef.current);
    nextSourceNumberRef.current += 1;
    input.onSourcesChange([...input.sources, source]);
    setPreviewSourceId(source.sourceId);
  }, [input]);

  const removeSource = useCallback(
    (sourceId: string) => {
      if ((sourceUsageCounts[sourceId] ?? 0) > 0) {
        return;
      }
      setSourcePreparation(null);
      setSourcePreparationError(null);
      requestedPreviewCalculationSourceIdsRef.current.delete(sourceId);
      input.onSourcesChange(
        input.sources.filter((source) => source.sourceId !== sourceId),
      );
      setPreviewSourceId((current) => (current === sourceId ? null : current));
    },
    [input, sourceUsageCounts],
  );

  return {
    sourceCard,
    sources: input.sources,
    previewSourceId,
    actions: {
      addSource,
      removeSource,
      setPreviewSourceId,
    },
    getSourceById: (sourceId) =>
      input.sources.find((source) => source.sourceId === sourceId) ?? null,
    getSourceByName: (sourceName) =>
      input.sources.find((source) => source.name === sourceName) ?? null,
    previewSourceWorkbook,
    isPreviewSourceLoading: isSelectedWorkbookLoading,
    workbookPreviewController,
  };
}

function createLocalSource(sourceNumber: number): QuestionBlueprintWorkbookSource {
  return {
    sourceId: `source_${sourceNumber}`,
    name: `Source ${sourceNumber}`,
    workbookId: createLocalWorkbookId(sourceNumber),
  };
}

function createLocalWorkbookId(sourceNumber: number) {
  return `local:source_${sourceNumber}`;
}

function getNextSourceNumber(sources: QuestionBlueprintWorkbookSource[]) {
  return (
    sources.reduce((max, source) => {
      const match = source.sourceId.match(/^source_(\d+)$/u);
      if (!match) {
        return max;
      }

      return Math.max(max, Number(match[1] ?? 0));
    }, 0) + 1
  );
}
