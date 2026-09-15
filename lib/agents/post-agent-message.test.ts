import { describe, expect, it, vi, beforeEach } from "vitest";

const mockSingle = vi.fn();
const mockBroadcast = vi.fn();

vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => ({
    from: () => ({ insert: () => ({ select: () => ({ single: () => mockSingle() }) }) }),
  }),
}));
vi.mock("@/lib/realtime/broadcast", () => ({ broadcastTripChange: (...args: unknown[]) => mockBroadcast(...args) }));

import { postAgentMessage } from "./post-agent-message";

beforeEach(() => {
  mockSingle.mockReset().mockResolvedValue({ data: { id: "msg-1", body: "hello" }, error: null });
  mockBroadcast.mockReset();
});

describe("postAgentMessage", () => {
  it("inserts the message and broadcasts it for live listeners", async () => {
    await postAgentMessage({ tripId: "trip-1", agentName: "scout", body: "hello" });
    expect(mockBroadcast).toHaveBeenCalledWith("trip-1", { type: "message", message: { id: "msg-1", body: "hello" } });
  });

  it("broadcasts a thread_message when posting into a thread", async () => {
    mockSingle.mockResolvedValue({ data: { id: "msg-2", body: "hey" }, error: null });
    await postAgentMessage({ tripId: "trip-1", agentName: "concierge", body: "hey", threadId: "thread-1" });
    expect(mockBroadcast).toHaveBeenCalledWith("trip-1", {
      type: "thread_message",
      threadId: "thread-1",
      message: { id: "msg-2", body: "hey" },
    });
  });

  it("does not broadcast if the insert failed", async () => {
    mockSingle.mockResolvedValue({ data: null, error: new Error("db down") });
    await postAgentMessage({ tripId: "trip-1", agentName: "scout", body: "hello" });
    expect(mockBroadcast).not.toHaveBeenCalled();
  });
});
