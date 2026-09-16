import { describe, expect, it, vi, beforeEach } from "vitest";

const mockPostAgentMessage = vi.fn();
const mockDecisionsSelect = vi.fn(); // sweepDecisions: .select().eq('trip_id').in('state', [...])
const mockDecisionsTypesSelect = vi.fn(); // sweepAutoGeneration: .select('type').eq('trip_id') — no .in()
const mockDateOutreachDecisionsSelect = vi.fn(); // sweepDateOutreach: .select().eq('trip_id').eq('type','DATES').in('state', [...])
const mockDecisionsInsert = vi.fn();
const mockVotesSelect = vi.fn();
const mockDecisionsUpdate = vi.fn();
const mockMembersSelect = vi.fn();
const mockFactsSelect = vi.fn();
const mockAvailabilitySelect = vi.fn();
const mockMembersUpdate = vi.fn();
const mockBroadcast = vi.fn();
const mockHandleDecisionLocked = vi.fn();
const mockRunScout = vi.fn();
const mockRunDateOutreach = vi.fn();
const mockRunDigest = vi.fn();
const mockEnsureThread = vi.fn();
const mockNudgesSelect = vi.fn();
const mockNudgesInsert = vi.fn();
const mockTripSelect = vi.fn();
const mockLastDigestSelect = vi.fn();
const mockNewMessagesSelect = vi.fn();

vi.mock("@/lib/agents/runtime/post-agent-message", () => ({ postAgentMessage: (...args: unknown[]) => mockPostAgentMessage(...args) }));
vi.mock("@/lib/realtime/broadcast", () => ({ broadcastTripChange: (...args: unknown[]) => mockBroadcast(...args) }));
vi.mock("@/lib/decisions/on-decision-locked", () => ({
  handleDecisionLocked: (...args: unknown[]) => mockHandleDecisionLocked(...args),
}));
vi.mock("@/lib/agents/scout", () => ({ runScout: (...args: unknown[]) => mockRunScout(...args) }));
vi.mock("@/lib/agents/date-outreach", () => ({ runDateOutreach: (...args: unknown[]) => mockRunDateOutreach(...args) }));
vi.mock("@/lib/agents/digest", () => ({ runDigest: (...args: unknown[]) => mockRunDigest(...args) }));
vi.mock("@/lib/threads/ensure-thread", () => ({ ensureThread: (...args: unknown[]) => mockEnsureThread(...args) }));

// Chainable + thenable builder for messages: neither of sweepDigest's two
// queries ends in .single(), so the whole chain gets awaited directly — one
// shared builder distinguishes which query it was by whether .limit() was
// called (only the "last digest" lookup uses it).
function messagesQueryBuilder() {
  let usedLimit = false;
  const builder = {
    eq: () => builder,
    contains: () => builder,
    gt: () => builder,
    order: () => builder,
    limit: () => {
      usedLimit = true;
      return builder;
    },
    then: (resolve: (v: unknown) => void) => resolve(usedLimit ? mockLastDigestSelect() : mockNewMessagesSelect()),
  };
  return builder;
}

vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => ({
    from: (table: string) => {
      if (table === "decisions") {
        return {
          // Three shapes share the same eq() return: sweepDecisions chains
          // .in('state', [...]) off it, sweepAutoGeneration awaits it
          // directly (no .in() call — a bare `await` on a plain object
          // invokes its own `.then`, same as any thenable), and
          // sweepDateOutreach chains a second .eq() then .in() off it.
          select: () => ({
            eq: () => ({
              in: () => mockDecisionsSelect(),
              then: (resolve: (v: unknown) => void) => resolve(mockDecisionsTypesSelect()),
              eq: () => ({ in: () => mockDateOutreachDecisionsSelect() }),
            }),
          }),
          update: (patch: unknown) => ({ eq: () => mockDecisionsUpdate(patch) }),
          insert: (row: unknown) => ({ select: () => ({ single: () => mockDecisionsInsert(row) }) }),
        };
      }
      if (table === "votes") {
        return { select: () => ({ eq: () => mockVotesSelect() }) };
      }
      if (table === "members") {
        return {
          select: () => ({ eq: () => ({ eq: () => mockMembersSelect() }) }),
          update: (patch: unknown) => ({
            eq: () => mockMembersUpdate(patch),
            in: () => mockMembersUpdate(patch),
          }),
        };
      }
      if (table === "facts") {
        return { select: () => ({ eq: () => mockFactsSelect() }) };
      }
      if (table === "availability") {
        return { select: () => ({ eq: () => mockAvailabilitySelect() }) };
      }
      if (table === "date_outreach_nudges") {
        return {
          select: () => ({ eq: () => mockNudgesSelect() }),
          insert: (row: unknown) => mockNudgesInsert(row),
        };
      }
      if (table === "trips") {
        return { select: () => ({ eq: () => ({ single: () => mockTripSelect() }) }) };
      }
      if (table === "messages") {
        return { select: () => messagesQueryBuilder() };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { sweepDecisions, sweepAutoGeneration, sweepDateOutreach, sweepDigest, sweepIntakeNudges } from "./chaser";

const NOW_ISO = new Date().toISOString();

function futureIso(hoursFromNow: number) {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

function pastIso(hoursAgo: number) {
  return new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
}

beforeEach(() => {
  mockPostAgentMessage.mockReset();
  mockDecisionsSelect.mockReset().mockResolvedValue({ data: [], error: null });
  mockDecisionsTypesSelect.mockReset().mockResolvedValue({ data: [], error: null });
  mockDateOutreachDecisionsSelect.mockReset().mockResolvedValue({ data: [], error: null });
  mockDecisionsInsert.mockReset().mockResolvedValue({ data: null, error: null });
  mockVotesSelect.mockReset().mockResolvedValue({ data: [], error: null });
  mockDecisionsUpdate.mockReset().mockResolvedValue({ error: null });
  // Default: no active members — every "everyone did X" check with an empty
  // roster stays false, so existing tests that never configured this keep
  // exercising exactly the behavior they did before members/quorum existed.
  mockMembersSelect.mockReset().mockResolvedValue({ data: [], error: null });
  mockFactsSelect.mockReset().mockResolvedValue({ data: [], error: null });
  mockAvailabilitySelect.mockReset().mockResolvedValue({ data: [], error: null });
  mockMembersUpdate.mockReset().mockResolvedValue({ error: null });
  mockBroadcast.mockReset();
  mockHandleDecisionLocked.mockReset();
  mockRunScout.mockReset().mockResolvedValue({ ok: true });
  mockRunDateOutreach.mockReset().mockResolvedValue({ posted: true });
  mockRunDigest.mockReset().mockResolvedValue({ posted: true });
  mockEnsureThread.mockReset().mockResolvedValue("thread-1");
  mockNudgesSelect.mockReset().mockResolvedValue({ data: [], error: null });
  mockNudgesInsert.mockReset().mockResolvedValue({ error: null });
  mockTripSelect.mockReset().mockResolvedValue({ data: { created_at: pastIso(100) }, error: null });
  mockLastDigestSelect.mockReset().mockResolvedValue({ data: [], error: null });
  mockNewMessagesSelect.mockReset().mockResolvedValue({ data: [], error: null });
});

describe("sweepDecisions", () => {
  const options = [
    { id: "goa", label: "Goa" },
    { id: "manali", label: "Manali" },
  ];

  it("locks the decision with the most votes once its deadline has passed", async () => {
    mockDecisionsSelect.mockResolvedValue({
      data: [
        {
          id: "d1",
          type: "DATES",
          state: "OPEN",
          options,
          deadline: pastIso(1),
          reminded_at: null,
        },
      ],
      error: null,
    });
    mockVotesSelect.mockResolvedValue({
      data: [
        { option_id: "goa", is_veto: false },
        { option_id: "goa", is_veto: false },
      ],
      error: null,
    });

    await sweepDecisions("trip-1");

    expect(mockDecisionsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ state: "LOCKED", locked_option: "goa" })
    );
    expect(mockPostAgentMessage).toHaveBeenCalledWith(
      expect.objectContaining({ agentName: "chaser", body: expect.stringContaining("Goa") })
    );
    expect(mockHandleDecisionLocked).toHaveBeenCalledWith("trip-1", { type: "DATES" });
  });

  it("clears the deadline instead of guessing when nobody voted at all", async () => {
    mockDecisionsSelect.mockResolvedValue({
      data: [{ id: "d1", type: "DATES", state: "OPEN", options, deadline: pastIso(1), reminded_at: null }],
      error: null,
    });
    mockVotesSelect.mockResolvedValue({ data: [], error: null });

    await sweepDecisions("trip-1");

    expect(mockDecisionsUpdate).toHaveBeenCalledWith({ deadline: null });
    expect(mockDecisionsUpdate).not.toHaveBeenCalledWith(expect.objectContaining({ state: "LOCKED" }));
    expect(mockHandleDecisionLocked).not.toHaveBeenCalled();
  });

  it("sends a reminder and stamps reminded_at when the deadline is within 24h", async () => {
    mockDecisionsSelect.mockResolvedValue({
      data: [{ id: "d1", type: "DESTINATION", state: "VOTING", options, deadline: futureIso(6), reminded_at: null }],
      error: null,
    });

    await sweepDecisions("trip-1");

    expect(mockDecisionsUpdate).toHaveBeenCalledWith(expect.objectContaining({ reminded_at: expect.any(String) }));
    expect(mockPostAgentMessage).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringContaining("24h") })
    );
  });

  it("does nothing for a decision with no deadline and no votes yet", async () => {
    mockDecisionsSelect.mockResolvedValue({
      data: [{ id: "d1", type: "DATES", state: "OPEN", options, deadline: null, reminded_at: null }],
      error: null,
    });

    await sweepDecisions("trip-1");

    expect(mockDecisionsUpdate).not.toHaveBeenCalled();
    expect(mockPostAgentMessage).not.toHaveBeenCalled();
  });

  it("auto-locks with no deadline at all once every active member has voted", async () => {
    mockMembersSelect.mockResolvedValue({ data: [{ id: "m1" }, { id: "m2" }], error: null });
    mockDecisionsSelect.mockResolvedValue({
      data: [{ id: "d1", type: "DESTINATION", state: "OPEN", options, deadline: null, reminded_at: null }],
      error: null,
    });
    mockVotesSelect.mockResolvedValue({
      data: [
        { option_id: "goa", is_veto: false, member_id: "m1" },
        { option_id: "goa", is_veto: false, member_id: "m2" },
      ],
      error: null,
    });

    await sweepDecisions("trip-1");

    expect(mockDecisionsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ state: "LOCKED", locked_option: "goa", rationale: expect.stringContaining("everyone's voted") })
    );
    expect(mockPostAgentMessage).toHaveBeenCalledWith(
      expect.objectContaining({ agentName: "chaser", body: expect.stringContaining("Goa") })
    );
    expect(mockHandleDecisionLocked).toHaveBeenCalledWith("trip-1", { type: "DESTINATION" });
  });

  it("does not quorum-lock until every active member has voted, not just most of them", async () => {
    mockMembersSelect.mockResolvedValue({ data: [{ id: "m1" }, { id: "m2" }, { id: "m3" }], error: null });
    mockDecisionsSelect.mockResolvedValue({
      data: [{ id: "d1", type: "DESTINATION", state: "OPEN", options, deadline: null, reminded_at: null }],
      error: null,
    });
    mockVotesSelect.mockResolvedValue({
      data: [{ option_id: "goa", is_veto: false, member_id: "m1" }],
      error: null,
    });

    await sweepDecisions("trip-1");

    expect(mockDecisionsUpdate).not.toHaveBeenCalled();
    expect(mockHandleDecisionLocked).not.toHaveBeenCalled();
  });

  it("does not quorum-lock when everyone voted but the only option left is vetoed", async () => {
    mockMembersSelect.mockResolvedValue({ data: [{ id: "m1" }, { id: "m2" }], error: null });
    mockDecisionsSelect.mockResolvedValue({
      data: [{ id: "d1", type: "DESTINATION", state: "OPEN", options: [{ id: "goa", label: "Goa" }], deadline: null, reminded_at: null }],
      error: null,
    });
    mockVotesSelect.mockResolvedValue({
      data: [
        { option_id: "goa", is_veto: true, member_id: "m1" },
        { option_id: "goa", is_veto: false, member_id: "m2" },
      ],
      error: null,
    });

    await sweepDecisions("trip-1");

    expect(mockDecisionsUpdate).not.toHaveBeenCalled();
    expect(mockHandleDecisionLocked).not.toHaveBeenCalled();
  });
});

