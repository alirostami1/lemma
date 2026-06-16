import type { ReactNode } from "react";
import { Badge } from "@lemma/ui/components/badge";

export type StatusBadgeProps = {
  children: ReactNode;
  variant?: "default" | "secondary" | "outline" | "destructive";
};

export function StatusBadge({
  children,
  variant = "outline",
}: StatusBadgeProps) {
  return <Badge variant={variant}>{children}</Badge>;
}
