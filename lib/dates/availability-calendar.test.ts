import { describe, expect, it } from "vitest";
import { coalesceAvailability } from "./availability-calendar";

describe("coalesceAvailability", () => {
  it("merges consecutive same-strength days into one range", () => {
    const ranges = coalesceAvailability({
      "2026-11-12": "free",
      "2026-11-13": "free",
      "2026-11-14": "free",
    });
    expect(ranges).toEqual([{ startDate: "2026-11-12", endDate: "2026-11-14", strength: "free" }]);
  });

  it("splits on a strength change even across consecutive days", () => {
    const ranges = coalesceAvailability({
      "2026-11-12": "free",
      "2026-11-13": "partial",
    });
    expect(ranges).toEqual([
      { startDate: "2026-11-12", endDate: "2026-11-12", strength: "free" },
      { startDate: "2026-11-13", endDate: "2026-11-13", strength: "partial" },
    ]);
  });

  it("splits on a gap in dates even with the same strength", () => {
    const ranges = coalesceAvailability({
      "2026-11-12": "free",
      "2026-11-20": "free",
    });
    expect(ranges).toEqual([
      { startDate: "2026-11-12", endDate: "2026-11-12", strength: "free" },
      { startDate: "2026-11-20", endDate: "2026-11-20", strength: "free" },
    ]);
  });

  it("handles an empty selection", () => {
    expect(coalesceAvailability({})).toEqual([]);
  });

  it("merges a run that crosses a month boundary", () => {
    const ranges = coalesceAvailability({
      "2026-11-29": "blocked",
      "2026-11-30": "blocked",
      "2026-12-01": "blocked",
    });
    expect(ranges).toEqual([{ startDate: "2026-11-29", endDate: "2026-12-01", strength: "blocked" }]);
  });
});
