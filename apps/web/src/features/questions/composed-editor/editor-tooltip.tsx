import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@lemma/ui/components/tooltip";
import type { ReactNode } from "react";

type EditorTooltipProps = {
  label: string;
  children: ReactNode;
};

export function EditorTooltip({ label, children }: EditorTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
