import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGenerateObject = vi.fn();
const mockLogAgentRun = vi.fn();
const mockPostAgentMessage = vi.fn();
const mockTripSelect = vi.fn();
const mockMembersSelect = vi.fn();
const mockFactsSelect = vi.fn();
const mockDecisionsInsert = vi.fn();

vi.mock("ai", () => ({ generateObject: (...args: unknown[]) => mockGenerateObject(...args) }));
vi.mock("./log-run", () => ({ logAgentRun: (...args: unknown[]) => mockLogAgentRun(...args) }));
vi.mock("./post-agent-message", () => ({ postAgentMessage: (...args: unknown[]) => mockPostAgentMessage(...args) }));
vi.mock("./model", () => ({ flashModel: "mock-flash-model", estimateCost: () => 0 }));
vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => ({
    from: (table: string) => {
      if (table === "trips") return { select: () => ({ eq: () => ({ single: () => mockTripSelect() }) }) };
      if (table === "members") return { select: () => ({ eq: () => ({ eq: () => mockMembersSelect() }) }) };
      if (table === "facts") return { select: () => ({ eq: () => ({ is: () => mockFactsSelect() }) }) };
      if (table === "decisions") return { insert: (row: unknown) => mockDecisionsInsert(row) };
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { runScout } from "./scout";

const threeOptions = {
  options: [
    { id: "a", label: "Goa", costPerHead: "₹12,000", travelTime: "6 hr", whyFits: "beach + budget", whoFitsWorst: "whoever wanted mountains" },
    { id: "b", label: "Gokarna", costPerHead: "₹9,000", travelTime: "8 hr", whyFits: "cheap and quiet", whoFitsWorst: "whoever wanted nightlife" },
    { id: "c", label: "Manali", costPerHead: "₹15,000", travelTime: "14 hr", whyFits: "mountains", whoFitsWorst: "whoever wanted a beach" },
  ],
};

beforeEach(() => {
  mockGenerateObject.mockReset();
  mockLogAgentRun.mockReset();
  mockPostAgentMessage.mockReset();
  mockDecisionsInsert.mockReset().mockResolvedValue({ error: null });
  mockTripSelect.mockReset().mockResolvedValue({ data: { name: "Goa, probably", rough_intent: null, vibe: [] }, error: null });
  mockMembersSelect.mockReset().mockResolvedValue({ data: [{ id: "m1" }, { id: "m2" }], error: null });
  mockFactsSelect.mockReset();
});

describe("runScout", () => {
  it("refuses to generate options with no budget facts yet", async () => {
    mockFactsSelect.mockResolvedValue({ data: [], error: null });
    const result = await runScout("trip-1");
    expect(result).toEqual({ ok: false, reason: expect.stringContaining("budget") });
    expect(mockGenerateObject).not.toHaveBeenCalled();
  });

  it("generates and stores 3 destination options once a budget exists", async () => {
    mockFactsSelect.mockResolvedValue({
      data: [
        { category: "budget", value: { amount: 15000 } },
        { category: "departure_city", value: { city: "Pune" } },
        { category: "vibe", value: { tags: ["Beach"] } },
        { category: "hard_no", value: { items: ["No overnight buses"] } },
      ],
      error: null,
    });
    mockGenerateObject.mockResolvedValue({ object: threeOptions, usage: { inputTokens: 100, outputTokens: 200 } });

    const result = await runScout("trip-1");
    expect(result).toEqual({ ok: true });

    const prompt = mockGenerateObject.mock.calls[0][0].prompt as string;
    expect(prompt).toContain("No overnight buses");
    expect(prompt).toContain("Pune");

    expect(mockDecisionsInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        trip_id: "trip-1",
        type: "DESTINATION",
        state: "OPEN",
        options: expect.arrayContaining([
          expect.objectContaining({ label: "Goa", meta: expect.objectContaining({ costPerHead: "₹12,000" }) }),
        ]),
      })
    );
    expect(mockPostAgentMessage).toHaveBeenCalledWith(
      expect.objectContaining({ agentName: "scout", body: expect.stringContaining("Goa") })
    );
  });

  it("returns a graceful error instead of throwing when the model call fails", async () => {
    mockFactsSelect.mockResolvedValue({ data: [{ category: "budget", value: { amount: 15000 } }], error: null });
    mockGenerateObject.mockRejectedValue(new Error("rate limited"));
    const result = await runScout("trip-1");
    expect(result.ok).toBe(false);
    expect(mockDecisionsInsert).not.toHaveBeenCalled();
    expect(mockLogAgentRun).toHaveBeenCalledWith(expect.objectContaining({ outcome: "error" }));
  });

  it("weighs the trip's original name/pitch, not just aggregated intake facts", async () => {
    mockTripSelect.mockResolvedValue({
      data: { name: "Bali 2027", rough_intent: "Friends trip to Bali", vibe: ["Beach"] },
      error: null,
    });
    mockFactsSelect.mockResolvedValue({ data: [{ category: "budget", value: { amount: 15000 } }], error: null });
    mockGenerateObject.mockResolvedValue({ object: threeOptions, usage: { inputTokens: 100, outputTokens: 200 } });

    await runScout("trip-1");
    const prompt = mockGenerateObject.mock.calls[0][0].prompt as string;
    expect(prompt).toContain("Bali 2027");
    expect(prompt).toContain("Friends trip to Bali");
  });
});
