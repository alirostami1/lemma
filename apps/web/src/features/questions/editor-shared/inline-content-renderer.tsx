import type {
  ComposedInlineContent,
  ComposedReferenceDraft,
  ComposedRenderedInlineContent,
} from "#/domains/questions/authoring";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import { resolveInlineReferencePreview } from "#/domains/questions/reference-preview";
import { ReferenceChip } from "./reference-chip";
import { getReferenceChipLabel } from "./reference-display";

export type InlineRenderMode = "editing" | "preview";

export function InlineContentRenderer({
  content,
  mode,
  referencePreviewValues,
  references = [],
  onSelectReference,
}: {
  content: Array<ComposedInlineContent | ComposedRenderedInlineContent>;
  mode: InlineRenderMode;
  referencePreviewValues: ReferencePreviewCache;
  references?: readonly ComposedReferenceDraft[];
  onSelectReference?: (referenceId: string) => void;
}) {
  return (
    <>
      {content.map((item, index) => {
        if (item.type === "text") {
          return <span key={`text-${index}`}>{item.text}</span>;
        }

        if (item.type === "value") {
          return (
            <span key={`value-${item.referenceId}-${index}`}>
              {item.displayValue}
            </span>
          );
        }

        const previewValue = resolveInlineReferencePreview({
          fallbackText: item.fallbackText,
          rangeCell: item.rangeCell,
          referenceId: item.referenceId,
          referencePreviewCache: referencePreviewValues,
        });
        const reference =
          references.find((candidate) => candidate.id === item.referenceId) ??
          null;
        const chipLabel = getReferenceChipLabel({
          preview: previewValue,
          reference,
        });
        if (mode === "editing") {
          return (
            <ReferenceChip
              key={`reference-${item.referenceId}-${index}`}
              label={chipLabel}
              onSelect={onSelectReference}
              referenceId={item.referenceId}
              status={previewValue.status}
            />
          );
        }

        if (previewValue.status === "resolved") {
          return (
            <span key={`reference-${item.referenceId}-${index}`}>
              {previewValue.displayValue}
            </span>
          );
        }

        return (
          <ReferenceChip
            key={`reference-${item.referenceId}-${index}`}
            label={chipLabel}
            onSelect={onSelectReference}
            referenceId={item.referenceId}
            status={previewValue.status}
          />
        );
      })}
    </>
  );
}
