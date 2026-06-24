import { Button } from "@lemma/ui/components/button";
import { cn } from "@lemma/ui/lib/utils";
import { CheckCircle2, Circle } from "lucide-react";
import type { ReactNode } from "react";

export type ToolbarPopoverChoiceProps = {
  selected?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  title: string;
  description?: string;
  trailing?: ReactNode;
  onClick(): void;
};

export function ToolbarPopoverChoice({
  selected = false,
  disabled = false,
  icon,
  title,
  description,
  trailing,
  onClick,
}: ToolbarPopoverChoiceProps) {
  const StatusIcon = selected ? CheckCircle2 : Circle;

  return (
    <Button
      aria-pressed={selected}
      className={cn(
        "h-auto w-full min-h-14 justify-start gap-3 px-3 py-3 text-left",
        selected && "border-primary",
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
      variant={selected ? "default" : "outline"}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background/60">
        {icon}
      </span>
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="truncate text-sm font-medium">{title}</span>
        {description ? (
          <span className="truncate text-xs font-normal opacity-80">
            {description}
          </span>
        ) : null}
      </span>
      {trailing ?? <StatusIcon className="size-4 shrink-0" />}
    </Button>
  );
}
