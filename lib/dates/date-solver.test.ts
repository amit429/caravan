import { describe, expect, it } from "vitest";
import { computeTopDateWindows, formatWindowLabel } from "./date-solver";
import type { AvailabilityRow } from "../database.types";

describe("formatWindowLabel", () => {
  it("formats a window as a short date range", () => {
    // Not asserting exact day/month ordering — that's locale-dependent
    // (toLocaleDateString with an undefined locale follows the runtime's
    // default, "27 Feb" vs "Feb 27"), just that both ends show up correctly
    // abbreviated and joined.
    const label = formatWindowLabel({ startDate: "2027-02-27", endDate: "2027-03-02" });
    expect(label).toContain("Feb");
    expect(label).toContain("27");
    expect(label).toContain("Mar");
    expect(label).toContain("2");
    expect(label).toContain(" – ");
  });
});

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

  it("collapses one long evenly-free stretch into a single option instead of chopping it into 3 slices", () => {
    // The reported bug: a member marks 27 Feb – 7 Mar free and 8–10 Mar
    // tight. Sliding a 4-day window across that span used to yield 3
    // arbitrary consecutive slices (27 Feb–2 Mar / 3–6 Mar / 7–10 Mar) that
    // were really just one continuous "everyone's free" run restated.
    const availability = [
      avail("m1", "2026-02-27", "2026-03-07", "free"),
      avail("m1", "2026-03-08", "2026-03-10", "partial"),
    ];
    const windows = computeTopDateWindows(availability, ["m1"], 4);
    expect(windows).toHaveLength(2);
    expect(windows[0].startDate).toBe("2026-02-27");
    expect(windows[0].membersIn).toEqual(["m1"]);
    expect(windows[1].membersPartial).toEqual(["m1"]);
  });

  it("lets a later-filed availability row win over an earlier one for the same day, in either direction", () => {
    // Span pinned to exactly the window length so there's only one possible
    // window — isolates the recency resolution itself from window selection.
    const olderFree = avail("m1", "2026-11-01", "2026-11-04", "free");
    const newerBlocked = { ...avail("m1", "2026-11-03", "2026-11-03", "blocked"), created_at: "2026-01-02T00:00:00Z" };
    const blocked = computeTopDateWindows([olderFree, newerBlocked], ["m1"], 4);
    // A chat "actually I can't make it" filed after the calendar submission
    // should win, even though "blocked" would normally lose to a wider
    // "free" submission under a worst-case merge — it's not about which
    // status is worse, it's about which is newer.
    expect(blocked[0].membersOut).toContain("m1");

    // And a still-newer "actually I can now" reverses it again.
    const newerFree = { ...avail("m1", "2026-11-03", "2026-11-03", "free"), created_at: "2026-01-03T00:00:00Z" };
    const reversed = computeTopDateWindows([olderFree, newerBlocked, newerFree], ["m1"], 4);
    expect(reversed[0].membersOut).not.toContain("m1");
    expect(reversed[0].membersIn).toContain("m1");
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
