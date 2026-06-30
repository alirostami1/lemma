import { Button } from "@lemma/ui/components/button";
import { cn } from "@lemma/ui/lib/utils";
import { AlertTriangle } from "lucide-react";
import type {
  ComposedEditorModel,
  ReferenceUsage,
} from "#/domains/questions/authoring";
import {
  type InlineReferenceUsage,
  removeInlineReferenceUsageFromComposedEditorModel,
} from "#/domains/questions/reference-integrity";
import type { EditorSelection } from "../editor-selection";

export type ReferenceRecoveryItem = {
  id: string;
  referenceId: string;
  status: "checking" | "unavailable";
  usage: ReferenceUsage;
};

export function ReferenceRecoveryPanel({
  disabled,
  items = [],
  model,
  onModelChange,
  onSelectionChange,
}: {
  disabled?: boolean;
  items?: readonly ReferenceRecoveryItem[];
  model: ComposedEditorModel;
  onModelChange(model: ComposedEditorModel): void;
  onSelectionChange(selection: EditorSelection): void;
}) {
  if (items.length === 0) {
    return null;
  }
  const tone = getPanelTone(items);
  const header = getPanelHeader(tone);

  return (
    <section
      aria-label={header.title}
      className={cn(
        "grid gap-3 rounded-lg border p-3",
        tone === "unavailable" && "border-destructive/30 bg-destructive/5",
        tone !== "unavailable" && "border-amber-500/40 bg-amber-500/10",
      )}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle
          className={cn(
            "mt-0.5 size-4",
            tone === "unavailable"
              ? "text-destructive"
              : "text-amber-700 dark:text-amber-300",
          )}
        />
        <div className="grid gap-1">
          <h2 className="text-sm font-medium">{header.title}</h2>
          <p className="text-xs text-muted-foreground">{header.description}</p>
        </div>
      </div>

      <ul className="grid gap-2">
        {items.map((item) => {
          const label = getUsageLabel(model, item.usage);
          const removableUsage = getRemovableUsage(item);
          return (
            <li
              className={cn(
                "grid gap-2 rounded-md border bg-background p-2",
                item.status === "checking" &&
                  "border-amber-500/30 bg-amber-500/5",
              )}
              key={item.id}
            >
              <div className="grid gap-0.5">
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">
                  {getItemDescription(item)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() =>
                    onSelectionChange(toEditorSelection(item.usage))
                  }
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Review area
                </Button>
                {removableUsage ? (
                  <Button
                    disabled={disabled}
                    onClick={() => {
                      onModelChange(
                        removeInlineReferenceUsageFromComposedEditorModel({
                          model,
                          referenceId: item.referenceId,
                          usage: removableUsage,
                        }),
                      );
                    }}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Remove inserted value
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function getPanelTone(items: readonly ReferenceRecoveryItem[]) {
  const hasChecking = items.some((item) => item.status === "checking");
  const hasUnavailable = items.some((item) => item.status === "unavailable");

  if (hasChecking && !hasUnavailable) {
    return "checking";
  }
  if (hasChecking && hasUnavailable) {
    return "mixed";
  }
  return "unavailable";
}

function getPanelHeader(tone: ReturnType<typeof getPanelTone>) {
  if (tone === "checking") {
    return {
      description:
        "Wait for workbook values to finish loading before publishing.",
      title: "Workbook values are still loading",
    };
  }
  if (tone === "mixed") {
    return {
      description:
        "Some workbook values are unavailable or still loading before publishing.",
      title: "Workbook values need review",
    };
  }
  return {
    description: "Review the affected workbook values before publishing.",
    title: "Inserted values need attention",
  };
}

function getItemDescription(item: ReferenceRecoveryItem) {
  if (item.status === "checking") {
    return "This workbook value is still being checked.";
  }
  if (isAnswerUsage(item.usage)) {
    return "Open this answer and choose a replacement value.";
  }
  return "Workbook value is unavailable.";
}

function getRemovableUsage(item: ReferenceRecoveryItem) {
  return item.status === "unavailable" && isInlineContentUsage(item.usage)
    ? item.usage
    : null;
}

function toEditorSelection(usage: ReferenceUsage): EditorSelection {
  switch (usage.type) {
    case "text_block":
    case "rich_text_block":
    case "response_answer":
      return { blockId: usage.blockId, type: "block" };
    case "table_content_cell":
    case "table_answer_cell":
      return {
        blockId: usage.blockId,
        cellId: usage.cellId,
        type: "table_cell",
      };
  }
}

function getUsageLabel(
  model: ComposedEditorModel,
  usage: ReferenceUsage,
): string {
  switch (usage.type) {
    case "text_block":
      return `${getBlockLabel(model, usage.blockId, "text", "Text block")} inserted value`;
    case "rich_text_block":
      return `${getBlockLabel(model, usage.blockId, "rich_text", "Question block")} inserted value`;
    case "response_answer":
      return `${getBlockLabel(model, usage.blockId, "response", "Answer")} value`;
    case "table_content_cell":
      return "Table content cell inserted value";
    case "table_answer_cell":
      return "Table answer cell value";
  }
}

function getBlockLabel(
  model: ComposedEditorModel,
  blockId: string,
  blockType: "text" | "rich_text" | "response",
  label: string,
) {
  let count = 0;
  for (const block of model.blocks) {
    if (block.type === blockType) {
      count += 1;
    }
    if (block.id === blockId) {
      return `${label} ${count}`;
    }
  }

  return label;
}

function isAnswerUsage(usage: ReferenceUsage) {
  return usage.type === "response_answer" || usage.type === "table_answer_cell";
}

function isInlineContentUsage(
  usage: ReferenceUsage,
): usage is InlineReferenceUsage {
  return (
    usage.type === "text_block" ||
    usage.type === "rich_text_block" ||
    usage.type === "table_content_cell"
  );
}
