import { describe, expect, it, vi, beforeEach } from "vitest";

const mockPostAgentMessage = vi.fn();
const mockDecisionsSelect = vi.fn();
const mockVotesSelect = vi.fn();
const mockDecisionsUpdate = vi.fn();
const mockMembersSelect = vi.fn();
const mockFactsSelect = vi.fn();
const mockMembersUpdate = vi.fn();

vi.mock("@/lib/agents/post-agent-message", () => ({ postAgentMessage: (...args: unknown[]) => mockPostAgentMessage(...args) }));

vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => ({
    from: (table: string) => {
      if (table === "decisions") {
        return {
          select: () => ({ eq: () => ({ in: () => mockDecisionsSelect() }) }),
          update: (patch: unknown) => ({ eq: () => mockDecisionsUpdate(patch) }),
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
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { sweepDecisions, sweepIntakeNudges } from "./chaser";

const NOW_ISO = new Date().toISOString();

function futureIso(hoursFromNow: number) {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

function pastIso(hoursAgo: number) {
  return new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
}

beforeEach(() => {
  mockPostAgentMessage.mockReset();
  mockDecisionsSelect.mockReset();
  mockVotesSelect.mockReset();
  mockDecisionsUpdate.mockReset().mockResolvedValue({ error: null });
  mockMembersSelect.mockReset();
  mockFactsSelect.mockReset();
  mockMembersUpdate.mockReset().mockResolvedValue({ error: null });
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

  it("does nothing for a decision with no deadline", async () => {
    mockDecisionsSelect.mockResolvedValue({
      data: [{ id: "d1", type: "DATES", state: "OPEN", options, deadline: null, reminded_at: null }],
      error: null,
    });

    await sweepDecisions("trip-1");

    expect(mockDecisionsUpdate).not.toHaveBeenCalled();
    expect(mockPostAgentMessage).not.toHaveBeenCalled();
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
  });
});
