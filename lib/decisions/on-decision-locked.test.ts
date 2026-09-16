import { describe, expect, it, vi, beforeEach } from "vitest";

const mockRunPlanner = vi.fn();
const mockRunCostEstimator = vi.fn();
const mockRunQuartermaster = vi.fn();
const mockDecisionsSelect = vi.fn();

vi.mock("@/lib/agents/planner", () => ({ runPlanner: (...args: unknown[]) => mockRunPlanner(...args) }));
vi.mock("@/lib/agents/cost-estimator", () => ({ runCostEstimator: (...args: unknown[]) => mockRunCostEstimator(...args) }));
vi.mock("@/lib/agents/quartermaster", () => ({ runQuartermaster: (...args: unknown[]) => mockRunQuartermaster(...args) }));
vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => ({
    from: (table: string) => {
      if (table === "decisions") return { select: () => ({ eq: () => ({ in: () => mockDecisionsSelect() }) }) };
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { handleDecisionLocked } from "./on-decision-locked";

beforeEach(() => {
  mockRunPlanner.mockReset().mockResolvedValue({ ok: true });
  mockRunCostEstimator.mockReset().mockResolvedValue({ ok: true });
  mockRunQuartermaster.mockReset().mockResolvedValue({ ok: true });
  mockDecisionsSelect.mockReset().mockResolvedValue({ data: [], error: null });
});

describe("handleDecisionLocked", () => {
  it("fires the itinerary and cost estimate when a destination locks", async () => {
    await handleDecisionLocked("trip-1", { type: "DESTINATION" });
    expect(mockRunPlanner).toHaveBeenCalledWith("trip-1");
    expect(mockRunCostEstimator).toHaveBeenCalledWith("trip-1");
  });

  it("does not fire the checklist when only destination just locked and dates aren't locked yet", async () => {
    mockDecisionsSelect.mockResolvedValue({ data: [{ type: "DESTINATION", state: "LOCKED" }], error: null });
    await handleDecisionLocked("trip-1", { type: "DESTINATION" });
    expect(mockRunQuartermaster).not.toHaveBeenCalled();
  });

  it("fires the checklist when destination locks and dates were already locked", async () => {
    mockDecisionsSelect.mockResolvedValue({
      data: [
        { type: "DESTINATION", state: "LOCKED" },
        { type: "DATES", state: "LOCKED" },
      ],
      error: null,
    });
    await handleDecisionLocked("trip-1", { type: "DESTINATION" });
    expect(mockRunQuartermaster).toHaveBeenCalledWith("trip-1");
  });

  it("fires the checklist when dates lock and destination was already locked (the other lock order)", async () => {
    mockDecisionsSelect.mockResolvedValue({
      data: [
        { type: "DESTINATION", state: "LOCKED" },
        { type: "DATES", state: "LOCKED" },
      ],
      error: null,
    });
    await handleDecisionLocked("trip-1", { type: "DATES" });
    expect(mockRunQuartermaster).toHaveBeenCalledWith("trip-1");
    // Dates locking alone never unblocks the itinerary/cost estimate — those
    // only ever depend on the destination.
    expect(mockRunPlanner).not.toHaveBeenCalled();
    expect(mockRunCostEstimator).not.toHaveBeenCalled();
  });

  it("does nothing for a decision type that doesn't unblock anything (e.g. CUSTOM)", async () => {
    await handleDecisionLocked("trip-1", { type: "CUSTOM" });
    expect(mockRunPlanner).not.toHaveBeenCalled();
    expect(mockRunCostEstimator).not.toHaveBeenCalled();
    expect(mockRunQuartermaster).not.toHaveBeenCalled();
    expect(mockDecisionsSelect).not.toHaveBeenCalled();
  });
});
