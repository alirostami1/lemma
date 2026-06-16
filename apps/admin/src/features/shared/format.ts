import type { OpsQueueJob } from "#/domains/ops";

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString();
}

export function formatAge(value: string | null | undefined): string {
  if (!value) {
    return "No pending age";
  }
  const ageMs = Date.now() - new Date(value).getTime();
  if (ageMs < 60_000) {
    return "Under 1 minute";
  }
  if (ageMs < 3_600_000) {
    return `${Math.floor(ageMs / 60_000)} minutes`;
  }
  return `${Math.floor(ageMs / 3_600_000)} hours`;
}

export function shortId(value: string): string {
  return value.length > 12 ? `${value.slice(0, 8)}...` : value;
}

export function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export function getJobRequestId(job: OpsQueueJob): string | null {
  const lineage = job.data?.lineage;
  if (!isRecord(lineage)) {
    return null;
  }
  return typeof lineage.requestId === "string" ? lineage.requestId : null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" && value !== null && !Array.isArray(value)
  );
}
