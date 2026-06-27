import { useCallback, useEffect, useMemo, useState } from "react";
import { useCreateFileDownloadUrl } from "#/domains/files/hooks";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import {
  useCreateWorkbookCalculation,
  useWorkbookQuery,
} from "#/domains/workbooks/hooks";
import {
  type LocalWorkbookParseResult,
  parseLocalWorkbookFile,
} from "#/domains/workbooks/local-xlsx";
import type { Workbook } from "#/domains/workbooks/model";
import {
  type SelectedWorkbookPreviewController,
  useSelectedWorkbookPreview,
} from "../use-selected-workbook-preview";
import {
  buildSourceUsageBySourceId,
  getSourceRemovalState,
  type StudioSourceUsageSummary,
} from "./source-usage";
import type { StudioSource, StudioWorkbookSource } from "./studio-source-model";

export type StudioSourceOperationResult =
  | {
      status: "changed";
      sources: readonly StudioSource[];
    }
  | {
      status: "blocked";
      reason: string;
    };

export type SourceController = {
  sources: StudioSource[];
  usageBySourceId: ReadonlyMap<string, StudioSourceUsageSummary>;
  lookupSourceWorkbook: Workbook | null;
  lookupLocalWorkbook: LocalWorkbookParseResult | null;
  isLookupSourceLoading: boolean;
  isPickerOpen: boolean;
  workbookPreviewController: SelectedWorkbookPreviewController;
  actions: {
    addSource(): void;
    createSource(source: StudioWorkbookSource): void;
    reattachSource(
      sourceId: string,
      file: File,
    ): Promise<StudioSourceOperationResult>;
    removeSource(sourceId: string): StudioSourceOperationResult;
    setPickerOpen(open: boolean): void;
    replaceSources(sources: StudioSource[]): void;
  };
  getSourceById(sourceId: string): StudioSource | null;
};

const SOURCE_LOOKUP_REFETCH_INTERVAL_MS = 1_000;
const SOURCE_PREVIEW_REQUESTED_COUNT = 1;
const SAVED_SOURCE_FILE_LOAD_ERROR = "Saved source file could not be loaded.";

