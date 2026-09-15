import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetAuthUser = vi.fn();
const mockTripOwnerCheck = vi.fn();
const mockDecisionsSelect = vi.fn();
const mockDecisionsDelete = vi.fn();
const mockBroadcast = vi.fn();
const mockPostAgentMessage = vi.fn();

vi.mock("@/lib/realtime/broadcast", () => ({ broadcastTripChange: (...args: unknown[]) => mockBroadcast(...args) }));
vi.mock("@/lib/agents/runtime/post-agent-message", () => ({ postAgentMessage: (...args: unknown[]) => mockPostAgentMessage(...args) }));
vi.mock("@/lib/auth/session", () => ({ getAuthUser: () => mockGetAuthUser() }));
vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => ({
    from: (table: string) => {
      if (table === "trips") return { select: () => ({ eq: () => ({ maybeSingle: () => mockTripOwnerCheck() }) }) };
      if (table === "decisions") {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => mockDecisionsSelect() }) }) }),
          delete: () => ({ eq: () => ({ eq: () => mockDecisionsDelete() }) }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { DELETE } from "./route";

const params = Promise.resolve({ tripId: "trip-1", decisionId: "decision-1" });

beforeEach(() => {
  mockGetAuthUser.mockReset();
  mockTripOwnerCheck.mockReset();
  mockDecisionsSelect.mockReset().mockResolvedValue({ data: { type: "DESTINATION", state: "OPEN" }, error: null });
  mockDecisionsDelete.mockReset().mockResolvedValue({ error: null });
  mockBroadcast.mockReset();
  mockPostAgentMessage.mockReset();
});

describe("DELETE /api/trips/[tripId]/decisions/[decisionId]", () => {
  it("rejects a non-owning admin", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "admin-2", email: "x@example.com" });
    mockTripOwnerCheck.mockResolvedValue({ data: { admin_user_id: "admin-1" }, error: null });
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), { params });
    expect(res.status).toBe(403);
    expect(mockDecisionsDelete).not.toHaveBeenCalled();
  });

  it("deletes the decision, rebroadcasts, and has the agent announce it", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "admin-1", email: "x@example.com" });
    mockTripOwnerCheck.mockResolvedValue({ data: { admin_user_id: "admin-1" }, error: null });
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), { params });
    expect(res.status).toBe(200);
    expect(mockDecisionsDelete).toHaveBeenCalled();
    expect(mockBroadcast).toHaveBeenCalledWith("trip-1");
    expect(mockPostAgentMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        tripId: "trip-1",
        agentName: "concierge",
        body: expect.stringContaining("Where are we going?"),
      })
    );
  });

  it("mentions when the deleted decision was already locked", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "admin-1", email: "x@example.com" });
    mockTripOwnerCheck.mockResolvedValue({ data: { admin_user_id: "admin-1" }, error: null });
    mockDecisionsSelect.mockResolvedValue({ data: { type: "DATES", state: "LOCKED" }, error: null });
    await DELETE(new Request("http://localhost", { method: "DELETE" }), { params });
    expect(mockPostAgentMessage).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringContaining("already locked in") })
    );
  });
});
