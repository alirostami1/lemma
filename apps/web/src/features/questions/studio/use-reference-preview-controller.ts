import { useMemo } from "react";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import {
  type ReferencePreviewCache,
  resolveReferencePreviewValues,
  type WorkbookSelectionValuesByRef,
} from "#/domains/questions/reference-preview";
import type { WorkbookPreview } from "#/domains/questions/workbook-preview";
import { normalizeWorkbookRef } from "#/domains/questions/workbook-reference";
import {
  useWorkbookSnapshotRangeBatchQueries,
  WORKBOOK_SNAPSHOT_RANGE_BATCH_REF_LIMIT,
} from "#/domains/workbooks/hooks";

export type ReferencePreviewController = {
  referencePreviewCache: ReferencePreviewCache;
};

type UseReferencePreviewControllerInput = {
  model: ComposedEditorModel;
  activeSourceId?: string | null;
  workbookSnapshotId?: string | null;
  workbookSelectionValuesByRef?: WorkbookSelectionValuesByRef;
  workbookPreview: WorkbookPreview | null;
};

export function useReferencePreviewController({
  model,
  activeSourceId,
  workbookSnapshotId,
  workbookSelectionValuesByRef,
  workbookPreview,
}: UseReferencePreviewControllerInput): ReferencePreviewController {
  const workbookReferenceRefs = useMemo(
    () => getWorkbookReferenceRefs(model, activeSourceId ?? null),
    [activeSourceId, model],
  );
  const missingWorkbookReferenceRefs = useMemo(() => {
    const missingRefs = new Set<string>();

    for (const { ref, normalizedRef } of workbookReferenceRefs) {
      if (
        hasWorkbookSelectionValue(workbookSelectionValuesByRef, ref) ||
        hasWorkbookSelectionValue(workbookSelectionValuesByRef, normalizedRef)
      ) {
        continue;
      }

      missingRefs.add(normalizedRef);
    }

    return Array.from(missingRefs);
  }, [workbookReferenceRefs, workbookSelectionValuesByRef]);
  const workbookReferenceRefBatches = useMemo(
    () =>
      chunkArray(
        missingWorkbookReferenceRefs,
        WORKBOOK_SNAPSHOT_RANGE_BATCH_REF_LIMIT,
      ),
    [missingWorkbookReferenceRefs],
  );
  const workbookReferenceBatchInputs = useMemo(
    () =>
      workbookReferenceRefBatches.map((refs) => ({
        workbookSnapshotId: workbookSnapshotId ?? "",
        refs,
      })),
    [workbookReferenceRefBatches, workbookSnapshotId],
  );
  const workbookReferenceRangeBatch = useWorkbookSnapshotRangeBatchQueries(
    workbookReferenceBatchInputs,
    {
      enabled: Boolean(workbookSnapshotId),
    },
  );
  const fetchedWorkbookSelectionValuesByRef = useMemo(() => {
    const valuesByRef: WorkbookSelectionValuesByRef = {};

    for (const item of workbookReferenceRangeBatch.ranges) {
      if (item.status !== "ok") {
        continue;
      }

      valuesByRef[item.ref] = item.range.rows;
      valuesByRef[item.range.ref] = item.range.rows;

      const normalizedRef =
        normalizeWorkbookRef(item.range.ref) ?? normalizeWorkbookRef(item.ref);
      if (normalizedRef) {
        valuesByRef[normalizedRef] = item.range.rows;

        for (const referenceRef of workbookReferenceRefs) {
          if (referenceRef.normalizedRef === normalizedRef) {
            valuesByRef[referenceRef.ref] = item.range.rows;
          }
        }
      }
    }

    return valuesByRef;
  }, [workbookReferenceRangeBatch.ranges, workbookReferenceRefs]);
  const referencePreviewCache = useMemo(
    () =>
      resolveReferencePreviewValues({
        model,
        activeSourceId: activeSourceId ?? null,
        workbookSelectionValuesByRef: {
          ...fetchedWorkbookSelectionValuesByRef,
          ...workbookSelectionValuesByRef,
        },
        workbookPreview,
      }),
    [
      activeSourceId,
      fetchedWorkbookSelectionValuesByRef,
      model,
      workbookSelectionValuesByRef,
      workbookPreview,
    ],
  );

  return {
    referencePreviewCache,
  };
}

type WorkbookReferenceRef = {
  ref: string;
  normalizedRef: string;
};

function getWorkbookReferenceRefs(
  model: ComposedEditorModel,
  activeSourceId: string | null,
) {
  const refsByOriginalRef = new Map<string, WorkbookReferenceRef>();

  for (const reference of model.references) {
    if (
      reference.source.type !== "workbook_cell" &&
      reference.source.type !== "workbook_range"
    ) {
      continue;
    }
    if (
      activeSourceId !== null &&
      reference.source.sourceId !== activeSourceId
    ) {
      continue;
    }

    const ref = reference.source.ref;
    if (!refsByOriginalRef.has(ref)) {
      refsByOriginalRef.set(ref, {
        ref,
        normalizedRef: normalizeWorkbookRef(ref) ?? ref,
      });
    }
  }

  return Array.from(refsByOriginalRef.values());
}

function hasWorkbookSelectionValue(
  valuesByRef: WorkbookSelectionValuesByRef | undefined,
  ref: string,
) {
  return Object.hasOwn(valuesByRef ?? {}, ref);
}

function chunkArray<TValue>(items: TValue[], chunkSize: number) {
  const chunks: TValue[][] = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
}
