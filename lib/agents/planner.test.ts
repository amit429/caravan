import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGenerateObject = vi.fn();
const mockLogAgentRun = vi.fn();
const mockPostAgentMessage = vi.fn();
const mockDecisionsSelect = vi.fn();
const mockMembersSelect = vi.fn();
const mockFactsSelect = vi.fn();
const mockAvailabilitySelect = vi.fn();
const mockItinerariesUpsert = vi.fn();
const mockTripSelect = vi.fn();

vi.mock("ai", () => ({ generateObject: (...args: unknown[]) => mockGenerateObject(...args) }));
vi.mock("./runtime/log-run", () => ({ logAgentRun: (...args: unknown[]) => mockLogAgentRun(...args) }));
vi.mock("./runtime/post-agent-message", () => ({ postAgentMessage: (...args: unknown[]) => mockPostAgentMessage(...args) }));
vi.mock("./runtime/model", () => ({ flashModel: "mock-flash-model", estimateCost: () => 0 }));
vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => ({
    from: (table: string) => {
      if (table === "decisions") return { select: () => ({ eq: () => mockDecisionsSelect() }) };
      if (table === "members") return { select: () => ({ eq: () => ({ eq: () => mockMembersSelect() }) }) };
      if (table === "facts") return { select: () => ({ eq: () => ({ is: () => mockFactsSelect() }) }) };
      if (table === "availability") return { select: () => ({ eq: () => mockAvailabilitySelect() }) };
      if (table === "itineraries") return { upsert: (row: unknown, opts: unknown) => mockItinerariesUpsert(row, opts) };
      if (table === "trips") return { select: () => ({ eq: () => ({ single: () => mockTripSelect() }) }) };
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { runPlanner } from "./planner";

const destinationDecision = {
  type: "DESTINATION",
  state: "LOCKED",
  locked_option: "goa",
  options: [{ id: "goa", label: "Goa" }],
};

const threeDayPlan = {
  days: [
    { day: 1, title: "Arrival", activities: [{ time: "Evening", description: "Check in, beach walk" }, { time: "Night", description: "Dinner" }, { time: "Late", description: "Relax" }] },
    { day: 2, title: "Beach day", activities: [{ time: "Morning", description: "Beach" }, { time: "Afternoon", description: "Water sports" }, { time: "Evening", description: "Sunset" }] },
    { day: 3, title: "Departure", activities: [{ time: "Morning", description: "Pack" }, { time: "Afternoon", description: "Leave" }, { time: "Evening", description: "Home" }] },
  ],
};

beforeEach(() => {
  mockGenerateObject.mockReset();
  mockLogAgentRun.mockReset();
  mockPostAgentMessage.mockReset();
  mockItinerariesUpsert.mockReset().mockResolvedValue({ error: null });
  mockMembersSelect.mockReset().mockResolvedValue({ data: [{ id: "m1" }, { id: "m2" }], error: null });
  mockFactsSelect.mockReset().mockResolvedValue({ data: [], error: null });
  mockAvailabilitySelect.mockReset().mockResolvedValue({ data: [], error: null });
  mockDecisionsSelect.mockReset();
  mockTripSelect.mockReset().mockResolvedValue({ data: { preferred_trip_days: 7 }, error: null });
});

describe("runPlanner", () => {
  it("refuses to run without a locked destination", async () => {
    mockDecisionsSelect.mockResolvedValue({ data: [], error: null });
    const result = await runPlanner("trip-1");
    expect(result).toEqual({ ok: false, reason: expect.stringContaining("destination") });
    expect(mockGenerateObject).not.toHaveBeenCalled();
  });

  it("ignores an OPEN (not yet locked) destination decision", async () => {
    mockDecisionsSelect.mockResolvedValue({
      data: [{ ...destinationDecision, state: "OPEN", locked_option: null }],
      error: null,
    });
    const result = await runPlanner("trip-1");
    expect(result.ok).toBe(false);
  });

  it("generates and stores an itinerary once the destination is locked", async () => {
    mockDecisionsSelect.mockResolvedValue({ data: [destinationDecision], error: null });
    mockGenerateObject.mockResolvedValue({ object: threeDayPlan, usage: { inputTokens: 50, outputTokens: 300 } });

    const result = await runPlanner("trip-1");
    expect(result).toEqual({ ok: true });

    expect(mockItinerariesUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        trip_id: "trip-1",
        destination: "Goa",
        days: expect.arrayContaining([expect.objectContaining({ day: 1, title: "Arrival" })]),
      }),
      { onConflict: "trip_id" }
    );
    expect(mockPostAgentMessage).toHaveBeenCalledWith(
      expect.objectContaining({ agentName: "planner", body: expect.stringContaining("Goa") })
    );
  });

  it("falls back to the trip's preferred length when no dates are locked", async () => {
    mockDecisionsSelect.mockResolvedValue({ data: [destinationDecision], error: null });
    mockTripSelect.mockResolvedValue({ data: { preferred_trip_days: 10 }, error: null });
    mockGenerateObject.mockResolvedValue({ object: threeDayPlan, usage: { inputTokens: 50, outputTokens: 300 } });

    await runPlanner("trip-1");

    const prompt = mockGenerateObject.mock.calls[0][0].prompt as string;
    expect(prompt).toContain("10-day");
  });

  it("threads hard-no facts into the prompt", async () => {
    mockDecisionsSelect.mockResolvedValue({ data: [destinationDecision], error: null });
    mockFactsSelect.mockResolvedValue({
      data: [{ category: "hard_no", value: { items: ["No water sports"] } }],
      error: null,
    });
    mockGenerateObject.mockResolvedValue({ object: threeDayPlan, usage: { inputTokens: 50, outputTokens: 300 } });

    await runPlanner("trip-1");

    const prompt = mockGenerateObject.mock.calls[0][0].prompt as string;
    expect(prompt).toContain("No water sports");
  });

  it("returns a graceful error instead of throwing when generation fails", async () => {
    mockDecisionsSelect.mockResolvedValue({ data: [destinationDecision], error: null });
    mockGenerateObject.mockRejectedValue(new Error("rate limited"));

    const result = await runPlanner("trip-1");
    expect(result.ok).toBe(false);
    expect(mockItinerariesUpsert).not.toHaveBeenCalled();
    expect(mockLogAgentRun).toHaveBeenCalledWith(expect.objectContaining({ outcome: "error" }));
  });
});
