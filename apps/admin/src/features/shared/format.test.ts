import { afterEach, describe, expect, it, vi } from "vitest";
import {
  daysFromNow,
  formatAge,
  formatDate,
  getJobRequestId,
  isRecord,
  shortId,
} from "./format";
import type { OpsQueueJob } from "#/domains/ops";

const now = new Date("2026-06-15T12:00:00.000Z");

afterEach(() => {
  vi.useRealTimers();
});

describe("admin format helpers", () => {
  it("formats missing dates and pending age", () => {
    expect(formatDate(null)).toBe("-");
    expect(formatAge(undefined)).toBe("No pending age");
  });

  it("formats age buckets from current time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);

    expect(formatAge("2026-06-15T11:59:45.000Z")).toBe("Under 1 minute");
    expect(formatAge("2026-06-15T11:57:30.000Z")).toBe("2 minutes");
    expect(formatAge("2026-06-15T08:45:00.000Z")).toBe("3 hours");
  });

  it("shortens long ids only", () => {
    expect(shortId("123456789012")).toBe("123456789012");
    expect(shortId("1234567890123")).toBe("12345678...");
  });

  it("creates deterministic future ISO dates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);

    expect(daysFromNow(2)).toBe("2026-06-17T12:00:00.000Z");
  });

  it("reads request id from queue lineage", () => {
    const job = createQueueJob({
      data: { lineage: { requestId: "req-1" } },
    });

    expect(getJobRequestId(job)).toBe("req-1");
    expect(getJobRequestId(createQueueJob({ data: null }))).toBeNull();
    expect(
      getJobRequestId(createQueueJob({ data: { lineage: "req-1" } })),
    ).toBeNull();
  });

  it("checks plain object records", () => {
    expect(isRecord({ requestId: "req-1" })).toBe(true);
    expect(isRecord(null)).toBe(false);
    expect(isRecord(["req-1"])).toBe(false);
  });
});

function createQueueJob(overrides: Partial<OpsQueueJob>): OpsQueueJob {
  return {
    id: "job-1",
    name: "test-job",
    state: "pending",
    retryCount: 0,
    retryLimit: 3,
    data: null,
    output: null,
    createdOn: null,
    startedOn: null,
    completedOn: null,
    ...overrides,
  };
}
