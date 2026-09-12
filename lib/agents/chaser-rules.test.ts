import { describe, expect, it } from "vitest";
import { isPastDeadline, needsDeadlineReminder, nextNudgeTier } from "./chaser-rules";
import type { DecisionRow, MemberRow } from "@/lib/database.types";

const NOW = new Date("2026-11-10T12:00:00Z");

function decision(overrides: Partial<DecisionRow> = {}): DecisionRow {
  return {
    id: "d1",
    trip_id: "trip-1",
    type: "DATES",
    state: "OPEN",
    options: [],
    quorum_rule: "simple_majority",
    deadline: null,
    default_on_silence: "none",
    locked_option: null,
    rationale: null,
    locked_by: null,
    reminded_at: null,
    created_at: "2026-11-01T00:00:00Z",
    ...overrides,
  };
}

function member(overrides: Partial<MemberRow> = {}): MemberRow {
  return {
    id: "m1",
    trip_id: "trip-1",
    display_name: "Karan",
    email: "karan@example.com",
    role: "member",
    status: "active",
    device_token_hash: null,
    joined_at: "2026-11-09T12:00:00Z",
    nudge_tier: 0,
    flagged_at: null,
    ...overrides,
  };
}

describe("isPastDeadline", () => {
  it("is false with no deadline set", () => {
    expect(isPastDeadline(decision({ deadline: null }), NOW)).toBe(false);
  });

  it("is true once the deadline has passed on an open decision", () => {
    expect(isPastDeadline(decision({ deadline: "2026-11-10T11:00:00Z", state: "OPEN" }), NOW)).toBe(true);
  });

  it("is false before the deadline", () => {
    expect(isPastDeadline(decision({ deadline: "2026-11-10T13:00:00Z", state: "OPEN" }), NOW)).toBe(false);
  });

  it("is false for an already-locked decision, regardless of deadline", () => {
    expect(isPastDeadline(decision({ deadline: "2026-11-01T00:00:00Z", state: "LOCKED" }), NOW)).toBe(false);
  });
});

describe("needsDeadlineReminder", () => {
  it("is true when the deadline is within 24h and no reminder was sent yet", () => {
    expect(needsDeadlineReminder(decision({ deadline: "2026-11-11T06:00:00Z" }), NOW)).toBe(true);
  });

  it("is false when the deadline is more than 24h away", () => {
    expect(needsDeadlineReminder(decision({ deadline: "2026-11-13T00:00:00Z" }), NOW)).toBe(false);
  });

  it("is false when a reminder was already sent", () => {
    expect(
      needsDeadlineReminder(decision({ deadline: "2026-11-11T06:00:00Z", reminded_at: "2026-11-10T00:00:00Z" }), NOW)
    ).toBe(false);
  });

  it("is false once the deadline has already passed (that's isPastDeadline's job)", () => {
    expect(needsDeadlineReminder(decision({ deadline: "2026-11-10T00:00:00Z" }), NOW)).toBe(false);
  });
});

describe("nextNudgeTier", () => {
  it("returns null once intake is complete, regardless of elapsed time", () => {
    expect(nextNudgeTier(member({ joined_at: "2026-11-01T00:00:00Z" }), true, NOW)).toBeNull();
  });

  it("returns null before 24h has elapsed", () => {
    expect(nextNudgeTier(member({ joined_at: "2026-11-10T00:00:00Z" }), false, NOW)).toBeNull();
  });

  it("returns tier 1 at 24h for a member never nudged", () => {
    expect(nextNudgeTier(member({ joined_at: "2026-11-09T12:00:00Z", nudge_tier: 0 }), false, NOW)).toBe(1);
  });

  it("does not repeat tier 1 once already sent", () => {
    expect(nextNudgeTier(member({ joined_at: "2026-11-09T12:00:00Z", nudge_tier: 1 }), false, NOW)).toBeNull();
  });

  it("returns tier 2 at 48h for a member already at tier 1", () => {
    expect(nextNudgeTier(member({ joined_at: "2026-11-08T12:00:00Z", nudge_tier: 1 }), false, NOW)).toBe(2);
  });

  it("returns tier 3 at 72h for a member already at tier 2", () => {
    expect(nextNudgeTier(member({ joined_at: "2026-11-07T12:00:00Z", nudge_tier: 2 }), false, NOW)).toBe(3);
  });

  it("never regresses or repeats tier 3", () => {
    expect(nextNudgeTier(member({ joined_at: "2026-10-01T00:00:00Z", nudge_tier: 3 }), false, NOW)).toBeNull();
  });
});
