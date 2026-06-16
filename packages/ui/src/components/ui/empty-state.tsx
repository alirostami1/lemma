import type { ReactNode } from "react";
import { cn } from "#/lib/utils";

export type EmptyStateProps = {
  title?: string;
  description: string;
  action?: ReactNode;
  className?: string;
};

function EmptyState({
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "grid gap-3 rounded-lg border border-dashed p-5 text-sm text-muted-foreground",
        className,
      )}
    >
      <div className="grid gap-1">
        {title ? <p className="font-medium text-foreground">{title}</p> : null}
        <p>{description}</p>
      </div>
      {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
    </div>
  );
}

export { EmptyState };
