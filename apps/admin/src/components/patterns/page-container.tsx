import type { ReactNode } from "react";
import { cn } from "@lemma/ui/lib/utils";

const variantClasses = {
  launcher: "max-w-5xl gap-6",
  resource: "max-w-6xl gap-6",
  workbench: "max-w-7xl gap-4",
} as const;

export type PageContainerProps = {
  variant: keyof typeof variantClasses;
  children: ReactNode;
  className?: string;
};

export function PageContainer({
  variant,
  children,
  className,
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto grid w-full",
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </div>
  );
}
