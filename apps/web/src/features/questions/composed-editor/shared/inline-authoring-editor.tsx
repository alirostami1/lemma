import { Textarea } from "@lemma/ui/components/textarea";
import type {
  ComposedEditorModel,
  ComposedInlineContent,
} from "#/domains/questions/authoring";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import { InlineContentRenderer } from "../inline-content-renderer";
import type { InlineInsertionTarget } from "../reference-insertion-controller";

type InlineAuthoringSlot =
  | {
      type: "text";
      index: number;
    }
  | {
      type: "virtual_text";
      index: number;
    }
  | {
      type: "reference";
      index: number;
      item: Extract<ComposedInlineContent, { type: "reference" }>;
    };

export function InlineAuthoringEditor({
  content,
  disabled,
  references,
  referencePreviewCache,
  onChange,
  onInsertionTargetChange,
  onSelectReference,
}: {
  content: ComposedInlineContent[];
  disabled?: boolean;
  references: ComposedEditorModel["references"];
  referencePreviewCache: ReferencePreviewCache;
  onChange(content: ComposedInlineContent[]): void;
  onInsertionTargetChange(target: InlineInsertionTarget): void;
  onSelectReference(referenceId: string): void;
}) {
  const slots = createInlineAuthoringSlots(content);

  return (
    <div className="grid gap-2">
      {slots.map((slot, slotIndex) => {
        if (slot.type === "text") {
          const item = content[slot.index];
          const text = item?.type === "text" ? item.text : "";

          return (
            <InlineTextSegmentEditor
              disabled={disabled}
              key={`text-slot-${slot.index}`}
              label={`Text segment ${slotIndex + 1}`}
              onChange={(text, selection) => {
                const nextContent = [...content];
                if (text.length > 0) {
                  nextContent[slot.index] = { text, type: "text" };
                  onInsertionTargetChange({
                    ...selection,
                    index: slot.index,
                    type: "text",
                  });
                } else {
                  nextContent.splice(slot.index, 1);
                  onInsertionTargetChange({
                    index: slot.index,
                    type: "slot",
                  });
                }
                onChange(nextContent);
              }}
              onInsertionTargetChange={(selection) =>
                onInsertionTargetChange({
                  ...selection,
                  index: slot.index,
                  type: "text",
                })
              }
              placeholder={
                slotIndex === 0 ? "Write text..." : "Continue text..."
              }
              text={text}
            />
          );
        }

        if (slot.type === "virtual_text") {
          return (
            <InlineTextSegmentEditor
              disabled={disabled}
              key={`text-slot-${slot.index}`}
              label={`Text segment ${slotIndex + 1}`}
              onChange={(text, selection) => {
                if (text.length === 0) {
                  onInsertionTargetChange({
                    index: slot.index,
                    type: "slot",
                  });
                  return;
                }

                onInsertionTargetChange({
                  ...selection,
                  index: slot.index,
                  type: "text",
                });
                onChange([
                  ...content.slice(0, slot.index),
                  { text, type: "text" },
                  ...content.slice(slot.index),
                ]);
              }}
              onInsertionTargetChange={() =>
                onInsertionTargetChange({
                  index: slot.index,
                  type: "slot",
                })
              }
              placeholder={
                slotIndex === 0 ? "Write text..." : "Continue text..."
              }
              text=""
            />
          );
        }

        return (
          <div
            className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 p-2 text-sm"
            key={`reference-${slot.item.referenceId}-${slot.index}`}
          >
            <InlineContentRenderer
              content={[slot.item]}
              mode="editing"
              onSelectReference={onSelectReference}
              referencePreviewValues={referencePreviewCache}
              references={references}
            />
          </div>
        );
      })}
    </div>
  );
}

function createInlineAuthoringSlots(
  content: ComposedInlineContent[],
): InlineAuthoringSlot[] {
  if (content.length === 0) {
    return [{ index: 0, type: "virtual_text" }];
  }

  const slots: InlineAuthoringSlot[] = [];
  for (let index = 0; index <= content.length; index += 1) {
    if (shouldRenderVirtualTextSlot(content, index)) {
      slots.push({ index, type: "virtual_text" });
    }

    const item = content[index];
    if (!item) {
      continue;
    }

    if (item.type === "text") {
      slots.push({ index, type: "text" });
    } else {
      slots.push({ index, item, type: "reference" });
    }
  }

  return slots;
}

function shouldRenderVirtualTextSlot(
  content: ComposedInlineContent[],
  index: number,
) {
  if (content.length === 0) {
    return true;
  }

  const previous = index > 0 ? content[index - 1] : undefined;
  const next = index < content.length ? content[index] : undefined;

  if (!previous && next?.type === "reference") {
    return true;
  }
  if (previous?.type === "reference" && !next) {
    return true;
  }
  return previous?.type === "reference" && next?.type === "reference";
}

function InlineTextSegmentEditor({
  disabled,
  label,
  placeholder,
  text,
  onChange,
  onInsertionTargetChange,
}: {
  disabled?: boolean;
  label: string;
  placeholder: string;
  text: string;
  onChange(text: string, selection: { start: number; end: number }): void;
  onInsertionTargetChange(selection: { start: number; end: number }): void;
}) {
  function updateInsertionTarget(element: HTMLTextAreaElement) {
    const selection = {
      end: element.selectionEnd,
      start: element.selectionStart,
    };
    onInsertionTargetChange(selection);
    return selection;
  }

  return (
    <Textarea
      aria-label={label}
      className="min-h-20 resize-y"
      disabled={disabled}
      onBlur={(event) => updateInsertionTarget(event.currentTarget)}
      onChange={(event) => {
        const selection = updateInsertionTarget(event.currentTarget);
        onChange(event.currentTarget.value, selection);
      }}
      onClick={(event) => updateInsertionTarget(event.currentTarget)}
      onContextMenu={(event) => updateInsertionTarget(event.currentTarget)}
      onKeyUp={(event) => updateInsertionTarget(event.currentTarget)}
      onSelect={(event) => updateInsertionTarget(event.currentTarget)}
      placeholder={placeholder}
      value={text}
    />
  );
}
