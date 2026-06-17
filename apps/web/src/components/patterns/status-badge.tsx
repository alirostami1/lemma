import { Badge } from "@lemma/ui/components/badge";
import type { ReactNode } from "react";

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
