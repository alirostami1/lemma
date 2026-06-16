import { describe, expect, it } from "vitest";
import { formatStableDateTime } from "./date-format";

describe("formatStableDateTime", () => {
  it("formats dates with stable UTC output", () => {
    expect(formatStableDateTime(new Date("2026-01-02T03:04:00Z"))).toBe(
      "Jan 2, 2026, 3:04 AM UTC",
    );
  });

  it("handles noon and midnight without runtime locale state", () => {
    expect(formatStableDateTime(new Date("2026-06-14T00:00:00Z"))).toBe(
      "Jun 14, 2026, 12:00 AM UTC",
    );
    expect(formatStableDateTime(new Date("2026-06-14T12:30:00Z"))).toBe(
      "Jun 14, 2026, 12:30 PM UTC",
    );
  });
});
