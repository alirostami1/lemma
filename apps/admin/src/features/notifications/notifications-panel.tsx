import { Badge } from "@lemma/ui/components/badge";
import { Button } from "@lemma/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@lemma/ui/components/card";
import { EmptyState } from "@lemma/ui/components/empty-state";
import { InlineError } from "@lemma/ui/components/inline-error";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@lemma/ui/components/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@lemma/ui/components/table";
import { CheckCircle2, EyeOff, RotateCcw } from "lucide-react";
import type {
  OpsOutboxEvent,
  OpsOutboxStatusFilter,
  OpsReviewState,
} from "#/domains/ops";
import {
  formatDate,
  OperationId,
  OutboxReviewBadge,
  OutboxStatusBadge,
  shortId,
  TableSkeleton,
} from "#/features/shared";

export function NotificationsPanel({
  events,
  failedEvents,
  status,
  reviewState,
  isLoading,
  errorMessage,
  isMutating,
  onStatusChange,
  onReviewStateChange,
  onRetry,
  onReplay,
  onReview,
  onIgnore,
}: {
  events: OpsOutboxEvent[];
  failedEvents: OpsOutboxEvent[];
  status: OpsOutboxStatusFilter;
  reviewState: OpsReviewState;
  isLoading: boolean;
  errorMessage: string | null;
  isMutating: boolean;
  onStatusChange(value: OpsOutboxStatusFilter): void;
  onReviewStateChange(value: OpsReviewState): void;
  onRetry(): void;
  onReplay(eventId: string): void;
  onReview(eventId: string): void;
  onIgnore(eventId: string): void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Realtime notifications</CardTitle>
            <CardDescription>
              Recent outbox events that drive websocket invalidation and toasts.
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select
              value={status}
              onValueChange={(value) =>
                onStatusChange(value as OpsOutboxStatusFilter)
              }
            >
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="publishing">Publishing</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={reviewState}
              onValueChange={(value) =>
                onReviewStateChange(value as OpsReviewState)
              }
            >
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All reviews</SelectItem>
                <SelectItem value="unreviewed">Unreviewed</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
                <SelectItem value="ignored">Ignored</SelectItem>
              </SelectContent>
            </Select>
            <Badge
              variant={failedEvents.length > 0 ? "destructive" : "secondary"}
            >
              {failedEvents.length} failed
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <TableSkeleton rows={5} /> : null}
        {errorMessage ? (
          <InlineError message={errorMessage} onRetry={onRetry} />
        ) : null}
        {!isLoading && !errorMessage && events.length === 0 ? (
          <EmptyState description="No recent notification events." />
        ) : null}
        {!isLoading && !errorMessage && events.length > 0 ? (
          <OutboxTable
            events={events}
            isMutating={isMutating}
            onReplay={onReplay}
            onReview={onReview}
            onIgnore={onIgnore}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function OutboxTable({
  events,
  isMutating,
  onReplay,
  onReview,
  onIgnore,
}: {
  events: OpsOutboxEvent[];
  isMutating: boolean;
  onReplay(eventId: string): void;
  onReview(eventId: string): void;
  onIgnore(eventId: string): void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Event</TableHead>
          <TableHead>Request</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Review</TableHead>
          <TableHead>Owner</TableHead>
          <TableHead>Attempts</TableHead>
          <TableHead>Updated</TableHead>
          <TableHead>Error</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {events.map((event) => (
          <TableRow key={event.id}>
            <TableCell>
              <div className="grid gap-1">
                <span className="font-medium">{event.eventType}</span>
                <span className="text-xs text-muted-foreground">
                  {event.aggregateType} {shortId(event.aggregateId)}
                </span>
              </div>
            </TableCell>
            <TableCell>
              <OperationId value={event.requestId} />
            </TableCell>
            <TableCell>
              <OutboxStatusBadge status={event.status} />
            </TableCell>
            <TableCell>
              <OutboxReviewBadge event={event} />
            </TableCell>
            <TableCell>
              {event.ownerUserId ? shortId(event.ownerUserId) : "-"}
            </TableCell>
            <TableCell>{event.attempts}</TableCell>
            <TableCell>{formatDate(event.updatedAt)}</TableCell>
            <TableCell className="max-w-64 whitespace-normal">
              {event.lastError ?? "-"}
            </TableCell>
            <TableCell>
              <div className="flex justify-end gap-1">
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  aria-label="Replay event"
                  disabled={isMutating || event.status !== "failed"}
                  onClick={() => onReplay(event.id)}
                >
                  <RotateCcw />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  aria-label="Review event"
                  disabled={isMutating || event.status !== "failed"}
                  onClick={() => onReview(event.id)}
                >
                  <CheckCircle2 />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  aria-label="Ignore event"
                  disabled={isMutating || event.status !== "failed"}
                  onClick={() => onIgnore(event.id)}
                >
                  <EyeOff />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
