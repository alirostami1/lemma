import { cn } from "@lemma/ui/lib/utils";
import type { KeyboardEvent, MouseEvent } from "react";
import type {
  InputPrimitiveType,
  TableCellFormatting,
  TableEditorCell,
  TableEditorPrimitiveBlock,
  TableResponseField,
} from "#/domains/questions/authoring";

import {
  getTableCellPrimitiveBlocks,
  normalizeInputPrimitiveForType,
} from "#/domains/questions/authoring";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import { InlineContentRenderer } from "#/features/questions/editor-shared";
import { RichTextBlockRenderer } from "#/features/questions/presentation/rich-text-block-renderer";

export type TableCellActivation = {
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  source: "click" | "keyboard" | "pointer";
};

export function TableCellView({
  cell,
  responseField,
  referencePreviewCache,
  isSelected,
  isActive,
  selectOnClick = true,
  disabled,
  ariaLabel,
  onSelect,
}: {
  cell: TableEditorCell | null;
  responseField?: TableResponseField;
  referencePreviewCache?: ReferencePreviewCache;
  isSelected: boolean;
  isActive?: boolean;
  selectOnClick?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  onSelect(activation: TableCellActivation): void;
}) {
  return (
    <button
      aria-disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        "h-full min-h-12 w-full overflow-hidden rounded-md border border-border/70 bg-background p-2 text-left text-sm transition",
        cell ? tableCellFormattingClassName(cell.formatting) : null,
        disabled
          ? "cursor-default opacity-70"
          : "cursor-pointer hover:border-primary/60 focus:outline-none focus:ring-2 focus:ring-ring",
        isSelected && "border-primary bg-primary/5",
        isActive && "ring-2 ring-primary/30",
      )}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        if (!disabled && selectOnClick) {
          onSelect(activationFromEvent(event, "click"));
        }
      }}
      onKeyDown={(event) => {
        if (
          disabled ||
          !selectOnClick ||
          (event.key !== "Enter" && event.key !== " ")
        ) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        onSelect(activationFromEvent(event, "keyboard"));
      }}
      type="button"
    >
      {cell ? (
        <CellContent
          cell={cell}
          referencePreviewCache={referencePreviewCache ?? {}}
          responseField={responseField}
        />
      ) : (
        <span className="text-muted-foreground">Empty</span>
      )}
    </button>
  );
}

function activationFromEvent(
  event: KeyboardEvent<HTMLButtonElement> | MouseEvent<HTMLButtonElement>,
  source: TableCellActivation["source"],
): TableCellActivation {
  return {
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey,
    source,
  };
}

export function tableCellFormattingClassName(
  formatting: TableCellFormatting | undefined,
) {
  return cn(
    formatting?.textAlign === "center" && "text-center",
    formatting?.textAlign === "right" && "text-right",
    formatting?.textAlign === "left" && "text-left",
    formatting?.emphasis === "strong" && "font-semibold",
    formatting?.tone === "muted" && "bg-muted/50",
    formatting?.tone === "highlight" && "bg-primary/10",
  );
}

function CellContent({
  cell,
  referencePreviewCache,
  responseField,
}: {
  cell: TableEditorCell;
  referencePreviewCache: ReferencePreviewCache;
  responseField?: TableResponseField;
}) {
  const blocks = getTableCellPrimitiveBlocks(cell);
  if (blocks.length === 0) {
    return <span className="text-muted-foreground">Empty</span>;
  }

  return (
    <div className="grid max-h-full gap-2 overflow-hidden">
      {blocks.map((block) => (
        <PrimitiveCellContent
          block={block}
          key={block.id}
          referencePreviewCache={referencePreviewCache}
          responseField={responseField}
        />
      ))}
    </div>
  );
}

function PrimitiveCellContent({
  block,
  responseField,
  referencePreviewCache,
}: {
  block: TableEditorPrimitiveBlock;
  responseField?: TableResponseField;
  referencePreviewCache: ReferencePreviewCache;
}) {
  if (block.type === "text") {
    return (
      <div className="overflow-hidden whitespace-pre-wrap">
        {block.content.length > 0 ? (
          <InlineContentRenderer
            content={block.content}
            mode="preview"
            referencePreviewValues={referencePreviewCache}
          />
        ) : (
          <span className="text-muted-foreground">Empty</span>
        )}
      </div>
    );
  }
  if (block.type === "rich_text") {
    return (
      <RichTextBlockRenderer
        content={block.content}
        referencePreviewCache={referencePreviewCache}
      />
    );
  }
  if (block.type === "separator") {
    return <hr className="border-border" />;
  }
  const fieldLabel = responseField?.label ?? "Answer";
  const input = normalizeInputPrimitiveForType(
    block.input,
    responseField?.type ?? "text",
  );
  return (
    <div className="grid max-h-full gap-1 overflow-hidden">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {fieldLabel}
        </span>
        <span className="rounded-md border bg-muted/40 px-1.5 py-0.5 text-[11px] text-muted-foreground">
          {inputTypeLabel(input.type)}
        </span>
      </div>
      <div className="min-h-8 rounded-md border border-dashed bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
        {block.label ?? fieldLabel}
        {block.placeholder ? (
          <span className="ml-2 opacity-70">{block.placeholder}</span>
        ) : null}
      </div>
    </div>
  );
}

function inputTypeLabel(type: InputPrimitiveType): string {
  switch (type) {
    case "text":
      return "Text";
    case "number":
      return "Number";
    case "select":
      return "Choice";
  }
}
