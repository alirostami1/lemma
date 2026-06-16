import type { ReactNode } from "react";
import { cn } from "#/lib/utils";

const titleClasses = {
  launcher: "text-3xl font-semibold tracking-tight",
  default: "text-2xl font-semibold tracking-tight",
} as const;

export type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  size?: "launcher" | "default";
};

function PageHeader({
  title,
  description,
  actions,
  size = "default",
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="grid gap-1">
        <h1 className={cn(titleClasses[size])}>{title}</h1>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-end">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export { PageHeader };
