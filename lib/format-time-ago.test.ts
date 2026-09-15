import { describe, expect, it } from "vitest";
import { formatTimeAgo } from "./format-time-ago";

const now = new Date("2026-01-01T12:00:00Z");

describe("formatTimeAgo", () => {
  it("returns 'just now' for under a minute", () => {
    expect(formatTimeAgo("2026-01-01T11:59:30Z", now)).toBe("just now");
  });

  it("formats minutes", () => {
    expect(formatTimeAgo("2026-01-01T11:45:00Z", now)).toBe("15m ago");
  });

  it("formats hours", () => {
    expect(formatTimeAgo("2026-01-01T09:00:00Z", now)).toBe("3h ago");
  });

  it("formats days", () => {
    expect(formatTimeAgo("2025-12-30T12:00:00Z", now)).toBe("2d ago");
  });
});
