import { useMemo } from "react";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import {
  type ReferencePreviewCache,
  resolveReferencePreviewValues,
  type WorkbookSelectionValuesByRef,
} from "#/domains/questions/reference-preview";
import type { WorkbookPreview } from "#/domains/questions/workbook-preview";
import { useWorkbookSnapshotRangeBatchQuery } from "#/domains/workbooks/hooks";

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
  const workbookReferenceQuery = useWorkbookSnapshotRangeBatchQuery(
    {
      workbookSnapshotId: workbookSnapshotId ?? "",
      refs: missingWorkbookReferenceRefs,
    },
    {
      enabled: Boolean(workbookSnapshotId),
    },
  );
  const fetchedWorkbookSelectionValuesByRef = useMemo(() => {
    const valuesByRef: WorkbookSelectionValuesByRef = {};

    for (const item of workbookReferenceQuery.data?.ranges ?? []) {
      if (item.status !== "ok") {
        continue;
      }

      valuesByRef[item.ref] = item.range.rows;
      valuesByRef[item.range.ref] = item.range.rows;
    }

    return valuesByRef;
  }, [workbookReferenceQuery.data]);
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
