import type {
  ComposedInlineContent,
  ComposedRenderedInlineContent,
} from "#/domains/questions/authoring";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import {
  formatReferenceFallback,
  resolveInlineReferencePreview,
} from "#/domains/questions/reference-preview";
import { ReferenceChip } from "./reference-chip";

export type InlineRenderMode = "editing" | "preview";

export function InlineContentRenderer({
  content,
  mode,
  referencePreviewValues,
  onSelectReference,
}: {
  content: Array<ComposedInlineContent | ComposedRenderedInlineContent>;
  mode: InlineRenderMode;
  referencePreviewValues: ReferencePreviewCache;
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
        const fallbackLabel = formatReferenceFallback(
          item.referenceId,
          item.rangeCell,
        );

        if (mode === "editing") {
          return (
            <ReferenceChip
              key={`reference-${item.referenceId}-${index}`}
              label={fallbackLabel}
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
            label={previewValue.displayValue}
            onSelect={onSelectReference}
            referenceId={item.referenceId}
            status={previewValue.status}
          />
        );
      })}
    </>
  );
}
