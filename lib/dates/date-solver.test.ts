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
    // Availability spans exactly the preferred length, so option 1 (the best
    // full-length window) is the one and only length-4 candidate — this
    // isolates the classification logic itself. Shorter windows elsewhere in
    // the span may still surface as options 2/3 (that's the multi-length
    // exploration working as intended), so this only asserts on option 1.
    const availability = [
      avail("m1", "2026-11-01", "2026-11-04"),
      avail("m2", "2026-11-01", "2026-11-04"),
      avail("m2", "2026-11-03", "2026-11-03", "blocked"),
    ];
    const windows = computeTopDateWindows(availability, ["m1", "m2"], 4);
    expect(windows[0].startDate).toBe("2026-11-01");
    expect(windows[0].endDate).toBe("2026-11-04");
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
    expect(windows[0].startDate).toBe("2026-11-01");
    expect(windows[0].endDate).toBe("2026-11-04");
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

  it("defaults to a 7-day preferred length when none is given", () => {
    const windows = computeTopDateWindows([avail("m1", "2026-11-01", "2026-11-20")], ["m1"]);
    expect(windows[0].endDate).toBe("2026-11-07"); // Nov 1 + 6 = a 7-day window
  });

  it("option 1 is always the best full-preferred-length window, even if a shorter window elsewhere fits more people", () => {
    // m1 is free the whole month; m2 only overlaps for a 3-day stretch.
    // A 7-day preference: option 1 must still be a real 7-day window (only
    // m1 fits it), not the 3-day window where both fit — that's what
    // options 2/3 are for.
    const availability = [avail("m1", "2026-11-01", "2026-11-30"), avail("m2", "2026-11-10", "2026-11-12")];
    const windows = computeTopDateWindows(availability, ["m1", "m2"], 7);
    expect(windows[0].startDate).toBe("2026-11-01");
    expect(windows[0].endDate).toBe("2026-11-07");
    expect(windows[0].membersIn).toEqual(["m1"]);
  });

  it("offers a shorter, more-inclusive window as option 2 when the full-length window doesn't fit everyone", () => {
    const availability = [avail("m1", "2026-11-01", "2026-11-30"), avail("m2", "2026-11-10", "2026-11-12")];
    const windows = computeTopDateWindows(availability, ["m1", "m2"], 7);
    expect(windows.length).toBeGreaterThanOrEqual(2);
    expect(windows[1].membersIn.sort()).toEqual(["m1", "m2"]);
    expect(windows[1].startDate).toBe("2026-11-10");
    expect(windows[1].endDate).toBe("2026-11-12");
    // The 3-day everyone-fits window beats the 7-day some-fit window on
    // attendance, but it's still ranked behind option 1, never ahead of it.
    expect(windows[1].score).toBeGreaterThan(windows[0].score);
  });

  it("lets a more-inclusive shorter window overlap option 1's date range, since they're alternative proposals, not a shared calendar grid", () => {
    // m1 free Feb22-Mar5, m2 free Feb27-Mar14, m3 free Feb24-Mar3. No 7-day
    // window fits everyone (the 3-way overlap is only Feb27-Mar3, 5 days),
    // so option 1 is the best 7-day window some pair fits, but a shorter
    // window where all THREE fit (within Feb27-Mar3) should still surface as
    // option 2, even though its dates sit inside option 1's range.
    const availability = [
      avail("m1", "2026-02-22", "2026-03-05"),
      avail("m2", "2026-02-27", "2026-03-14"),
      avail("m3", "2026-02-24", "2026-03-03"),
    ];
    const windows = computeTopDateWindows(availability, ["m1", "m2", "m3"], 7);
    expect(windows[0].membersIn.length + windows[0].membersPartial.length).toBeLessThan(3);
    const allThreeFit = windows.find((w) => w.membersIn.length === 3);
    expect(allThreeFit).toBeDefined();
  });

  it("does not surface a shorter slice of the exact same stretch option 1 already represents", () => {
    // Single member, free the whole span — every length/offset shares one
    // membership signature (only m1, fully in), so there's nothing left to
    // offer as options 2/3 even though "search down to 1 day" would
    // otherwise generate dozens of candidates here.
    const windows = computeTopDateWindows([avail("m1", "2026-11-01", "2026-11-30")], ["m1"], 7);
    expect(windows).toHaveLength(1);
  });

  it("clamps the preferred length to the actual data span instead of returning nothing", () => {
    const windows = computeTopDateWindows([avail("m1", "2026-11-01", "2026-11-04")], ["m1"], 14);
    expect(windows).toHaveLength(1);
    expect(windows[0].startDate).toBe("2026-11-01");
    expect(windows[0].endDate).toBe("2026-11-04");
  });
});
