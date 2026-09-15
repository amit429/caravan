import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGenerateObject = vi.fn();
const mockLogAgentRun = vi.fn();
const mockPostAgentMessage = vi.fn();
const mockDecisionsSelect = vi.fn();
const mockMembersSelect = vi.fn();
const mockFactsSelect = vi.fn();
const mockUpsert = vi.fn();

vi.mock("ai", () => ({ generateObject: (...args: unknown[]) => mockGenerateObject(...args) }));
vi.mock("./log-run", () => ({ logAgentRun: (...args: unknown[]) => mockLogAgentRun(...args) }));
vi.mock("./post-agent-message", () => ({ postAgentMessage: (...args: unknown[]) => mockPostAgentMessage(...args) }));
vi.mock("./model", () => ({ flashModel: "mock-flash-model", estimateCost: () => 0 }));
vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => ({
    from: (table: string) => {
      if (table === "decisions") return { select: () => ({ eq: () => mockDecisionsSelect() }) };
      if (table === "members") return { select: () => ({ eq: () => ({ eq: () => mockMembersSelect() }) }) };
      if (table === "facts") return { select: () => ({ eq: () => ({ is: () => mockFactsSelect() }) }) };
      if (table === "cost_estimates") return { upsert: (row: unknown, opts: unknown) => mockUpsert(row, opts) };
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { runCostEstimator } from "./cost-estimator";

const lockedDestination = { type: "DESTINATION", state: "LOCKED", locked_option: "goa", options: [{ id: "goa", label: "Goa" }] };

beforeEach(() => {
  mockGenerateObject.mockReset();
  mockLogAgentRun.mockReset();
  mockPostAgentMessage.mockReset();
  mockUpsert.mockReset().mockResolvedValue({ error: null });
  mockDecisionsSelect.mockReset();
  mockMembersSelect.mockReset().mockResolvedValue({ data: [{ id: "m1" }, { id: "m2" }], error: null });
  mockFactsSelect.mockReset().mockResolvedValue({ data: [], error: null });
});

describe("runCostEstimator", () => {
  it("refuses without a locked destination", async () => {
    mockDecisionsSelect.mockResolvedValue({ data: [], error: null });
    const result = await runCostEstimator("trip-1");
    expect(result.ok).toBe(false);
    expect(mockGenerateObject).not.toHaveBeenCalled();
  });

  it("generates and stores an estimate, flagging members under the estimate", async () => {
    mockDecisionsSelect.mockResolvedValue({ data: [lockedDestination], error: null });
    mockFactsSelect.mockResolvedValue({
      data: [
        { member_id: "m1", category: "budget", value: { amount: 8000 } },
        { member_id: "m2", category: "budget", value: { amount: 18000 } },
      ],
      error: null,
    });
    mockGenerateObject.mockResolvedValue({
      object: { minPerHead: 15000, maxPerHead: 22000, assumptions: "Budget stay, shared travel." },
      usage: { inputTokens: 40, outputTokens: 60 },
    });

    const result = await runCostEstimator("trip-1");
    expect(result).toEqual({ ok: true });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ trip_id: "trip-1", destination: "Goa", min_per_head: 15000, max_per_head: 22000 }),
      { onConflict: "trip_id" }
    );
    expect(mockPostAgentMessage).toHaveBeenCalledWith(
      expect.objectContaining({ agentName: "quartermaster", body: expect.stringContaining("over") })
    );
  });

  it("posts a clean receipt when nobody is flagged", async () => {
    mockDecisionsSelect.mockResolvedValue({ data: [lockedDestination], error: null });
    mockGenerateObject.mockResolvedValue({
      object: { minPerHead: 5000, maxPerHead: 8000, assumptions: "Budget stay." },
      usage: { inputTokens: 40, outputTokens: 60 },
    });

    await runCostEstimator("trip-1");
    expect(mockPostAgentMessage).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.not.stringContaining("pushes") })
    );
  });

  it("returns a graceful error instead of throwing when generation fails", async () => {
    mockDecisionsSelect.mockResolvedValue({ data: [lockedDestination], error: null });
    mockGenerateObject.mockRejectedValue(new Error("rate limited"));

    const result = await runCostEstimator("trip-1");
    expect(result.ok).toBe(false);
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockLogAgentRun).toHaveBeenCalledWith(expect.objectContaining({ outcome: "error" }));
  });
});
