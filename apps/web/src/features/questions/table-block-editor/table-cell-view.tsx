import { cn } from "@lemma/ui/lib/utils";
import type {
  TableEditorCell,
  TableResponseField,
} from "#/domains/questions/authoring";
import type { ReferencePreviewCache } from "#/domains/questions/reference-preview";
import { InlineContentRenderer } from "#/features/questions/editor-shared";

export function TableCellView({
  cell,
  responseField,
  referencePreviewCache,
  isSelected,
  disabled,
  onSelect,
}: {
  cell: TableEditorCell | null;
  responseField?: TableResponseField;
  referencePreviewCache?: ReferencePreviewCache;
  isSelected: boolean;
  disabled?: boolean;
  onSelect(): void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "min-h-12 w-full rounded-md border border-border/70 bg-background p-2 text-left text-sm transition",
        disabled
          ? "cursor-default opacity-70"
          : "cursor-pointer hover:border-primary/60 focus:outline-none focus:ring-2 focus:ring-ring",
        isSelected && "border-primary ring-2 ring-primary/20",
      )}
      disabled={disabled}
      aria-disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        if (!disabled) {
          onSelect();
        }
      }}
    >
      {cell ? (
        cell.type === "response" ? (
          <AnswerCellContent cell={cell} responseField={responseField} />
        ) : (
          <CellContent
            cell={cell}
            referencePreviewCache={referencePreviewCache ?? {}}
          />
        )
      ) : (
        <span className="text-muted-foreground">Empty</span>
      )}
    </button>
  );
}

function CellContent({
  cell,
  referencePreviewCache,
}: {
  cell: TableEditorCell;
  referencePreviewCache: ReferencePreviewCache;
}) {
  if (cell.type === "content") {
    return (
      <div className="whitespace-pre-wrap">
        {cell.content.length > 0 ? (
          <InlineContentRenderer
            content={cell.content}
            mode="preview"
            referencePreviewValues={referencePreviewCache}
          />
        ) : (
          <span className="text-muted-foreground">Empty</span>
        )}
      </div>
    );
  }

  return null;
}

function AnswerCellContent({
  cell,
  responseField,
}: {
  cell: Extract<TableEditorCell, { type: "response" }>;
  responseField?: TableResponseField;
}) {
  const fieldLabel = responseField?.label ?? "Answer";
  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {fieldLabel}
        </span>
        <span className="rounded-md border bg-muted/40 px-1.5 py-0.5 text-[11px] text-muted-foreground">
          Answer
        </span>
      </div>
      <div className="min-h-8 rounded-md border border-dashed bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
        {cell.label ?? fieldLabel}
        {cell.placeholder ? (
          <span className="ml-2 opacity-70">{cell.placeholder}</span>
        ) : null}
      </div>
    </div>
  );
}
