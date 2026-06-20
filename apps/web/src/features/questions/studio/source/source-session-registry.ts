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
  attachWorkbook(workbook: Workbook): StudioSourceSessionSource;
  removeSource(sourceId: string): void;
  getSourceById(sourceId: string): StudioSourceSessionSource | null;
  getSourceByName(sourceName: string): StudioSourceSessionSource | null;
  getWorkbookName(workbookId: string | null): string | null;
};

export function useSourceSessionRegistry(input: {
  initialSources: StudioSourceSessionSource[];
}): StudioSourceSessionRegistry {
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
      setSources((current) => [...current, source]);
      return toPublicSource(source);
    },
    [makeSource],
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

  const publicSources = useMemo(() => sources.map(toPublicSource), [sources]);

  return {
    sources: publicSources,
    attachWorkbook,
    removeSource: (sourceId) => {
      setSources((current) =>
        current.filter((source) => source.sourceId !== sourceId),
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
