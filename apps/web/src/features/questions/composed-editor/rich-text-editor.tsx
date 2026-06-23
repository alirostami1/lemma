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
import type { QuestionBlueprintWorkbookSource } from "#/domains/questions/model";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import { ReferencePickerPopover } from "./inspector/reference-picker-popover";
import { insertReferenceSyntaxAtSelection } from "./reference-insertion-controller";

export function RichTextEditor({
  value,
  model,
  referencePreviewCache,
  workbookEnabled,
  sources,
  workbookSheetNamesBySourceId,
  disabled,
  onModelChange,
  onChange,
  onCreatedReference,
}: {
  value: ComposedRichContent;
  model: ComposedEditorModel;
  referencePreviewCache: ReferencePreviewCache;
  workbookEnabled: boolean;
  sources: QuestionBlueprintWorkbookSource[];
  workbookSheetNamesBySourceId?: Readonly<Record<string, readonly string[]>>;
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
      referenceId,
      selection: textarea
        ? {
            end: textarea.selectionEnd,
            start: textarea.selectionStart,
          }
        : { end: selectionEnd, start: selectionStart },
      text: markdown,
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
      format,
      markdown,
      selectionEnd: textarea?.selectionEnd ?? selectionEnd,
      selectionStart: textarea?.selectionStart ?? selectionStart,
    });

    updateMarkdown(result.markdown);
    restoreSelection({
      end: result.selectionEnd,
      start: result.selectionStart,
    });
  }

  const activeFormat = getMarkdownFormatAtPosition(markdown, selectionStart);

  return (
    <TooltipProvider>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <ToolbarButton
            active={activeFormat === "paragraph"}
            disabled={disabled}
            icon={<Pilcrow />}
            label="Paragraph"
            onClick={() => applyFormat("paragraph")}
          />
          <ToolbarButton
            active={activeFormat === "heading1"}
            disabled={disabled}
            icon={<Heading1 />}
            label="Heading 1"
            onClick={() => applyFormat("heading1")}
          />
          <ToolbarButton
            active={activeFormat === "heading2"}
            disabled={disabled}
            icon={<Heading2 />}
            label="Heading 2"
            onClick={() => applyFormat("heading2")}
          />
          <ToolbarButton
            active={activeFormat === "heading3"}
            disabled={disabled}
            icon={<Heading3 />}
            label="Heading 3"
            onClick={() => applyFormat("heading3")}
          />
          <ToolbarButton
            active={activeFormat === "bulletList"}
            disabled={disabled}
            icon={<List />}
            label="Bullet list"
            onClick={() => applyFormat("bulletList")}
          />
          <ToolbarButton
            active={activeFormat === "orderedList"}
            disabled={disabled}
            icon={<ListOrdered />}
            label="Ordered list"
            onClick={() => applyFormat("orderedList")}
          />
          <ReferencePickerPopover
            disabled={disabled}
            model={model}
            onCreateAndSelectReference={({ nextModel, referenceId }) => {
              const nextContent = insertReference(referenceId, {
                emitChange: false,
              });
              if (onCreatedReference) {
                onCreatedReference({ nextContent, nextModel });
                return;
              }
              onModelChange(nextModel);
              onChange(nextContent);
            }}
            onModelChange={onModelChange}
            onOpenChange={setReferencePickerOpen}
            onSelectReference={insertReference}
            open={pickerOpen}
            referencePreviewCache={referencePreviewCache}
            sources={sources}
            trigger={
              <Button
                disabled={disabled}
                onMouseDown={(event) => {
                  event.preventDefault();
                  updateSelection();
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                Insert reference
              </Button>
            }
            workbookEnabled={workbookEnabled}
            workbookSheetNamesBySourceId={workbookSheetNamesBySourceId}
          />
        </div>

        <ContextMenu>
          <ContextMenuTrigger asChild disabled={disabled}>
            <Textarea
              className="min-h-40 font-mono text-sm"
              disabled={disabled}
              onBlur={updateSelection}
              onChange={(event) => updateMarkdown(event.currentTarget.value)}
              onClick={updateSelection}
              onContextMenu={updateSelection}
              onKeyUp={updateSelection}
              onSelect={updateSelection}
              ref={textareaRef}
              value={markdown}
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
          aria-label={label}
          aria-pressed={active}
          disabled={disabled}
          onClick={onClick}
          onMouseDown={(event) => event.preventDefault()}
          size="icon-sm"
          type="button"
          variant={active ? "secondary" : "outline"}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
