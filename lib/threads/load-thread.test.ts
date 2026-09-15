import { describe, expect, it, vi, beforeEach } from "vitest";

const mockEnsureThread = vi.fn();
const mockPostAgentMessage = vi.fn();
const mockOrder = vi.fn();

vi.mock("./ensure-thread", () => ({ ensureThread: (...args: unknown[]) => mockEnsureThread(...args) }));
vi.mock("@/lib/agents/runtime/post-agent-message", () => ({ postAgentMessage: (...args: unknown[]) => mockPostAgentMessage(...args) }));

const supabase = {
  from: () => ({ select: () => ({ eq: () => ({ order: () => mockOrder() }) }) }),
} as unknown as Parameters<typeof import("./load-thread").loadThread>[2];

import { loadThread } from "./load-thread";

beforeEach(() => {
  mockEnsureThread.mockReset().mockResolvedValue("thread-1");
  mockPostAgentMessage.mockReset();
  mockOrder.mockReset();
});

describe("loadThread", () => {
  it("returns existing messages without seeding", async () => {
    mockOrder.mockResolvedValue({ data: [{ id: "msg-1" }], error: null });
    const result = await loadThread("trip-1", "member-1", supabase);
    expect(result).toEqual({ threadId: "thread-1", messages: [{ id: "msg-1" }] });
    expect(mockPostAgentMessage).not.toHaveBeenCalled();
  });

  it("seeds an opening agent message when the thread is empty", async () => {
    mockOrder
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [{ id: "seed-msg", agent_name: "concierge" }], error: null });
    const result = await loadThread("trip-1", "member-1", supabase);
    expect(mockPostAgentMessage).toHaveBeenCalledWith(
      expect.objectContaining({ tripId: "trip-1", agentName: "concierge", threadId: "thread-1" })
    );
    expect(result.messages).toEqual([{ id: "seed-msg", agent_name: "concierge" }]);
  });
});
