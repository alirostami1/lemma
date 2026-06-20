import { useMemo } from "react";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import {
  type ReferencePreviewCache,
  createWorkbookSelectionCacheKey,
  resolveReferencePreviewValues,
  type WorkbookSelectionValuesBySourceAndRef,
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
  previewSourceId: string | null;
  workbookSnapshotId?: string | null;
  workbookSelectionValuesBySourceAndRef?: WorkbookSelectionValuesBySourceAndRef;
  workbookPreview: WorkbookPreview | null;
};

export function useReferencePreviewController({
  model,
  previewSourceId,
  workbookSnapshotId,
  workbookSelectionValuesBySourceAndRef,
  workbookPreview,
}: UseReferencePreviewControllerInput): ReferencePreviewController {
  const workbookReferenceRefs = useMemo(
    () => getWorkbookReferenceRefs(model, previewSourceId),
    [model, previewSourceId],
  );
  const missingWorkbookReferenceRefs = useMemo(() => {
    const missingRefs = new Set<string>();

    for (const { ref, normalizedRef } of workbookReferenceRefs) {
      if (
        hasWorkbookSelectionValue(
          workbookSelectionValuesBySourceAndRef,
          createWorkbookSelectionCacheKey(
            previewSourceId ?? "",
            ref,
          ),
        ) ||
        hasWorkbookSelectionValue(
          workbookSelectionValuesBySourceAndRef,
          createWorkbookSelectionCacheKey(
            previewSourceId ?? "",
            normalizedRef,
          ),
        )
      ) {
        continue;
      }

      missingRefs.add(normalizedRef);
    }

    return Array.from(missingRefs);
  }, [
    previewSourceId,
    workbookReferenceRefs,
    workbookSelectionValuesBySourceAndRef,
  ]);
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
  const fetchedWorkbookSelectionValuesBySourceAndRef = useMemo(() => {
    const valuesByRef: WorkbookSelectionValuesBySourceAndRef = {};

    for (const item of workbookReferenceRangeBatch.ranges) {
      if (item.status !== "ok") {
        continue;
      }

      valuesByRef[createWorkbookSelectionCacheKey(previewSourceId ?? "", item.ref)] =
        item.range.rows;
      valuesByRef[
        createWorkbookSelectionCacheKey(previewSourceId ?? "", item.range.ref)
      ] = item.range.rows;

      const normalizedRef =
        normalizeWorkbookRef(item.range.ref) ?? normalizeWorkbookRef(item.ref);
      if (normalizedRef) {
        valuesByRef[
          createWorkbookSelectionCacheKey(previewSourceId ?? "", normalizedRef)
        ] = item.range.rows;

        for (const referenceRef of workbookReferenceRefs) {
          if (referenceRef.normalizedRef === normalizedRef) {
            valuesByRef[
              createWorkbookSelectionCacheKey(
                previewSourceId ?? "",
                referenceRef.ref,
              )
            ] = item.range.rows;
          }
        }
      }
    }

    return valuesByRef;
  }, [previewSourceId, workbookReferenceRangeBatch.ranges, workbookReferenceRefs]);
  const referencePreviewCache = useMemo(
    () =>
      resolveReferencePreviewValues({
        model,
        previewSourceId,
        workbookSelectionValuesBySourceAndRef: {
          ...fetchedWorkbookSelectionValuesBySourceAndRef,
          ...workbookSelectionValuesBySourceAndRef,
        },
        workbookPreview,
      }),
    [
      fetchedWorkbookSelectionValuesBySourceAndRef,
      model,
      previewSourceId,
      workbookSelectionValuesBySourceAndRef,
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
  previewSourceId: string | null,
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
      previewSourceId !== null &&
      reference.source.sourceId !== previewSourceId
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
  valuesByRef: WorkbookSelectionValuesBySourceAndRef | undefined,
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