describe("sweepAutoGeneration", () => {
  it("does nothing when the trip has no active members", async () => {
    mockMembersSelect.mockResolvedValue({ data: [], error: null });
    await sweepAutoGeneration("trip-1");
    expect(mockRunScout).not.toHaveBeenCalled();
    expect(mockDecisionsInsert).not.toHaveBeenCalled();
  });

  it("auto-runs Scout once every active member has a fact and no destination decision exists", async () => {
    mockMembersSelect.mockResolvedValue({ data: [{ id: "m1" }, { id: "m2" }], error: null });
    mockFactsSelect.mockResolvedValue({ data: [{ member_id: "m1" }, { member_id: "m2" }], error: null });
    mockDecisionsTypesSelect.mockResolvedValue({ data: [], error: null });

    await sweepAutoGeneration("trip-1");

    expect(mockRunScout).toHaveBeenCalledWith("trip-1");
  });

  it("does not re-run Scout once a destination decision already exists", async () => {
    mockMembersSelect.mockResolvedValue({ data: [{ id: "m1" }], error: null });
    mockFactsSelect.mockResolvedValue({ data: [{ member_id: "m1" }], error: null });
    mockDecisionsTypesSelect.mockResolvedValue({ data: [{ type: "DESTINATION" }], error: null });

    await sweepAutoGeneration("trip-1");

    expect(mockRunScout).not.toHaveBeenCalled();
  });

  it("does not run Scout until every active member has at least one fact", async () => {
    mockMembersSelect.mockResolvedValue({ data: [{ id: "m1" }, { id: "m2" }], error: null });
    mockFactsSelect.mockResolvedValue({ data: [{ member_id: "m1" }], error: null }); // m2 hasn't answered
    mockDecisionsTypesSelect.mockResolvedValue({ data: [], error: null });

    await sweepAutoGeneration("trip-1");

    expect(mockRunScout).not.toHaveBeenCalled();
  });

  it("auto-creates a DATES decision once every active member has shared availability", async () => {
    mockMembersSelect.mockResolvedValue({ data: [{ id: "m1" }, { id: "m2" }], error: null });
    mockDecisionsTypesSelect.mockResolvedValue({ data: [], error: null });
    mockAvailabilitySelect.mockResolvedValue({
      data: [
        { member_id: "m1", start_date: "2026-11-01", end_date: "2026-11-10", strength: "free" },
        { member_id: "m2", start_date: "2026-11-03", end_date: "2026-11-12", strength: "free" },
      ],
      error: null,
    });
    mockDecisionsInsert.mockResolvedValue({
      data: { id: "d1", type: "DATES", options: [{ id: "window-0", label: "Nov 3 – Nov 6" }], deadline: null },
      error: null,
    });

    await sweepAutoGeneration("trip-1");

    expect(mockDecisionsInsert).toHaveBeenCalled();
    const insertedRow = (mockDecisionsInsert.mock.calls[0]?.[0] ?? {}) as { type?: string; options?: unknown[] };
    expect(insertedRow.type).toBe("DATES");
    expect(insertedRow.options?.length).toBeGreaterThan(0);
    expect(mockPostAgentMessage).toHaveBeenCalledWith(expect.objectContaining({ agentName: "concierge" }));
    expect(mockBroadcast).toHaveBeenCalledWith("trip-1");
  });

  it("does not create a second DATES decision once one already exists", async () => {
    mockMembersSelect.mockResolvedValue({ data: [{ id: "m1" }], error: null });
    mockDecisionsTypesSelect.mockResolvedValue({ data: [{ type: "DATES" }], error: null });
    mockAvailabilitySelect.mockResolvedValue({
      data: [{ member_id: "m1", start_date: "2026-11-01", end_date: "2026-11-10", strength: "free" }],
      error: null,
    });

    await sweepAutoGeneration("trip-1");

    expect(mockDecisionsInsert).not.toHaveBeenCalled();
  });

  it("does not create a DATES decision until every active member has shared availability", async () => {
    mockMembersSelect.mockResolvedValue({ data: [{ id: "m1" }, { id: "m2" }], error: null });
    mockDecisionsTypesSelect.mockResolvedValue({ data: [], error: null });
    mockAvailabilitySelect.mockResolvedValue({
      data: [{ member_id: "m1", start_date: "2026-11-01", end_date: "2026-11-10", strength: "free" }], // m2 hasn't shared
      error: null,
    });

    await sweepAutoGeneration("trip-1");

    expect(mockDecisionsInsert).not.toHaveBeenCalled();
  });
});

