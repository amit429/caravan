import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGenerateText = vi.fn();
const mockLogAgentRun = vi.fn();
const mockPostAgentMessage = vi.fn();
const mockAvailabilitySelect = vi.fn();

vi.mock("ai", () => ({ generateText: (...args: unknown[]) => mockGenerateText(...args) }));
vi.mock("./runtime/log-run", () => ({ logAgentRun: (...args: unknown[]) => mockLogAgentRun(...args) }));
vi.mock("./runtime/model", () => ({ flashModel: "mock-flash-model", estimateCost: () => 0 }));
vi.mock("./runtime/post-agent-message", () => ({ postAgentMessage: (...args: unknown[]) => mockPostAgentMessage(...args) }));
vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => ({
    from: (table: string) => {
      if (table === "availability") return { select: () => ({ eq: () => mockAvailabilitySelect() }) };
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { runDateOutreach } from "./date-outreach";

const member = { id: "member-1", display_name: "Aarushi" };
const window = { startDate: "2027-02-27", endDate: "2027-03-02" };

beforeEach(() => {
  mockGenerateText.mockReset();
  mockLogAgentRun.mockReset();
  mockPostAgentMessage.mockReset();
  mockAvailabilitySelect.mockReset().mockResolvedValue({
    data: [{ start_date: "2027-03-03", end_date: "2027-03-06", strength: "free" }],
    error: null,
  });
});

describe("runDateOutreach", () => {
  it("grounds the prompt in the member's own availability and posts to their thread", async () => {
    mockGenerateText.mockResolvedValue({
      text: "Hey Aarushi, most of the group can make Feb 27 – Mar 2 — any chance you could shift?",
      usage: { inputTokens: 10, outputTokens: 5 },
    });
    const result = await runDateOutreach("trip-1", "thread-1", member, window, 2, 3);
    expect(result).toEqual({ posted: true });
    const prompt = mockGenerateText.mock.calls[0][0].prompt as string;
    expect(prompt).toContain("Aarushi");
    expect(prompt).toContain("2027-03-03 to 2027-03-06 (free)");
    expect(prompt).toContain("2 of 3");
    expect(mockPostAgentMessage).toHaveBeenCalledWith(
      expect.objectContaining({ tripId: "trip-1", agentName: "chaser", threadId: "thread-1" })
    );
    expect(mockLogAgentRun).toHaveBeenCalledWith(expect.objectContaining({ outcome: "success" }));
  });

  it("says 'nothing on file' when the member has no availability rows", async () => {
    mockAvailabilitySelect.mockResolvedValue({ data: [], error: null });
    mockGenerateText.mockResolvedValue({ text: "ok", usage: { inputTokens: 1, outputTokens: 1 } });
    await runDateOutreach("trip-1", "thread-1", member, window, 2, 3);
    const prompt = mockGenerateText.mock.calls[0][0].prompt as string;
    expect(prompt).toContain("nothing on file");
  });

  it("returns posted:false and logs an error when the model call fails, without posting", async () => {
    mockGenerateText.mockRejectedValue(new Error("model unavailable"));
    const result = await runDateOutreach("trip-1", "thread-1", member, window, 2, 3);
    expect(result).toEqual({ posted: false });
    expect(mockPostAgentMessage).not.toHaveBeenCalled();
    expect(mockLogAgentRun).toHaveBeenCalledWith(expect.objectContaining({ outcome: "error" }));
  });
});
