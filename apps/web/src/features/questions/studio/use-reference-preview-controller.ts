import { useMemo } from "react";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import {
  createWorkbookSelectionCacheKey,
  type ReferencePreviewCache,
  resolveReferencePreviewValues,
  type WorkbookSelectionValuesBySourceAndRef,
} from "#/domains/questions/reference-preview";
import { normalizeWorkbookRef } from "#/domains/questions/workbook-reference";
import {
  getLocalWorkbookCell,
  getLocalWorkbookRange,
  type LocalWorkbookCellValue,
  type LocalWorkbookParseResult,
} from "#/domains/workbooks/local-xlsx";
import type { StudioSource } from "./source/studio-source-model";

export type ReferencePreviewController = {
  referencePreviewCache: ReferencePreviewCache;
};

type UseReferencePreviewControllerInput = {
  model: ComposedEditorModel;
  sources: readonly StudioSource[];
  workbookSelectionValuesBySourceAndRef?: WorkbookSelectionValuesBySourceAndRef;
};

export function useReferencePreviewController({
  model,
  sources,
  workbookSelectionValuesBySourceAndRef,
}: UseReferencePreviewControllerInput): ReferencePreviewController {
  const localWorkbookBySourceId = useMemo(() => {
    const entries: Array<readonly [string, LocalWorkbookParseResult]> = [];

    for (const source of sources) {
      const parsedWorkbook = getParsedWorkbook(source);
      if (parsedWorkbook) {
        entries.push([source.sourceId, parsedWorkbook] as const);
      }
    }

    return new Map<string, LocalWorkbookParseResult>(entries);
  }, [sources]);

  const fetchedWorkbookSelectionValuesBySourceAndRef = useMemo(() => {
    const valuesByRef: WorkbookSelectionValuesBySourceAndRef = {};

    for (const reference of model.references) {
      if (
        reference.source.type !== "workbook_cell" &&
        reference.source.type !== "workbook_range"
      ) {
        continue;
      }

      const workbook = localWorkbookBySourceId.get(reference.source.sourceId);
      if (!workbook) {
        continue;
      }

      const rangeValues = getLocalWorkbookRange(workbook, reference.source.ref);
      if (rangeValues.length > 0) {
        const rows = mapLocalRangeToRows(rangeValues);
        assignWorkbookSelectionValues(
          valuesByRef,
          reference.source.sourceId,
          reference.source.ref,
          rows,
        );
        continue;
      }

      const cellValue = getLocalWorkbookCell(workbook, reference.source.ref);
      if (!cellValue) {
        continue;
      }

      assignWorkbookSelectionValues(
        valuesByRef,
        reference.source.sourceId,
        reference.source.ref,
        [[cellValue.displayValue]],
      );
    }

    return valuesByRef;
  }, [localWorkbookBySourceId, model.references]);

  const referencePreviewCache = useMemo(
    () =>
      resolveReferencePreviewValues({
        model,
        workbookSelectionValuesBySourceAndRef: {
          ...fetchedWorkbookSelectionValuesBySourceAndRef,
          ...workbookSelectionValuesBySourceAndRef,
        },
      }),
    [
      fetchedWorkbookSelectionValuesBySourceAndRef,
      model,
      workbookSelectionValuesBySourceAndRef,
    ],
  );

  return {
    referencePreviewCache,
  };
}

function getParsedWorkbook(
  source: StudioSource,
): LocalWorkbookParseResult | null {
  return "parsedWorkbook" in source.backing
    ? source.backing.parsedWorkbook
    : null;
}

function assignWorkbookSelectionValues(
  valuesByRef: WorkbookSelectionValuesBySourceAndRef,
  sourceId: string,
  ref: string,
  rows: string[][],
): void {
  valuesByRef[createWorkbookSelectionCacheKey(sourceId, ref)] = rows;

  const normalizedRef = normalizeWorkbookRef(ref);
  if (normalizedRef) {
    valuesByRef[createWorkbookSelectionCacheKey(sourceId, normalizedRef)] =
      rows;
  }
}

function mapLocalRangeToRows(
  values: readonly LocalWorkbookCellValue[],
): string[][] {
  const rowsBySheetAndRow = new Map<string, string[]>();

  for (const value of values) {
    const rowKey = `${value.sheetName}:${value.address.replace(/[A-Z]+/u, "")}`;
    const row = rowsBySheetAndRow.get(rowKey) ?? [];
    row.push(value.displayValue);
    rowsBySheetAndRow.set(rowKey, row);
  }

  return [...rowsBySheetAndRow.values()];
}
