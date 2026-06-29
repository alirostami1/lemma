import { cn } from "@lemma/ui/lib/utils";
import type { ReferencePreviewStatus } from "#/domains/questions/reference-preview";

export function ReferenceChip({
  referenceId,
  status = "resolved",
  label,
  onSelect,
}: {
  referenceId: string;
  status?: ReferencePreviewStatus;
  label?: string;
  onSelect?: (referenceId: string) => void;
}) {
  const content = label ?? "Added value";

  if (onSelect) {
    return (
      <button
        className={getChipClassName(status)}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(referenceId);
        }}
        type="button"
      >
        {content}
      </button>
    );
  }

  return <span className={getChipClassName(status)}>{content}</span>;
}

function getChipClassName(status: ReferencePreviewStatus) {
  return cn(
    "inline-flex max-w-full items-center rounded-md border px-1.5 py-0.5 align-baseline font-mono text-xs",
    status === "resolved" && "border-primary/30 bg-primary/10 text-primary",
    status === "missing_source" &&
      "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    status === "error" &&
      "border-destructive/40 bg-destructive/10 text-destructive",
  );
}
