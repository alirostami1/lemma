import { useMemo } from "react";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import {
  type ReferencePreviewCache,
  resolveReferencePreviewValues,
  type WorkbookSelectionValuesByRef,
} from "#/domains/questions/reference-preview";
import type { WorkbookPreview } from "#/domains/questions/workbook-preview";

export type ReferencePreviewController = {
  referencePreviewCache: ReferencePreviewCache;
};

type UseReferencePreviewControllerInput = {
  model: ComposedEditorModel;
  workbookSelectionValuesByRef?: WorkbookSelectionValuesByRef;
  workbookPreview: WorkbookPreview | null;
};

export function useReferencePreviewController({
  model,
  workbookSelectionValuesByRef,
  workbookPreview,
}: UseReferencePreviewControllerInput): ReferencePreviewController {
  const referencePreviewCache = useMemo(
    () =>
      resolveReferencePreviewValues({
        model,
        workbookSelectionValuesByRef,
        workbookPreview,
      }),
    [model, workbookSelectionValuesByRef, workbookPreview],
  );

  return {
    referencePreviewCache,
  };
}
