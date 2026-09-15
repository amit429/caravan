import { describe, expect, it, vi, beforeEach } from "vitest";

const mockRunScout = vi.fn();
const mockRunCostEstimator = vi.fn();
const mockPostAgentMessage = vi.fn();

const mockMembersUpdate = vi.fn();
const mockFactsDelete = vi.fn();
const mockAvailabilityDelete = vi.fn();
const mockVotesDelete = vi.fn();
const mockIdeaVotesDelete = vi.fn();
const mockBookingStatusDelete = vi.fn();
const mockDecisionsSelect = vi.fn();
const mockDecisionsDelete = vi.fn();
const mockCostEstimateSelect = vi.fn();

vi.mock("@/lib/agents/scout", () => ({ runScout: (...args: unknown[]) => mockRunScout(...args) }));
vi.mock("@/lib/agents/cost-estimator", () => ({ runCostEstimator: (...args: unknown[]) => mockRunCostEstimator(...args) }));
vi.mock("@/lib/agents/runtime/post-agent-message", () => ({ postAgentMessage: (...args: unknown[]) => mockPostAgentMessage(...args) }));

vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => ({
    from: (table: string) => {
      if (table === "members") return { update: () => ({ eq: () => mockMembersUpdate() }) };
      if (table === "facts") return { delete: () => ({ eq: () => ({ eq: () => mockFactsDelete() }) }) };
      if (table === "availability") return { delete: () => ({ eq: () => ({ eq: () => mockAvailabilityDelete() }) }) };
      if (table === "votes") return { delete: () => ({ eq: () => mockVotesDelete() }) };
      if (table === "idea_votes") return { delete: () => ({ eq: () => mockIdeaVotesDelete() }) };
      if (table === "booking_status") return { delete: () => ({ eq: () => mockBookingStatusDelete() }) };
      if (table === "decisions") {
        return {
          select: () => ({ eq: () => ({ eq: () => mockDecisionsSelect() }) }),
          delete: () => ({ in: (...args: unknown[]) => mockDecisionsDelete(...args) }),
        };
      }
      if (table === "cost_estimates") return { select: () => ({ eq: () => ({ maybeSingle: () => mockCostEstimateSelect() }) }) };
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { removeMemberAndRerun } from "./remove-member";

beforeEach(() => {
  mockRunScout.mockReset().mockResolvedValue({ ok: true });
  mockRunCostEstimator.mockReset().mockResolvedValue({ ok: true });
  mockPostAgentMessage.mockReset();
  mockMembersUpdate.mockReset().mockResolvedValue({ error: null });
  mockFactsDelete.mockReset().mockResolvedValue({ error: null });
  mockAvailabilityDelete.mockReset().mockResolvedValue({ error: null });
  mockVotesDelete.mockReset().mockResolvedValue({ error: null });
  mockIdeaVotesDelete.mockReset().mockResolvedValue({ error: null });
  mockBookingStatusDelete.mockReset().mockResolvedValue({ error: null });
  mockDecisionsSelect.mockReset().mockResolvedValue({ data: [], error: null });
  mockDecisionsDelete.mockReset().mockResolvedValue({ error: null });
  mockCostEstimateSelect.mockReset().mockResolvedValue({ data: null, error: null });
});

describe("removeMemberAndRerun", () => {
  it("marks the member removed and purges their preference data", async () => {
    await removeMemberAndRerun("trip-1", "member-1");
    expect(mockMembersUpdate).toHaveBeenCalled();
    expect(mockFactsDelete).toHaveBeenCalled();
    expect(mockAvailabilityDelete).toHaveBeenCalled();
    expect(mockVotesDelete).toHaveBeenCalled();
    expect(mockIdeaVotesDelete).toHaveBeenCalled();
    expect(mockBookingStatusDelete).toHaveBeenCalled();
  });

  it("drops any non-locked destination decision and regenerates it", async () => {
    mockDecisionsSelect.mockResolvedValue({
      data: [{ id: "d1", state: "OPEN", type: "DESTINATION" }],
      error: null,
    });
    const result = await removeMemberAndRerun("trip-1", "member-1");
    expect(mockDecisionsDelete).toHaveBeenCalledWith("id", ["d1"]);
    expect(mockRunScout).toHaveBeenCalledWith("trip-1");
    expect(result.destinationRegenerated).toBe(true);
  });

  it("leaves a locked destination decision alone", async () => {
    mockDecisionsSelect.mockResolvedValue({
      data: [{ id: "d1", state: "LOCKED", type: "DESTINATION" }],
      error: null,
    });
    await removeMemberAndRerun("trip-1", "member-1");
    expect(mockDecisionsDelete).not.toHaveBeenCalled();
    expect(mockRunScout).not.toHaveBeenCalled();
  });

  it("re-estimates cost when a destination is locked and an estimate already exists", async () => {
    mockDecisionsSelect.mockResolvedValue({
      data: [{ id: "d1", state: "LOCKED", type: "DESTINATION" }],
      error: null,
    });
    mockCostEstimateSelect.mockResolvedValue({ data: { id: "est-1" }, error: null });
    const result = await removeMemberAndRerun("trip-1", "member-1");
    expect(mockRunCostEstimator).toHaveBeenCalledWith("trip-1");
    expect(result.costRegenerated).toBe(true);
  });

  it("skips cost re-estimation if none was ever generated", async () => {
    mockDecisionsSelect.mockResolvedValue({
      data: [{ id: "d1", state: "LOCKED", type: "DESTINATION" }],
      error: null,
    });
    mockCostEstimateSelect.mockResolvedValue({ data: null, error: null });
    await removeMemberAndRerun("trip-1", "member-1");
    expect(mockRunCostEstimator).not.toHaveBeenCalled();
  });

  it("posts an agent message when something was regenerated", async () => {
    mockDecisionsSelect.mockResolvedValue({
      data: [{ id: "d1", state: "OPEN", type: "DESTINATION" }],
      error: null,
    });
    await removeMemberAndRerun("trip-1", "member-1");
    expect(mockPostAgentMessage).toHaveBeenCalledWith(
      expect.objectContaining({ tripId: "trip-1", agentName: "concierge" })
    );
  });

  it("stays quiet when nothing needed regenerating", async () => {
    await removeMemberAndRerun("trip-1", "member-1");
    expect(mockPostAgentMessage).not.toHaveBeenCalled();
  });
});
