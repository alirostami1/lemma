import { Button } from "@lemma/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "@lemma/ui/components/popover";
import { cn } from "@lemma/ui/lib/utils";
import { HelpCircle, X } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

export function ContextualHelpPopover({
  children,
  className,
  label,
  title,
}: {
  children: ReactNode;
  className?: string;
  label: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-label={label}
          className={cn("size-8 rounded-md", className)}
          size="icon"
          type="button"
          variant="ghost"
        >
          <HelpCircle aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(calc(100vw-2rem),18rem)]">
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-2">
            <PopoverTitle>{title}</PopoverTitle>
            <PopoverDescription>{children}</PopoverDescription>
          </div>
          <Button
            aria-label="Close help"
            className="size-7 shrink-0 rounded-md"
            onClick={() => setOpen(false)}
            size="icon"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
