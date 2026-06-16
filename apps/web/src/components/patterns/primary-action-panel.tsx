import type { ReactNode } from "react";
import { Badge } from "@lemma/ui/components/badge";
import { Card, CardHeader, CardTitle } from "@lemma/ui/components/card";

export type PrimaryActionPanelProps = {
  eyebrow?: string;
  title: string;
  description: string;
  action: ReactNode;
};

export function PrimaryActionPanel({
  eyebrow,
  title,
  description,
  action,
}: PrimaryActionPanelProps) {
  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card ring-primary/15">
      <CardHeader className="gap-3">
        {eyebrow ? (
          <div>
            <Badge variant="secondary">{eyebrow}</Badge>
          </div>
        ) : null}
        <div className="grid gap-1 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-4">
          <div className="grid gap-1">
            <CardTitle className="text-xl">{title}</CardTitle>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <div>{action}</div>
        </div>
      </CardHeader>
    </Card>
  );
}
