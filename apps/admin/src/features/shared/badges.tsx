import { Badge } from "@lemma/ui/components/badge";
import type { IdentityUserStatus } from "#/domains/identity";
import type { OpsOutboxEvent } from "#/domains/ops";

export function UserStatusBadge({ status }: { status: IdentityUserStatus }) {
  if (status === "active") {
    return <Badge variant="secondary">Active</Badge>;
  }
  if (status === "disabled") {
    return <Badge variant="outline">Disabled</Badge>;
  }
  return <Badge variant="destructive">Deleted</Badge>;
}

export function OutboxStatusBadge({
  status,
}: {
  status: OpsOutboxEvent["status"];
}) {
  if (status === "failed") {
    return <Badge variant="destructive">Failed</Badge>;
  }
  if (status === "published") {
    return <Badge variant="secondary">Published</Badge>;
  }
  return <Badge variant="outline">{status}</Badge>;
}

export function OutboxReviewBadge({ event }: { event: OpsOutboxEvent }) {
  if (!event.latestReview) {
    return <Badge variant="outline">Unreviewed</Badge>;
  }
  if (event.latestReview.action === "ignored") {
    return <Badge variant="outline">Ignored</Badge>;
  }
  if (event.latestReview.action === "replayed") {
    return <Badge variant="secondary">Replayed</Badge>;
  }
  return <Badge variant="secondary">Reviewed</Badge>;
}

export function QueueStateBadge({ state }: { state: string }) {
  if (state === "failed") {
    return <Badge variant="destructive">Failed</Badge>;
  }
  if (state === "completed") {
    return <Badge variant="secondary">Successful</Badge>;
  }
  if (state === "created" || state === "retry") {
    return <Badge variant="outline">Pending</Badge>;
  }
  return <Badge variant="outline">{state}</Badge>;
}
