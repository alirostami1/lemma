import { Button } from "@lemma/ui/components/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@lemma/ui/components/context-menu";
import { FieldGroup } from "@lemma/ui/components/field";
import { Textarea } from "@lemma/ui/components/textarea";
import { useMemo, useRef, useState } from "react";
import type {
  ComposedEditorModel,
  ComposedInlineContent,
} from "#/domains/questions/authoring";
import {
  formatInlineBlueprint,
  parseInlineBlueprint,
} from "#/domains/questions/authoring";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import { InlineContentRenderer } from "../inline-content-renderer";
import { ReferencePickerPopover } from "../inspector/reference-picker-popover";
import { insertReferenceSyntaxAtSelection } from "../reference-insertion-controller";

type TextAuthoringContentProps = {
  content: ComposedInlineContent[];
  referencePreviewCache: ReferencePreviewCache;
  model: ComposedEditorModel;
  workbookEnabled: boolean;
  disabled?: boolean;
  onChange(content: ComposedInlineContent[]): void;
  onModelChange(model: ComposedEditorModel): void;
  onSelectReference(referenceId: string): void;
  onCreatedReference?(input: {
    nextModel: ComposedEditorModel;
    referenceId: string;
    nextContent: ComposedInlineContent[];
  }): void;
};

export function TextAuthoringContent({
  content,
  referencePreviewCache,
  model,
  workbookEnabled,
  disabled,
  onChange,
  onModelChange,
  onSelectReference,
  onCreatedReference,
}: TextAuthoringContentProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const ignoreNextPickerCloseRef = useRef(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const textValue = useMemo(() => formatInlineBlueprint(content), [content]);

  function updateSelection() {
    const textarea = textareaRef.current;
    if (!textarea) return;
    setSelection({
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
    });
  }

  function restoreSelection(nextSelection: { start: number; end: number }) {
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(
        nextSelection.start,
        nextSelection.end,
      );
      updateSelection();
    });
  }

  function insertReference(
    referenceId: string,
    options: { emitChange?: boolean } = {},
  ) {
    const textarea = textareaRef.current;
    const result = insertReferenceSyntaxAtSelection({
      text: textValue,
      selection: textarea
        ? {
            start: textarea.selectionStart,
            end: textarea.selectionEnd,
          }
        : selection,
      referenceId,
    });
    const nextContent = parseInlineBlueprint(result.text);
    if (options.emitChange !== false) {
      onChange(nextContent);
    }
    restoreSelection(result.selection);
    return nextContent;
  }

  function openPickerFromContextMenu() {
    ignoreNextPickerCloseRef.current = true;
    setPickerOpen(true);
    window.setTimeout(() => {
      ignoreNextPickerCloseRef.current = false;
    }, 150);
  }

  function setReferencePickerOpen(open: boolean) {
    if (!open && ignoreNextPickerCloseRef.current) {
      return;
    }
    setPickerOpen(open);
  }

  return (
    <FieldGroup>
      <ContextMenu>
        <ContextMenuTrigger asChild disabled={disabled}>
          <Textarea
            ref={textareaRef}
            value={textValue}
            disabled={disabled}
            className="min-h-28 resize-y"
            placeholder="Write text..."
            onBlur={updateSelection}
            onClick={updateSelection}
            onContextMenu={updateSelection}
            onKeyUp={updateSelection}
            onSelect={updateSelection}
            onChange={(event) =>
              onChange(parseInlineBlueprint(event.currentTarget.value))
            }
          />
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem
            disabled={disabled}
            onSelect={() => {
              openPickerFromContextMenu();
            }}
          >
            Insert reference
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <div className="flex flex-wrap items-center gap-2">
        <ReferencePickerPopover
          model={model}
          referencePreviewCache={referencePreviewCache}
          workbookEnabled={workbookEnabled}
          disabled={disabled}
          open={pickerOpen}
          onOpenChange={setReferencePickerOpen}
          onModelChange={onModelChange}
          onSelectReference={insertReference}
          onCreateAndSelectReference={({ nextModel, referenceId }) => {
            const nextContent = insertReference(referenceId, {
              emitChange: false,
            });

            if (onCreatedReference) {
              onCreatedReference({
                nextModel,
                referenceId,
                nextContent,
              });
              return;
            }

            onModelChange(nextModel);
            onChange(nextContent);
          }}
          trigger={
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled}
              onMouseDown={(event) => {
                event.preventDefault();
                updateSelection();
              }}
            >
              Insert reference
            </Button>
          }
        />
      </div>
      <div className="rounded-md border bg-muted/20 p-3 text-sm">
        <InlineContentRenderer
          content={content}
          mode="editing"
          referencePreviewValues={referencePreviewCache}
          onSelectReference={onSelectReference}
        />
      </div>
    </FieldGroup>
  );
}
