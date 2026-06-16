import { Badge } from "@lemma/ui/components/badge";
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
import type { OpsQueueJob, OpsQueueStateFilter } from "#/domains/ops";
import {
  formatDate,
  getJobRequestId,
  OperationId,
  QueueStateBadge,
  shortId,
  TableSkeleton,
} from "#/features/shared";

export function QueuePanel({
  jobs,
  state,
  isLoading,
  errorMessage,
  onStateChange,
  onRetry,
}: {
  jobs: OpsQueueJob[];
  state: OpsQueueStateFilter;
  isLoading: boolean;
  errorMessage: string | null;
  onStateChange(value: OpsQueueStateFilter): void;
  onRetry(): void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Queue jobs</CardTitle>
            <CardDescription>
              Active and archived pg-boss jobs with status filtering.
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select
              value={state}
              onValueChange={(value) =>
                onStateChange(value as OpsQueueStateFilter)
              }
            >
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All jobs</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="successful">Successful</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant={jobs.length > 0 ? "secondary" : "outline"}>
              {jobs.length} shown
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <TableSkeleton rows={5} /> : null}
        {errorMessage ? (
          <InlineError message={errorMessage} onRetry={onRetry} />
        ) : null}
        {!isLoading && !errorMessage && jobs.length === 0 ? (
          <EmptyState description="No queue jobs match the current filters." />
        ) : null}
        {!isLoading && !errorMessage && jobs.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead>Request</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Retries</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead>Output</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell>
                    <div className="grid gap-1">
                      <span className="font-medium">{job.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {shortId(job.id)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <OperationId value={getJobRequestId(job)} />
                  </TableCell>
                  <TableCell>
                    <QueueStateBadge state={job.state} />
                  </TableCell>
                  <TableCell>
                    {job.retryCount}/{job.retryLimit}
                  </TableCell>
                  <TableCell>{formatDate(job.startedOn)}</TableCell>
                  <TableCell>{formatDate(job.completedOn)}</TableCell>
                  <TableCell className="max-w-md truncate">
                    {job.output ? JSON.stringify(job.output) : "No output"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </CardContent>
    </Card>
  );
}
