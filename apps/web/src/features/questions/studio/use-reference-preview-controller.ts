import { useMemo } from "react";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import {
  type ReferencePreviewCache,
  resolveReferencePreviewValues,
  type WorkbookSelectionValuesByRef,
} from "#/domains/questions/reference-preview";
import type { WorkbookPreview } from "#/domains/questions/workbook-preview";
import { normalizeWorkbookRef } from "#/domains/questions/workbook-reference";
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
  }, [workbookReferenceQuery.data, workbookReferenceRefs]);
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

type WorkbookReferenceRef = {
  ref: string;
  normalizedRef: string;
};

function getWorkbookReferenceRefs(model: ComposedEditorModel) {
  const refsByOriginalRef = new Map<string, WorkbookReferenceRef>();

  for (const reference of model.references) {
    if (
      reference.source.type !== "workbook_cell" &&
      reference.source.type !== "workbook_range"
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
