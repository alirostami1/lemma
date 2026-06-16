import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@lemma/ui/components/card";
import { Skeleton } from "@lemma/ui/components/skeleton";
import { Bell, CheckCircle2, RotateCcw, Users } from "lucide-react";
import type { ReactNode } from "react";
import type { OpsOverview } from "#/domains/ops";
import { formatAge, StatusDot } from "#/features/shared";

export function OverviewStrip({
  overview,
  userCount,
  roleCount,
  notificationCount,
  isLoading,
}: {
  overview: OpsOverview | null;
  userCount: number;
  roleCount: number;
  notificationCount: number;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <output className="grid gap-3 lg:grid-cols-4">
        <span className="sr-only">Loading overview...</span>
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </output>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-4">
      <MetricCard
        icon={<Users />}
        label="Users loaded"
        value={userCount}
        detail={`${roleCount} roles configured`}
      />
      <MetricCard
        icon={<Bell />}
        label="Recent events"
        value={notificationCount}
        detail={`${overview?.outbox.publishedCount ?? 0} published, ${
          overview?.outbox.failedCount ?? 0
        } failed`}
        tone={(overview?.outbox.failedCount ?? 0) > 0 ? "bad" : "good"}
      />
      <MetricCard
        icon={<RotateCcw />}
        label="Queue failed"
        value={overview?.queue.failedCount ?? 0}
        detail={
          overview?.queue.available === false
            ? "Queue unavailable"
            : `${overview?.queue.completedCount ?? 0} successful, ${
                overview?.queue.pendingCount ?? 0
              } pending`
        }
        tone={(overview?.queue.failedCount ?? 0) > 0 ? "bad" : "good"}
      />
      <MetricCard
        icon={<CheckCircle2 />}
        label="Outbox pending"
        value={overview?.outbox.pendingCount ?? 0}
        detail={formatAge(overview?.outbox.oldestPendingCreatedAt ?? null)}
      />
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  tone = "neutral",
}: {
  icon: ReactNode;
  label: string;
  value: number;
  detail?: string;
  tone?: "bad" | "good" | "neutral";
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            {icon}
            {label}
          </CardTitle>
          <StatusDot tone={tone} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        {detail ? (
          <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}
