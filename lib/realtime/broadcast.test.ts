import { describe, expect, it, vi, beforeEach } from "vitest";

const mockSend = vi.fn();
const mockChannel = vi.fn();
const mockRemoveChannel = vi.fn();

vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => ({
    channel: (...args: unknown[]) => mockChannel(...args),
    removeChannel: (...args: unknown[]) => mockRemoveChannel(...args),
  }),
}));

import { broadcastTripChange } from "./broadcast";

beforeEach(() => {
  mockSend.mockReset().mockResolvedValue("ok");
  mockChannel.mockReset().mockReturnValue({ send: mockSend });
  mockRemoveChannel.mockReset();
});

describe("broadcastTripChange", () => {
  it("sends a broadcast on the trip's channel and cleans it up", async () => {
    await broadcastTripChange("trip-1", { type: "message" });
    expect(mockChannel).toHaveBeenCalledWith("trip:trip-1");
    expect(mockSend).toHaveBeenCalledWith({ type: "broadcast", event: "change", payload: { type: "message" } });
    expect(mockRemoveChannel).toHaveBeenCalled();
  });

  it("defaults to an empty payload", async () => {
    await broadcastTripChange("trip-1");
    expect(mockSend).toHaveBeenCalledWith({ type: "broadcast", event: "change", payload: {} });
  });

  it("still removes the channel if send throws", async () => {
    mockSend.mockRejectedValue(new Error("network"));
    await expect(broadcastTripChange("trip-1")).rejects.toThrow("network");
    expect(mockRemoveChannel).toHaveBeenCalled();
  });
});