describe("sweepDateOutreach", () => {
  const activeMembers = [
    { id: "m1", display_name: "Amit" },
    { id: "m2", display_name: "Rhea" },
    { id: "m3", display_name: "Karan" },
  ];
  // m1 and m2 both free Nov 3-6; m3 has no availability at all, so they're
  // "out" of the only window the solver produces from this span.
  const majorityFitAvailability = [
    { member_id: "m1", start_date: "2026-11-03", end_date: "2026-11-06", strength: "free" },
    { member_id: "m2", start_date: "2026-11-03", end_date: "2026-11-06", strength: "free" },
  ];

  it("does nothing when there's no open DATES decision", async () => {
    mockDateOutreachDecisionsSelect.mockResolvedValue({ data: [], error: null });
    await sweepDateOutreach("trip-1");
    expect(mockRunDateOutreach).not.toHaveBeenCalled();
  });

  it("nudges the minority member once a majority fits the leading window but not everyone does", async () => {
    mockDateOutreachDecisionsSelect.mockResolvedValue({ data: [{ id: "d1", type: "DATES", state: "OPEN" }], error: null });
    mockMembersSelect.mockResolvedValue({ data: activeMembers, error: null });
    mockAvailabilitySelect.mockResolvedValue({ data: majorityFitAvailability, error: null });
    mockNudgesSelect.mockResolvedValue({ data: [], error: null });

    await sweepDateOutreach("trip-1");

    expect(mockEnsureThread).toHaveBeenCalledWith("trip-1", "m3", expect.anything());
    expect(mockRunDateOutreach).toHaveBeenCalledWith(
      "trip-1",
      "thread-1",
      expect.objectContaining({ id: "m3" }),
      expect.objectContaining({ startDate: "2026-11-03", endDate: "2026-11-06" }),
      2,
      3
    );
    expect(mockNudgesInsert).toHaveBeenCalledWith({ decision_id: "d1", member_id: "m3" });
  });

  it("does not nudge a member already nudged for this decision", async () => {
    mockDateOutreachDecisionsSelect.mockResolvedValue({ data: [{ id: "d1", type: "DATES", state: "OPEN" }], error: null });
    mockMembersSelect.mockResolvedValue({ data: activeMembers, error: null });
    mockAvailabilitySelect.mockResolvedValue({ data: majorityFitAvailability, error: null });
    mockNudgesSelect.mockResolvedValue({ data: [{ member_id: "m3" }], error: null });

    await sweepDateOutreach("trip-1");

    expect(mockRunDateOutreach).not.toHaveBeenCalled();
  });

  it("does not nudge anyone once everyone fits the leading window", async () => {
    mockDateOutreachDecisionsSelect.mockResolvedValue({ data: [{ id: "d1", type: "DATES", state: "OPEN" }], error: null });
    mockMembersSelect.mockResolvedValue({ data: [{ id: "m1", display_name: "Amit" }, { id: "m2", display_name: "Rhea" }], error: null });
    mockAvailabilitySelect.mockResolvedValue({ data: majorityFitAvailability, error: null });

    await sweepDateOutreach("trip-1");

    expect(mockRunDateOutreach).not.toHaveBeenCalled();
  });

  it("does not record a nudge if the outreach message failed to post", async () => {
    mockDateOutreachDecisionsSelect.mockResolvedValue({ data: [{ id: "d1", type: "DATES", state: "OPEN" }], error: null });
    mockMembersSelect.mockResolvedValue({ data: activeMembers, error: null });
    mockAvailabilitySelect.mockResolvedValue({ data: majorityFitAvailability, error: null });
    mockNudgesSelect.mockResolvedValue({ data: [], error: null });
    mockRunDateOutreach.mockResolvedValue({ posted: false });

    await sweepDateOutreach("trip-1");

    expect(mockNudgesInsert).not.toHaveBeenCalled();
  });
});

