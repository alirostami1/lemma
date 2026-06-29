import { Fragment } from "react";
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

type InlineContent = Array<
  ComposedInlineContent | ComposedRenderedInlineContent
>;

export type InlineContentPreviewRenderProps = {
  content: InlineContent;
  mode: "preview";
  referencePreviewValues: ReferencePreviewCache;
  onSelectReference?: never;
  references?: never;
};

export type InlineContentEditingRenderProps = {
  content: InlineContent;
  mode: "editing";
  referencePreviewValues: ReferencePreviewCache;
  references?: readonly ComposedReferenceDraft[];
  onSelectReference?: (referenceId: string) => void;
};

export type InlineContentRendererProps =
  | InlineContentPreviewRenderProps
  | InlineContentEditingRenderProps;

export function InlineContentRenderer(props: InlineContentRendererProps) {
  return (
    <>
      {props.content.map((item, index) => {
        if (item.type === "text") {
          return <Fragment key={`text-${index}`}>{item.text}</Fragment>;
        }

        if (item.type === "value") {
          return (
            <Fragment key={`value-${item.referenceId}-${index}`}>
              {item.displayValue}
            </Fragment>
          );
        }

        const previewValue = resolveInlineReferencePreview({
          fallbackText: item.fallbackText,
          rangeCell: item.rangeCell,
          referenceId: item.referenceId,
          referencePreviewCache: props.referencePreviewValues,
        });

        if (props.mode === "editing") {
          const reference =
            props.references?.find(
              (candidate) => candidate.id === item.referenceId,
            ) ?? null;
          const chipLabel = getReferenceChipLabel({
            preview: previewValue,
            reference,
          });

          return (
            <ReferenceChip
              key={`reference-${item.referenceId}-${index}`}
              label={chipLabel}
              onSelect={props.onSelectReference}
              referenceId={item.referenceId}
              status={previewValue.status}
            />
          );
        }

        return (
          <Fragment key={`reference-${item.referenceId}-${index}`}>
            {previewValue.displayValue}
          </Fragment>
        );
      })}
    </>
  );
}
