import { describe, expect, it, vi, beforeEach } from "vitest";

const mockPostAgentMessage = vi.fn();
const mockBroadcast = vi.fn();
const mockTripSelect = vi.fn();
const mockDecisionsSelect = vi.fn();
const mockDecisionsDelete = vi.fn();
const mockDecisionsInsert = vi.fn();
const mockMembersSelect = vi.fn();
const mockAvailabilitySelect = vi.fn();

vi.mock("@/lib/agents/runtime/post-agent-message", () => ({ postAgentMessage: (...args: unknown[]) => mockPostAgentMessage(...args) }));
vi.mock("@/lib/realtime/broadcast", () => ({ broadcastTripChange: (...args: unknown[]) => mockBroadcast(...args) }));

vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => ({
    from: (table: string) => {
      if (table === "trips") return { select: () => ({ eq: () => ({ single: () => mockTripSelect() }) }) };
      if (table === "decisions") {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ in: () => mockDecisionsSelect() }) }) }),
          delete: () => ({ eq: () => mockDecisionsDelete() }),
          insert: (row: unknown) => ({ select: () => ({ single: () => mockDecisionsInsert(row) }) }),
        };
      }
      if (table === "members") return { select: () => ({ eq: () => ({ eq: () => mockMembersSelect() }) }) };
      if (table === "availability") return { select: () => ({ eq: () => mockAvailabilitySelect() }) };
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { refreshDatesDecisionIfStale } from "./refresh-dates-decision";
import { formatWindowLabel } from "@/lib/dates/date-solver";

const activeMembers = [{ id: "m1" }, { id: "m2" }, { id: "m3" }];
// m1 & m2 free Feb27-Mar2; m3 has no availability at all, so at the default
// 7-day preferred length only m1/m2 fit any full window — matches the same
// shape as the live Bali 2027 trip this was built against.
const overlappingAvailability = [
  { member_id: "m1", start_date: "2027-02-27", end_date: "2027-03-05", strength: "free" },
  { member_id: "m2", start_date: "2027-02-27", end_date: "2027-03-05", strength: "free" },
];

beforeEach(() => {
  mockPostAgentMessage.mockReset();
  mockBroadcast.mockReset();
  mockTripSelect.mockReset().mockResolvedValue({ data: { preferred_trip_days: 7 }, error: null });
  mockDecisionsSelect.mockReset().mockResolvedValue({ data: [], error: null });
  mockDecisionsDelete.mockReset().mockResolvedValue({ error: null });
  mockDecisionsInsert.mockReset().mockResolvedValue({ data: { id: "d2" }, error: null });
  mockMembersSelect.mockReset().mockResolvedValue({ data: activeMembers, error: null });
  mockAvailabilitySelect.mockReset().mockResolvedValue({ data: [], error: null });
});

describe("refreshDatesDecisionIfStale", () => {
  it("does nothing when there's no open DATES decision", async () => {
    mockDecisionsSelect.mockResolvedValue({ data: [], error: null });
    await refreshDatesDecisionIfStale("trip-1", "availability");
    expect(mockDecisionsDelete).not.toHaveBeenCalled();
  });

  it("does nothing when the fresh computation matches the stored options exactly", async () => {
    mockAvailabilitySelect.mockResolvedValue({ data: overlappingAvailability, error: null });
    // Same label a fresh 7-day computation would already produce from this data.
    const label = formatWindowLabel({ startDate: "2027-02-27", endDate: "2027-03-05" });
    mockDecisionsSelect.mockResolvedValue({
      data: [{ id: "d1", type: "DATES", state: "OPEN", options: [{ id: "window-0", label }] }],
      error: null,
    });
    await refreshDatesDecisionIfStale("trip-1", "availability");
    expect(mockDecisionsDelete).not.toHaveBeenCalled();
    expect(mockPostAgentMessage).not.toHaveBeenCalled();
  });

  it("drops and recreates the decision, and posts a mention, when the fresh options differ", async () => {
    mockAvailabilitySelect.mockResolvedValue({ data: overlappingAvailability, error: null });
    mockDecisionsSelect.mockResolvedValue({
      data: [{ id: "d1", type: "DATES", state: "OPEN", options: [{ id: "window-0", label: "Jan 1 – Jan 7" }] }],
      error: null,
    });

    await refreshDatesDecisionIfStale("trip-1", "availability");

    expect(mockDecisionsDelete).toHaveBeenCalled();
    expect(mockDecisionsInsert).toHaveBeenCalled();
    const insertedRow = (mockDecisionsInsert.mock.calls[0]?.[0] ?? {}) as { type?: string; options?: unknown[] };
    expect(insertedRow.type).toBe("DATES");
    expect(insertedRow.options?.length).toBeGreaterThan(0);
    expect(mockPostAgentMessage).toHaveBeenCalledWith(
      expect.objectContaining({ agentName: "concierge", body: expect.stringContaining("Availability changed") })
    );
    expect(mockBroadcast).toHaveBeenCalledWith("trip-1");
  });

  it("uses duration-specific wording when the trigger is a duration change", async () => {
    mockAvailabilitySelect.mockResolvedValue({ data: overlappingAvailability, error: null });
    mockDecisionsSelect.mockResolvedValue({
      data: [{ id: "d1", type: "DATES", state: "OPEN", options: [{ id: "window-0", label: "Jan 1 – Jan 7" }] }],
      error: null,
    });

    await refreshDatesDecisionIfStale("trip-1", "duration");

    expect(mockPostAgentMessage).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringContaining("preferred trip length changed") })
    );
  });

  it("drops the decision without recreating when no windows can be computed anymore", async () => {
    mockAvailabilitySelect.mockResolvedValue({ data: [], error: null }); // everyone's availability got removed
    mockDecisionsSelect.mockResolvedValue({
      data: [{ id: "d1", type: "DATES", state: "OPEN", options: [{ id: "window-0", label: "Jan 1 – Jan 7" }] }],
      error: null,
    });

    await refreshDatesDecisionIfStale("trip-1", "availability");

    expect(mockDecisionsDelete).toHaveBeenCalled();
    expect(mockDecisionsInsert).not.toHaveBeenCalled();
    expect(mockPostAgentMessage).not.toHaveBeenCalled();
  });
});