describe("sweepDigest", () => {
  it("does nothing when fewer than 3 hours have passed since the last digest", async () => {
    mockLastDigestSelect.mockResolvedValue({ data: [{ created_at: pastIso(1) }], error: null });
    await sweepDigest("trip-1");
    expect(mockRunDigest).not.toHaveBeenCalled();
  });

  it("does nothing when 3+ hours have passed but there hasn't been enough discussion", async () => {
    mockLastDigestSelect.mockResolvedValue({ data: [{ created_at: pastIso(5) }], error: null });
    mockNewMessagesSelect.mockResolvedValue({
      data: [
        { body: "hi", author_type: "member" },
        { body: "hey", author_type: "member" },
      ],
      error: null,
    });
    await sweepDigest("trip-1");
    expect(mockRunDigest).not.toHaveBeenCalled();
  });

  it("runs the digest once 3+ hours have passed and enough members have posted", async () => {
    mockLastDigestSelect.mockResolvedValue({ data: [{ created_at: pastIso(5) }], error: null });
    const messages = Array.from({ length: 5 }, (_, i) => ({ body: `msg ${i}`, author_type: "member" as const }));
    mockNewMessagesSelect.mockResolvedValue({ data: messages, error: null });

    await sweepDigest("trip-1");

    expect(mockRunDigest).toHaveBeenCalledWith("trip-1", messages);
  });

  it("falls back to trip creation time when no digest has ever been posted", async () => {
    mockTripSelect.mockResolvedValue({ data: { created_at: pastIso(10) }, error: null });
    mockLastDigestSelect.mockResolvedValue({ data: [], error: null });
    const messages = Array.from({ length: 5 }, (_, i) => ({ body: `msg ${i}`, author_type: "member" as const }));
    mockNewMessagesSelect.mockResolvedValue({ data: messages, error: null });

    await sweepDigest("trip-1");

    expect(mockRunDigest).toHaveBeenCalledWith("trip-1", messages);
  });

  it("doesn't count agent messages toward the volume threshold", async () => {
    mockLastDigestSelect.mockResolvedValue({ data: [{ created_at: pastIso(5) }], error: null });
    mockNewMessagesSelect.mockResolvedValue({
      data: [
        { body: "a", author_type: "member" },
        { body: "b", author_type: "agent" },
        { body: "c", author_type: "agent" },
        { body: "d", author_type: "agent" },
        { body: "e", author_type: "agent" },
      ],
      error: null,
    });
    await sweepDigest("trip-1");
    expect(mockRunDigest).not.toHaveBeenCalled();
  });
});

