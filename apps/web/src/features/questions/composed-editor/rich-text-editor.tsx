import { Button } from "@lemma/ui/components/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@lemma/ui/components/context-menu";
import { Textarea } from "@lemma/ui/components/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@lemma/ui/components/tooltip";
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Pilcrow,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  type ComposedEditorModel,
  type ComposedRichContent,
  getMarkdownFormatAtPosition,
  type MarkdownFormat,
  markdownToRichContent,
  richContentToMarkdown,
  toggleMarkdownFormat,
} from "#/domains/questions/authoring";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import { ReferencePickerPopover } from "./inspector/reference-picker-popover";
import { insertReferenceSyntaxAtSelection } from "./reference-insertion-controller";

export function RichTextEditor({
  value,
  model,
  referencePreviewCache,
  workbookEnabled,
  activeSourceId,
  disabled,
  onModelChange,
  onChange,
  onCreatedReference,
}: {
  value: ComposedRichContent;
  model: ComposedEditorModel;
  referencePreviewCache: ReferencePreviewCache;
  workbookEnabled: boolean;
  activeSourceId: string | null;
  disabled?: boolean;
  onModelChange(model: ComposedEditorModel): void;
  onChange(value: ComposedRichContent): void;
  onCreatedReference?(input: {
    nextModel: ComposedEditorModel;
    nextContent: ComposedRichContent;
  }): void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const ignoreNextPickerCloseRef = useRef(false);
  const initialMarkdown = useMemo(() => richContentToMarkdown(value), [value]);
  const emittedValueMarkdownRef = useRef(initialMarkdown);
  const [markdown, setMarkdown] = useState(initialMarkdown);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);

  useEffect(() => {
    if (initialMarkdown !== emittedValueMarkdownRef.current) {
      emittedValueMarkdownRef.current = initialMarkdown;
      setMarkdown(initialMarkdown);
    }
  }, [initialMarkdown]);

  function updateSelection() {
    const textarea = textareaRef.current;
    if (!textarea) return;
    setSelectionStart(textarea.selectionStart);
    setSelectionEnd(textarea.selectionEnd);
  }

  function updateMarkdown(nextMarkdown: string) {
    const nextContent = markdownToRichContent(nextMarkdown);
    emittedValueMarkdownRef.current = richContentToMarkdown(nextContent);
    setMarkdown(nextMarkdown);
    onChange(nextContent);
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
      text: markdown,
      selection: textarea
        ? {
            start: textarea.selectionStart,
            end: textarea.selectionEnd,
          }
        : { start: selectionStart, end: selectionEnd },
      referenceId,
    });
    const nextContent = markdownToRichContent(result.text);
    emittedValueMarkdownRef.current = richContentToMarkdown(nextContent);
    setMarkdown(result.text);
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

  function applyFormat(format: MarkdownFormat) {
    const textarea = textareaRef.current;
    const result = toggleMarkdownFormat({
      markdown,
      selectionStart: textarea?.selectionStart ?? selectionStart,
      selectionEnd: textarea?.selectionEnd ?? selectionEnd,
      format,
    });

    updateMarkdown(result.markdown);
    restoreSelection({
      start: result.selectionStart,
      end: result.selectionEnd,
    });
  }

  const activeFormat = getMarkdownFormatAtPosition(markdown, selectionStart);

  return (
    <TooltipProvider>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <ToolbarButton
            label="Paragraph"
            active={activeFormat === "paragraph"}
            disabled={disabled}
            onClick={() => applyFormat("paragraph")}
            icon={<Pilcrow />}
          />
          <ToolbarButton
            label="Heading 1"
            active={activeFormat === "heading1"}
            disabled={disabled}
            onClick={() => applyFormat("heading1")}
            icon={<Heading1 />}
          />
          <ToolbarButton
            label="Heading 2"
            active={activeFormat === "heading2"}
            disabled={disabled}
            onClick={() => applyFormat("heading2")}
            icon={<Heading2 />}
          />
          <ToolbarButton
            label="Heading 3"
            active={activeFormat === "heading3"}
            disabled={disabled}
            onClick={() => applyFormat("heading3")}
            icon={<Heading3 />}
          />
          <ToolbarButton
            label="Bullet list"
            active={activeFormat === "bulletList"}
            disabled={disabled}
            onClick={() => applyFormat("bulletList")}
            icon={<List />}
          />
          <ToolbarButton
            label="Ordered list"
            active={activeFormat === "orderedList"}
            disabled={disabled}
            onClick={() => applyFormat("orderedList")}
            icon={<ListOrdered />}
          />
          <ReferencePickerPopover
            model={model}
            referencePreviewCache={referencePreviewCache}
            workbookEnabled={workbookEnabled}
            activeSourceId={activeSourceId}
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
                onCreatedReference({ nextModel, nextContent });
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

        <ContextMenu>
          <ContextMenuTrigger asChild disabled={disabled}>
            <Textarea
              ref={textareaRef}
              value={markdown}
              disabled={disabled}
              className="min-h-40 font-mono text-sm"
              onBlur={updateSelection}
              onClick={updateSelection}
              onContextMenu={updateSelection}
              onKeyUp={updateSelection}
              onSelect={updateSelection}
              onChange={(event) => updateMarkdown(event.currentTarget.value)}
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
      </div>
    </TooltipProvider>
  );
}

function ToolbarButton({
  active,
  disabled,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onClick(): void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={active ? "secondary" : "outline"}
          size="icon-sm"
          aria-label={label}
          aria-pressed={active}
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={onClick}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
