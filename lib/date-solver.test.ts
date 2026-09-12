import { describe, expect, it } from "vitest";
import { computeTopDateWindows } from "./date-solver";
import type { AvailabilityRow } from "./database.types";

function avail(
  memberId: string,
  startDate: string,
  endDate: string,
  strength: "free" | "partial" | "blocked" = "free"
): AvailabilityRow {
  return {
    id: `${memberId}-${startDate}`,
    trip_id: "trip-1",
    member_id: memberId,
    start_date: startDate,
    end_date: endDate,
    strength,
    created_at: "2026-01-01T00:00:00Z",
  };
}

describe("computeTopDateWindows", () => {
  it("returns nothing with no availability data", () => {
    expect(computeTopDateWindows([], ["m1"])).toEqual([]);
  });

  it("returns nothing when there are no active members", () => {
    expect(computeTopDateWindows([avail("m1", "2026-11-01", "2026-11-10")], [])).toEqual([]);
  });

  it("puts a fully-free member in membersIn for a window inside their range", () => {
    const windows = computeTopDateWindows([avail("m1", "2026-11-01", "2026-11-10")], ["m1"], 4);
    expect(windows.length).toBeGreaterThan(0);
    expect(windows[0].membersIn).toEqual(["m1"]);
    expect(windows[0].membersOut).toEqual([]);
  });

  it("scores the window where the most members overlap highest", () => {
    const availability = [
      avail("m1", "2026-11-01", "2026-11-10"),
      avail("m2", "2026-11-05", "2026-11-14"),
      avail("m3", "2026-11-08", "2026-11-20"),
    ];
    const windows = computeTopDateWindows(availability, ["m1", "m2", "m3"], 3);
    // Nov 8-10 is the only 3-day span all three of them are free for.
    expect(windows[0].startDate).toBe("2026-11-08");
    expect(windows[0].endDate).toBe("2026-11-10");
    expect(windows[0].membersIn.sort()).toEqual(["m1", "m2", "m3"]);
    expect(windows[0].score).toBe(3);
  });

  it("puts a member with a blocked day inside the window in membersOut, without excluding the window", () => {
    // Availability spans exactly one window's length, so there is no better-scoring
    // alternative window for the solver to prefer instead — this isolates the
    // classification logic itself rather than the window-selection ranking.
    const availability = [
      avail("m1", "2026-11-01", "2026-11-04"),
      avail("m2", "2026-11-01", "2026-11-04"),
      avail("m2", "2026-11-03", "2026-11-03", "blocked"),
    ];
    const windows = computeTopDateWindows(availability, ["m1", "m2"], 4);
    expect(windows).toHaveLength(1);
    expect(windows[0].membersOut).toContain("m2");
    expect(windows[0].membersIn).toContain("m1");
  });

  it("puts a member with a partial day (arriving late/leaving early) in membersPartial, weighted at 0.5", () => {
    const availability = [
      avail("m1", "2026-11-01", "2026-11-04"),
      avail("m2", "2026-11-01", "2026-11-04"),
      avail("m2", "2026-11-01", "2026-11-01", "partial"),
    ];
    const windows = computeTopDateWindows(availability, ["m1", "m2"], 4);
    expect(windows).toHaveLength(1);
    expect(windows[0].membersPartial).toContain("m2");
    expect(windows[0].membersIn).toContain("m1");
    expect(windows[0].score).toBe(1.5);
  });

  it("treats a member with no submitted availability as out, not partial", () => {
    const windows = computeTopDateWindows([avail("m1", "2026-11-01", "2026-11-10")], ["m1", "m2"], 4);
    expect(windows[0].membersOut).toContain("m2");
    expect(windows[0].membersPartial).not.toContain("m2");
  });

  it("returns at most 3 windows and never two that overlap", () => {
    const windows = computeTopDateWindows([avail("m1", "2026-11-01", "2026-11-30")], ["m1"], 3);
    expect(windows.length).toBeLessThanOrEqual(3);
    for (let i = 0; i < windows.length; i++) {
      for (let j = i + 1; j < windows.length; j++) {
        const overlaps = !(windows[i].endDate < windows[j].startDate || windows[i].startDate > windows[j].endDate);
        expect(overlaps).toBe(false);
      }
    }
  });
});