describe("sweepIntakeNudges", () => {
  function memberRow(overrides: Record<string, unknown>) {
    return {
      id: "m",
      display_name: "Member",
      joined_at: NOW_ISO,
      nudge_tier: 0,
      ...overrides,
    };
  }

  it("batches everyone crossing the 24h mark into one tier-1 message", async () => {
    mockMembersSelect.mockResolvedValue({
      data: [
        memberRow({ id: "m1", display_name: "Karan", joined_at: pastIso(30), nudge_tier: 0 }),
        memberRow({ id: "m2", display_name: "Farhan", joined_at: pastIso(25), nudge_tier: 0 }),
        memberRow({ id: "m3", display_name: "Rhea", joined_at: pastIso(1), nudge_tier: 0 }), // too soon
      ],
      error: null,
    });
    mockFactsSelect.mockResolvedValue({ data: [], error: null });

    await sweepIntakeNudges("trip-1");

    expect(mockPostAgentMessage).toHaveBeenCalledTimes(1);
    expect(mockPostAgentMessage).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringMatching(/Karan.*Farhan|Farhan.*Karan/) })
    );
    expect(mockMembersUpdate).toHaveBeenCalledWith({ nudge_tier: 1 });
  });

  it("skips members who already completed intake", async () => {
    mockMembersSelect.mockResolvedValue({
      data: [memberRow({ id: "m1", display_name: "Karan", joined_at: pastIso(30), nudge_tier: 0 })],
      error: null,
    });
    mockFactsSelect.mockResolvedValue({ data: [{ member_id: "m1" }], error: null });

    await sweepIntakeNudges("trip-1");

    expect(mockPostAgentMessage).not.toHaveBeenCalled();
  });

  it("silently flags a member at 72h without posting a group message", async () => {
    mockMembersSelect.mockResolvedValue({
      data: [memberRow({ id: "m1", display_name: "Karan", joined_at: pastIso(80), nudge_tier: 2 })],
      error: null,
    });
    mockFactsSelect.mockResolvedValue({ data: [], error: null });

    await sweepIntakeNudges("trip-1");

    expect(mockPostAgentMessage).not.toHaveBeenCalled();
    expect(mockMembersUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ nudge_tier: 3, flagged_at: expect.any(String) })
    );
    expect(mockBroadcast).toHaveBeenCalledWith("trip-1");
  });
});
