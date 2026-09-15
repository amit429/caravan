import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGenerateText = vi.fn();
const mockLogAgentRun = vi.fn();
const mockDecisionsSelect = vi.fn();
const mockCostSelect = vi.fn();
const mockTasksSelect = vi.fn();
const mockBookingsSelect = vi.fn();

vi.mock("ai", () => ({ generateText: (...args: unknown[]) => mockGenerateText(...args) }));
vi.mock("./runtime/log-run", () => ({ logAgentRun: (...args: unknown[]) => mockLogAgentRun(...args) }));
vi.mock("./runtime/model", () => ({ flashModel: "mock-flash-model", estimateCost: () => 0 }));
vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => ({
    from: (table: string) => {
      if (table === "decisions") return { select: () => ({ eq: () => mockDecisionsSelect() }) };
      if (table === "cost_estimates") return { select: () => ({ eq: () => ({ maybeSingle: () => mockCostSelect() }) }) };
      if (table === "tasks") return { select: () => ({ eq: () => mockTasksSelect() }) };
      if (table === "bookings") return { select: () => ({ eq: () => mockBookingsSelect() }) };
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { answerTripQuestion } from "./answer-question";

beforeEach(() => {
  mockGenerateText.mockReset();
  mockLogAgentRun.mockReset();
  mockDecisionsSelect.mockReset().mockResolvedValue({
    data: [{ type: "DESTINATION", state: "LOCKED", options: [{ id: "goa", label: "Goa" }], locked_option: "goa" }],
    error: null,
  });
  mockCostSelect.mockReset().mockResolvedValue({ data: { min_per_head: 11000, max_per_head: 14000, destination: "Goa" }, error: null });
  mockTasksSelect.mockReset().mockResolvedValue({ data: [{ done: true }, { done: false }], error: null });
  mockBookingsSelect.mockReset().mockResolvedValue({ data: [{ item: "Stay" }], error: null });
});

describe("answerTripQuestion", () => {
  it("builds context from locked decisions, cost, checklist, and bookings", async () => {
    mockGenerateText.mockResolvedValue({ text: "You're staying in Goa, about ₹11-14k a head.", usage: { inputTokens: 10, outputTokens: 5 } });
    const answer = await answerTripQuestion("trip-1", "Where are we going and what's it cost?");
    expect(answer).toBe("You're staying in Goa, about ₹11-14k a head.");
    const prompt = mockGenerateText.mock.calls[0][0].prompt as string;
    expect(prompt).toContain("Goa");
    expect(prompt).toContain("11000-14000");
    expect(prompt).toContain("1 of 2 checklist items done");
    expect(prompt).toContain("Stay");
    expect(mockLogAgentRun).toHaveBeenCalledWith(expect.objectContaining({ outcome: "success" }));
  });

  it("returns a graceful fallback and logs an error when the model call fails", async () => {
    mockGenerateText.mockRejectedValue(new Error("model unavailable"));
    const answer = await answerTripQuestion("trip-1", "What's the plan?");
    expect(answer).toContain("Something went wrong");
    expect(mockLogAgentRun).toHaveBeenCalledWith(expect.objectContaining({ outcome: "error" }));
  });
});
