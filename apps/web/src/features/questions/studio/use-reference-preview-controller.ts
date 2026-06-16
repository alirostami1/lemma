import { useMemo } from "react";
import type { ComposedEditorModel } from "#/domains/questions/authoring";
import {
  resolveReferencePreviewValues,
  type ReferencePreviewCache,
} from "#/domains/questions/reference-preview";
import type { WorkbookPreview } from "#/domains/questions/workbook-preview";

export type ReferencePreviewController = {
  referencePreviewCache: ReferencePreviewCache;
};

type UseReferencePreviewControllerInput = {
  model: ComposedEditorModel;
  workbookPreview: WorkbookPreview | null;
};

export function useReferencePreviewController({
  model,
  workbookPreview,
}: UseReferencePreviewControllerInput): ReferencePreviewController {
  const referencePreviewCache = useMemo(
    () =>
      resolveReferencePreviewValues({
        model,
        workbookPreview,
      }),
    [model, workbookPreview],
  );

  return {
    referencePreviewCache,
  };
}
