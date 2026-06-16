import type { ReactNode } from "react";

export function InspectorSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-3">
      <span className="grid gap-1 text-left">
        <span className="text-sm font-semibold">{title}</span>
        {description ? (
          <span className="text-xs font-normal text-muted-foreground">
            {description}
          </span>
        ) : null}
      </span>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}
