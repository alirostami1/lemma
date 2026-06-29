import { Button } from "@lemma/ui/components/button";
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
  type ComposedReferenceDraft,
  type ComposedRichContent,
  type ComposedRichContentNode,
  getMarkdownFormatAtPosition,
  type MarkdownFormat,
  markdownToRichContentForAuthoring,
  richContentToMarkdown,
  toggleMarkdownFormat,
} from "#/domains/questions/authoring";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import { RichContentPreview } from "../editor-shared/rich-content-preview";

export function RichTextEditor({
  value,
  referencePreviewCache,
  references = [],
  disabled,
  onChange,
  onSelectReference,
}: {
  value: ComposedRichContent;
  referencePreviewCache: ReferencePreviewCache;
  references?: readonly ComposedReferenceDraft[];
  disabled?: boolean;
  onChange(value: ComposedRichContent): void;
  onSelectReference?: (referenceId: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasReferences = useMemo(() => hasRichReferences(value), [value]);
  const initialMarkdown = useMemo(() => richContentToMarkdown(value), [value]);
  const emittedValueMarkdownRef = useRef(initialMarkdown);
  const [markdown, setMarkdown] = useState(initialMarkdown);
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
    const nextContent = markdownToRichContentForAuthoring(nextMarkdown);
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

  if (hasReferences) {
    return (
      <div className="space-y-3">
        <RichContentPreview
          content={value}
          mode="editing"
          onSelectReference={disabled ? undefined : onSelectReference}
          referencePreviewCache={referencePreviewCache}
          references={references}
        />
        <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          Rich text with added values is read-only in Studio for now. Use text,
          table, or answer blocks to add and edit values.
        </p>
      </div>
    );
  }

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
        </div>

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
      </div>
    </TooltipProvider>
  );
}

function hasRichReferences(content: ComposedRichContent) {
  return content.content.some(richNodeHasReferences);
}

function richNodeHasReferences(node: ComposedRichContentNode): boolean {
  if (node.type === "paragraph" || node.type === "heading") {
    return node.content.some((item) => item.type === "reference");
  }

  return node.items.some((item) =>
    item.content.some((child) =>
      child.type === "paragraph"
        ? child.content.some((item) => item.type === "reference")
        : richNodeHasReferences(child),
    ),
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
