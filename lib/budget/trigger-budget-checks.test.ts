import { describe, expect, it, vi, beforeEach } from "vitest";

const mockPostAgentMessage = vi.fn();
const mockEnsureThread = vi.fn();
const mockFactsSelect = vi.fn();
const mockPendingSelect = vi.fn();
const mockChecksInsert = vi.fn();

vi.mock("@/lib/agents/runtime/post-agent-message", () => ({ postAgentMessage: (...args: unknown[]) => mockPostAgentMessage(...args) }));
vi.mock("@/lib/threads/ensure-thread", () => ({ ensureThread: (...args: unknown[]) => mockEnsureThread(...args) }));

vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => ({
    from: (table: string) => {
      if (table === "facts") return { select: () => ({ eq: () => ({ eq: () => ({ is: () => mockFactsSelect() }) }) }) };
      if (table === "budget_checks") {
        return {
          select: () => ({ eq: () => ({ eq: () => mockPendingSelect() }) }),
          insert: (row: unknown) => ({ select: () => ({ single: () => mockChecksInsert(row) }) }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { triggerBudgetChecks } from "./trigger-budget-checks";

beforeEach(() => {
  mockPostAgentMessage.mockReset();
  mockEnsureThread.mockReset().mockResolvedValue("thread-1");
  mockFactsSelect.mockReset().mockResolvedValue({ data: [], error: null });
  mockPendingSelect.mockReset().mockResolvedValue({ data: [], error: null });
  mockChecksInsert.mockReset().mockResolvedValue({ data: { id: "check-1" }, error: null });
});

describe("triggerBudgetChecks", () => {
  it("does nothing when nobody is flagged", async () => {
    mockFactsSelect.mockResolvedValue({ data: [{ member_id: "m1", value: { amount: 100000 } }], error: null });
    await triggerBudgetChecks("trip-1", { minPerHead: 50000, maxPerHead: 70000 }); // midpoint 60000, m1 clears it
    expect(mockChecksInsert).not.toHaveBeenCalled();
    expect(mockPostAgentMessage).not.toHaveBeenCalled();
  });

  it("asks a flagged member once, via their own thread", async () => {
    mockFactsSelect.mockResolvedValue({ data: [{ member_id: "m1", value: { amount: 40000 } }], error: null }); // below midpoint 60000
    await triggerBudgetChecks("trip-1", { minPerHead: 50000, maxPerHead: 70000 });

    expect(mockChecksInsert).toHaveBeenCalledWith(
      expect.objectContaining({ trip_id: "trip-1", member_id: "m1", threshold_amount: 60000, status: "pending" })
    );
    expect(mockEnsureThread).toHaveBeenCalledWith("trip-1", "m1", expect.anything());
    expect(mockPostAgentMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        tripId: "trip-1",
        agentName: "quartermaster",
        threadId: "thread-1",
        metadata: expect.objectContaining({ kind: "budget_check", budgetCheckId: "check-1", thresholdAmount: 60000 }),
      })
    );
  });

  it("does not ask a member who already has a pending check", async () => {
    mockFactsSelect.mockResolvedValue({ data: [{ member_id: "m1", value: { amount: 40000 } }], error: null });
    mockPendingSelect.mockResolvedValue({ data: [{ member_id: "m1" }], error: null });

    await triggerBudgetChecks("trip-1", { minPerHead: 50000, maxPerHead: 70000 });

    expect(mockChecksInsert).not.toHaveBeenCalled();
    expect(mockPostAgentMessage).not.toHaveBeenCalled();
  });

  it("asks each flagged member independently", async () => {
    mockFactsSelect.mockResolvedValue({
      data: [
        { member_id: "m1", value: { amount: 40000 } },
        { member_id: "m2", value: { amount: 45000 } },
        { member_id: "m3", value: { amount: 100000 } }, // clears it
      ],
      error: null,
    });

    await triggerBudgetChecks("trip-1", { minPerHead: 50000, maxPerHead: 70000 });

    expect(mockChecksInsert).toHaveBeenCalledTimes(2);
    expect(mockPostAgentMessage).toHaveBeenCalledTimes(2);
  });
});
