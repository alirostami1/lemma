import type { ReactNode } from "react";
import { cn } from "#lib/utils";

export type ResourceListProps = {
  children: ReactNode;
  className?: string;
  variant?: "divided" | "stacked";
};

type ResourceListItemCommonProps = {
  title: ReactNode;
  description?: ReactNode;
  metadata?: ReactNode;
  status?: ReactNode;
  className?: string;
};

type ResourceListDisplayItemProps = {
  variant: "display";
  trailingAction?: ReactNode;
  navigationAccessory?: never;
  renderLink?: never;
};

type ResourceListNavigationItemProps = {
  variant: "navigation";
  navigationAccessory?: ReactNode;
  renderLink: (children: ReactNode, className: string) => ReactNode;
  trailingAction?: never;
};

export type ResourceListItemProps = ResourceListItemCommonProps &
  (ResourceListDisplayItemProps | ResourceListNavigationItemProps);

function ResourceList({
  children,
  className,
  variant = "divided",
}: ResourceListProps) {
  return (
    <div
      className={cn(
        variant === "divided"
          ? "divide-y overflow-hidden rounded-lg border"
          : "grid gap-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

function ResourceListItem(props: ResourceListItemProps) {
  const { title, description, metadata, status, className } = props;
  const content = (
    <span className="grid min-w-0 gap-1">
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate text-sm font-medium">{title}</span>
        {status ? <span className="shrink-0">{status}</span> : null}
      </span>
      {description ? (
        <span className="truncate text-sm text-muted-foreground">
          {description}
        </span>
      ) : null}
      {metadata ? (
        <span className="truncate text-xs text-muted-foreground">
          {metadata}
        </span>
      ) : null}
    </span>
  );

  if (props.variant === "navigation") {
    return props.renderLink(
      <>
        <span className="min-w-0 flex-1">{content}</span>
        {props.navigationAccessory ? (
          <span className="shrink-0">{props.navigationAccessory}</span>
        ) : null}
      </>,
      cn(
        "flex w-full items-center gap-3 px-3 py-2.5 text-left outline-none transition-colors hover:bg-muted/40 focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        className,
      ),
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2.5",
        props.trailingAction ? "justify-between" : "",
        className,
      )}
    >
      <div className="min-w-0 flex-1">{content}</div>
      {props.trailingAction ? (
        <div className="shrink-0">{props.trailingAction}</div>
      ) : null}
    </div>
  );
}

export { ResourceList, ResourceListItem };
