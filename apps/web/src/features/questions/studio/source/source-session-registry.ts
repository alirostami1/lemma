import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Workbook } from "#/domains/workbooks/model";

export type StudioSourceSessionSource = {
  sourceId: string;
  sourceName: string;
  workbookId: string;
  workbookName: string | null;
};

type SourceRecord = StudioSourceSessionSource;

export type StudioSourceSessionRegistry = {
  sources: StudioSourceSessionSource[];
  activeSource: StudioSourceSessionSource | null;
  attachWorkbook(workbook: Workbook): StudioSourceSessionSource;
  activateSourceById(sourceId: string): void;
  removeActiveSource(): void;
  getSourceById(sourceId: string): StudioSourceSessionSource | null;
  getSourceByName(sourceName: string): StudioSourceSessionSource | null;
  getWorkbookName(workbookId: string | null): string | null;
};

export function useSourceSessionRegistry(input: {
  activeWorkbook: Workbook | null;
  initialSources: StudioSourceSessionSource[];
  selectedWorkbookId: string | null;
  onSelectedWorkbookIdChange(workbookId: string | null): void;
}): StudioSourceSessionRegistry {
  const {
    activeWorkbook,
    initialSources,
    onSelectedWorkbookIdChange,
    selectedWorkbookId,
  } = input;
  const nextSourceNumberRef = useRef(1);
  const [sources, setSources] = useState<SourceRecord[]>([]);

  const makeSource = useCallback((workbook: Workbook): SourceRecord => {
    const sourceNumber = nextSourceNumberRef.current;
    nextSourceNumberRef.current += 1;
    return {
      sourceId: `source_${sourceNumber}`,
      sourceName: `Source ${sourceNumber}`,
      workbookId: workbook.id,
      workbookName: workbook.name,
    };
  }, []);

  const attachWorkbook = useCallback(
    (workbook: Workbook) => {
      const source = makeSource(workbook);
      setSources((current) => [
        ...current.filter((item) => item.workbookId !== workbook.id),
        source,
      ]);
      onSelectedWorkbookIdChange(workbook.id);
      return toPublicSource(source);
    },
    [makeSource, onSelectedWorkbookIdChange],
  );

  useEffect(() => {
    setSources((current) => {
      const newSources = initialSources.filter(
        (source) => !current.some((item) => item.sourceId === source.sourceId),
      );
      if (newSources.length === 0) {
        return current;
      }
      const maxSourceNumber = Math.max(
        0,
        ...newSources
          .map((source) => source.sourceId.match(/^source_(\d+)$/u)?.[1])
          .filter((value): value is string => value !== undefined)
          .map(Number),
      );
      nextSourceNumberRef.current = Math.max(
        nextSourceNumberRef.current,
        maxSourceNumber + 1,
      );
      return [...current, ...newSources.map(toRecordSource)];
    });
  }, [initialSources]);

  useEffect(() => {
    if (!selectedWorkbookId || !activeWorkbook) {
      return;
    }

    setSources((current) => {
      const existing = current.find(
        (source) => source.workbookId === selectedWorkbookId,
      );
      if (!existing) {
        return [...current, makeSource(activeWorkbook)];
      }

      if (existing.workbookName === activeWorkbook.name) {
        return current;
      }

      return current.map((source) =>
        source.sourceId === existing.sourceId
          ? { ...source, workbookName: activeWorkbook.name }
          : source,
      );
    });
  }, [activeWorkbook, selectedWorkbookId, makeSource]);

  const publicSources = useMemo(() => sources.map(toPublicSource), [sources]);
  const activeSource = useMemo(() => {
    const source =
      publicSources.find((item) => item.workbookId === selectedWorkbookId) ??
      null;
    return source;
  }, [publicSources, selectedWorkbookId]);

  return {
    sources: publicSources,
    activeSource,
    attachWorkbook,
    activateSourceById: (sourceId) => {
      const source = sources.find((item) => item.sourceId === sourceId);
      if (source) {
        onSelectedWorkbookIdChange(source.workbookId);
      }
    },
    removeActiveSource: () => {
      const activeWorkbookId = selectedWorkbookId;
      const remaining = activeWorkbookId
        ? sources.filter((source) => source.workbookId !== activeWorkbookId)
        : sources;
      setSources(remaining);
      onSelectedWorkbookIdChange(
        remaining[remaining.length - 1]?.workbookId ?? null,
      );
    },
    getSourceById: (sourceId) =>
      publicSources.find((source) => source.sourceId === sourceId) ?? null,
    getSourceByName: (sourceName) =>
      publicSources.find((source) => source.sourceName === sourceName) ?? null,
    getWorkbookName: (workbookId) =>
      publicSources.find((source) => source.workbookId === workbookId)
        ?.workbookName ?? null,
  };
}

function toPublicSource(source: SourceRecord): StudioSourceSessionSource {
  return {
    sourceId: source.sourceId,
    sourceName: source.sourceName,
    workbookId: source.workbookId,
    workbookName: source.workbookName,
  };
}

function toRecordSource(source: StudioSourceSessionSource): SourceRecord {
  return {
    sourceId: source.sourceId,
    sourceName: source.sourceName,
    workbookId: source.workbookId,
    workbookName: source.workbookName,
  };
}