export function useSourceController(input: {
  draftKey?: string;
  loadWorkbookPickerPreview: boolean;
  lookupSourceId: string | null;
  model: ComposedEditorModel;
  sources: StudioSource[];
  onSourcesChange(sources: StudioSource[]): void;
}): SourceController {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [, setSourcePreparationError] = useState<string | null>(null);
  const [sourcePreparation, setSourcePreparation] = useState<{
    sourceId: string;
    calculationRequested: boolean;
  } | null>(null);
  const { mutateAsync: createWorkbookCalculationAsync } =
    useCreateWorkbookCalculation();
  const { mutateAsync: createFileDownloadUrl } = useCreateFileDownloadUrl();

  const usageBySourceId = useMemo(
    () =>
      buildSourceUsageBySourceId({
        model: input.model,
        sources: input.sources,
      }),
    [input.model, input.sources],
  );
  const lookupSource = useMemo(
    () =>
      input.lookupSourceId
        ? (input.sources.find(
            (source) => source.sourceId === input.lookupSourceId,
          ) ?? null)
        : null,
    [input.lookupSourceId, input.sources],
  );
  const lookupSourceWorkbookId =
    lookupSource?.backing.kind === "persisted_workbook"
      ? lookupSource.backing.workbookId
      : "";
  const lookupSourceWorkbookQuery = useWorkbookQuery(lookupSourceWorkbookId, {
    enabled: Boolean(lookupSourceWorkbookId),
    refetchInterval: (query) => {
      const workbook = query.state.data;
      return workbook?.status === "pending_validation"
        ? SOURCE_LOOKUP_REFETCH_INTERVAL_MS
        : false;
    },
  });
  const lookupSourceWorkbook = lookupSourceWorkbookQuery.data ?? null;
  const workbookPreviewController = useSelectedWorkbookPreview({
    loadPickerPreview: input.loadWorkbookPickerPreview,
    selectedWorkbook: lookupSourceWorkbook
      ? {
          id: lookupSourceWorkbook.id,
          originalName: lookupSourceWorkbook.originalName,
          status: lookupSourceWorkbook.status,
        }
      : null,
  });
  const localLookupSourceBacking =
    lookupSource?.backing.kind === "local_file" ? lookupSource.backing : null;
  const isLookupSourceLoading =
    localLookupSourceBacking !== null
      ? localLookupSourceBacking.parseStatus === "parsing"
      : lookupSource?.backing.kind === "draft_file"
        ? lookupSource.backing.previewStatus === "loading"
        : lookupSource?.backing.kind === "restoring_local_file"
          ? true
          : Boolean(lookupSourceWorkbookId) &&
            lookupSourceWorkbookQuery.isLoading;

  useEffect(() => {
    if (
      lookupSource?.backing.kind !== "draft_file" ||
      lookupSource.backing.previewStatus !== "idle" ||
      !input.loadWorkbookPickerPreview
    ) {
      return;
    }
    const sourceId = lookupSource.sourceId;
    input.onSourcesChange(
      input.sources.map((source) =>
        source.sourceId === sourceId && source.backing.kind === "draft_file"
          ? {
              ...source,
              backing: { ...source.backing, previewStatus: "loading" as const },
            }
          : source,
      ),
    );
    void createFileDownloadUrl({ fileId: lookupSource.backing.fileId })
      .then(async (download) => {
        const response = await fetch(download.url);
        if (!response.ok) throw new Error(SAVED_SOURCE_FILE_LOAD_ERROR);
        const blob = await response.blob();
        const file = new File([blob], lookupSource.backing.originalName, {
          type:
            blob.type ||
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const parsed = await parseLocalWorkbookFile(file);
        if (parsed.status === "failed") throw new Error(parsed.error.message);
        input.onSourcesChange(
          input.sources.map((source) =>
            source.sourceId === sourceId && source.backing.kind === "draft_file"
              ? {
                  ...source,
                  backing: {
                    ...source.backing,
                    parsedWorkbook: parsed.workbook,
                    previewError: null,
                    previewStatus: "loaded" as const,
                  },
                }
              : source,
          ),
        );
      })
      .catch((error) => {
        input.onSourcesChange(
          input.sources.map((source) =>
            source.sourceId === sourceId && source.backing.kind === "draft_file"
              ? {
                  ...source,
                  backing: {
                    ...source.backing,
                    previewError:
                      error instanceof Error
                        ? error.message
                        : SAVED_SOURCE_FILE_LOAD_ERROR,
                    previewStatus: "failed" as const,
                  },
                }
              : source,
          ),
        );
      });
  }, [createFileDownloadUrl, input, lookupSource]);

  const requestPreviewCalculation = useCallback(
    (source: StudioSource | null) => {
      if (source?.backing.kind !== "persisted_workbook") {
        return false;
      }

      if (
        sourcePreparation?.sourceId === source.sourceId &&
        sourcePreparation.calculationRequested
      ) {
        return false;
      }

      void createWorkbookCalculationAsync({
        correlationId: `studio-workbook-lookup:${source.sourceId}`,
        requestedCount: SOURCE_PREVIEW_REQUESTED_COUNT,
        workbookId: source.backing.workbookId,
      })
        .catch(() => {
          setSourcePreparationError("Source lookup could not be requested.");
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
      lookupSource?.backing.kind !== "persisted_workbook" ||
      lookupSource.sourceId !== sourcePreparation.sourceId ||
      lookupSourceWorkbook?.status === "pending_validation"
    ) {
      return;
    }

    if (lookupSourceWorkbook?.status !== "valid") {
      setSourcePreparation(null);
      return;
    }

    if (requestPreviewCalculation(lookupSource)) {
      setSourcePreparation({
        calculationRequested: true,
        sourceId: lookupSource.sourceId,
      });
      return;
    }

    setSourcePreparation(null);
  }, [
    lookupSource,
    lookupSourceWorkbook,
    requestPreviewCalculation,
    sourcePreparation,
  ]);

  useEffect(() => {
    if (
      lookupSource?.backing.kind !== "persisted_workbook" ||
      lookupSourceWorkbook?.status !== "valid" ||
      !workbookPreviewController.needsWorkbookPreviewCalculation
    ) {
      return;
    }

    requestPreviewCalculation(lookupSource);
  }, [
    lookupSource,
    lookupSourceWorkbook,
    requestPreviewCalculation,
    workbookPreviewController.needsWorkbookPreviewCalculation,
  ]);

  const createSource = useCallback(
    (source: StudioWorkbookSource) => {
      input.onSourcesChange([...input.sources, source]);
      setSourcePreparation(null);
      setSourcePreparationError(null);
      setIsPickerOpen(false);
    },
    [input],
  );

  const removeSource = useCallback(
    (sourceId: string): StudioSourceOperationResult => {
      const removalState = getSourceRemovalState({
        sourceId,
        usageBySourceId,
      });
      if (!removalState.removable) {
        return {
          reason: removalState.reason,
          status: "blocked",
        };
      }

      const nextSources = input.sources.filter(
        (source) => source.sourceId !== sourceId,
      );
      input.onSourcesChange(nextSources);
      setSourcePreparation(null);
      setSourcePreparationError(null);

      return {
        sources: nextSources,
        status: "changed",
      };
    },
    [input, usageBySourceId],
  );

  const reattachSource = useCallback(
    async (
      sourceId: string,
      file: File,
    ): Promise<StudioSourceOperationResult> => {
      const source = input.sources.find(
        (candidate) => candidate.sourceId === sourceId,
      );
      if (source?.backing.kind !== "missing_local_file") {
        return {
          reason: "Source is not waiting for a file.",
          status: "blocked",
        };
      }
      if (
        file.name !== source.backing.originalName ||
        file.size !== source.backing.byteSize
      ) {
        return {
          reason: "Choose the original workbook file for this source.",
          status: "blocked",
        };
      }

      const parseOutcome = await parseLocalWorkbookFile(file);
      const localSource: StudioSource = {
        ...source,
        backing:
          parseOutcome.status === "failed"
            ? {
                byteSize: file.size,
                file,
                kind: "local_file",
                lastModified: file.lastModified,
                originalName: file.name,
                parsedWorkbook: null,
                parseError: parseOutcome.error,
                parseStatus: "failed",
                uploadError: null,
                uploadStatus: "not_uploaded",
                workbookId: null,
              }
            : {
                byteSize: file.size,
                file,
                kind: "local_file",
                lastModified: file.lastModified,
                originalName: file.name,
                parsedWorkbook: parseOutcome.workbook,
                parseError: null,
                parseStatus: "parsed",
                uploadError: null,
                uploadStatus: "not_uploaded",
                workbookId: null,
              },
      };
      const nextSources = input.sources.map((candidate) =>
        candidate.sourceId === sourceId ? localSource : candidate,
      );
      input.onSourcesChange(nextSources);

      return {
        sources: nextSources,
        status: "changed",
      };
    },
    [input],
  );

  return {
    actions: {
      addSource: () => {
        setSourcePreparationError(null);
        setIsPickerOpen(true);
      },
      createSource,
      reattachSource,
      removeSource,
      replaceSources: input.onSourcesChange,
      setPickerOpen: setIsPickerOpen,
    },
    getSourceById: (sourceId) =>
      input.sources.find((source) => source.sourceId === sourceId) ?? null,
    isLookupSourceLoading,
    isPickerOpen,
    lookupLocalWorkbook:
      localLookupSourceBacking?.parsedWorkbook ??
      (lookupSource?.backing.kind === "draft_file"
        ? lookupSource.backing.parsedWorkbook
        : null),
    lookupSourceWorkbook,
    sources: input.sources,
    usageBySourceId,
    workbookPreviewController,
  };
}
