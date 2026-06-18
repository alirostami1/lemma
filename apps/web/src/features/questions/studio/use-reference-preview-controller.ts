import { useMemo } from "react";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import {
  type ReferencePreviewCache,
  resolveReferencePreviewValues,
  type WorkbookSelectionValuesByRef,
} from "#/domains/questions/reference-preview";
import type { WorkbookPreview } from "#/domains/questions/workbook-preview";
import { useWorkbookSnapshotRangesQuery } from "#/domains/workbooks/hooks";

export type ReferencePreviewController = {
  referencePreviewCache: ReferencePreviewCache;
};

type UseReferencePreviewControllerInput = {
  model: ComposedEditorModel;
  workbookSnapshotId?: string | null;
  workbookSelectionValuesByRef?: WorkbookSelectionValuesByRef;
  workbookPreview: WorkbookPreview | null;
};

export function useReferencePreviewController({
  model,
  workbookSnapshotId,
  workbookSelectionValuesByRef,
  workbookPreview,
}: UseReferencePreviewControllerInput): ReferencePreviewController {
  const workbookReferenceRefs = useMemo(
    () => getWorkbookReferenceRefs(model),
    [model],
  );
  const missingWorkbookReferenceRefs = useMemo(
    () =>
      workbookReferenceRefs.filter(
        (ref) => !Object.hasOwn(workbookSelectionValuesByRef ?? {}, ref),
      ),
    [workbookReferenceRefs, workbookSelectionValuesByRef],
  );
  const workbookReferenceQueries = useWorkbookSnapshotRangesQuery(
    missingWorkbookReferenceRefs.map((ref) => ({
      workbookSnapshotId: workbookSnapshotId ?? "",
      ref,
    })),
    {
      enabled: Boolean(workbookSnapshotId),
    },
  );
  const fetchedWorkbookSelectionValuesByRef = useMemo(() => {
    const valuesByRef: WorkbookSelectionValuesByRef = {};

    for (const [index, query] of workbookReferenceQueries.entries()) {
      const ref = missingWorkbookReferenceRefs[index];
      if (!ref || !query.data) {
        continue;
      }

      valuesByRef[ref] = query.data.rows;
      valuesByRef[query.data.ref] = query.data.rows;
    }

    return valuesByRef;
  }, [workbookReferenceQueries, missingWorkbookReferenceRefs]);
  const referencePreviewCache = useMemo(
    () =>
      resolveReferencePreviewValues({
        model,
        workbookSelectionValuesByRef: {
          ...fetchedWorkbookSelectionValuesByRef,
          ...workbookSelectionValuesByRef,
        },
        workbookPreview,
      }),
    [
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

function getWorkbookReferenceRefs(model: ComposedEditorModel) {
  return Array.from(
    new Set(
      model.references.flatMap((reference) =>
        reference.source.type === "workbook_cell" ||
        reference.source.type === "workbook_range"
          ? [reference.source.ref]
          : [],
      ),
    ),
  );
}
