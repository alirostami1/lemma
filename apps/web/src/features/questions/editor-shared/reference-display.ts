import type { ComposedReferenceDraft } from "#/domains/questions/authoring";
import { getWorkbookReferenceDisplayName } from "#/domains/questions/reference-names";
import type { ReferencePreviewValue } from "#/domains/questions/reference-preview";

const maxPreviewLabelLength = 48;

export function getReferenceChipLabel({
  preview,
  reference,
}: {
  preview?: ReferencePreviewValue;
  reference?: ComposedReferenceDraft | null;
}) {
  const label = reference?.label?.trim();
  if (label) {
    return label;
  }

  const previewLabel = preview?.displayValue.trim();
  if (
    preview?.status === "resolved" &&
    previewLabel &&
    previewLabel.length <= maxPreviewLabelLength
  ) {
    return previewLabel;
  }

  if (
    reference?.source.type === "workbook_cell" ||
    reference?.source.type === "workbook_range"
  ) {
    return getWorkbookReferenceDisplayName(reference.source);
  }

  if (preview?.status && preview.status !== "resolved") {
    return "Added value unavailable";
  }

  return "Added value";
}
