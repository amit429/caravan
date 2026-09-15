import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetAdminUser = vi.fn();
const mockDecisionSingle = vi.fn();
const mockUpdate = vi.fn();
const mockPostAgentMessage = vi.fn();
const mockBroadcast = vi.fn();

vi.mock("@/lib/agents/post-agent-message", () => ({ postAgentMessage: (...args: unknown[]) => mockPostAgentMessage(...args) }));
vi.mock("@/lib/realtime/broadcast", () => ({ broadcastTripChange: (...args: unknown[]) => mockBroadcast(...args) }));
vi.mock("@/lib/auth/session", () => ({ getAdminUser: () => mockGetAdminUser() }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ single: () => mockDecisionSingle() }) }) }),
      update: (patch: unknown) => ({ eq: () => ({ select: () => ({ single: () => mockUpdate(patch) }) }) }),
    }),
  }),
}));

import { POST } from "./route";

const params = Promise.resolve({ tripId: "trip-1", decisionId: "decision-1" });

beforeEach(() => {
  mockGetAdminUser.mockReset();
  mockDecisionSingle.mockReset();
  mockUpdate.mockReset();
  mockPostAgentMessage.mockReset();
  mockBroadcast.mockReset();
});

describe("POST /api/trips/[tripId]/decisions/[decisionId]/reopen", () => {
  it("rejects a non-admin caller", async () => {
    mockGetAdminUser.mockResolvedValue(null);
    const res = await POST(new Request("http://localhost", { method: "POST" }), { params });
    expect(res.status).toBe(401);
  });

  it("rejects reopening a decision that isn't locked", async () => {
    mockGetAdminUser.mockResolvedValue({ id: "admin-1", email: "amit@example.com" });
    mockDecisionSingle.mockResolvedValue({ data: { id: "decision-1", type: "DESTINATION", state: "OPEN" }, error: null });
    const res = await POST(new Request("http://localhost", { method: "POST" }), { params });
    expect(res.status).toBe(409);
  });

  it("reopens a locked decision and announces it", async () => {
    mockGetAdminUser.mockResolvedValue({ id: "admin-1", email: "amit@example.com" });
    mockDecisionSingle.mockResolvedValue({ data: { id: "decision-1", type: "DESTINATION", state: "LOCKED" }, error: null });
    mockUpdate.mockResolvedValue({ data: { id: "decision-1", state: "REOPENED" }, error: null });
    const res = await POST(new Request("http://localhost", { method: "POST" }), { params });
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ state: "REOPENED", locked_option: null, locked_by: null, rationale: null })
    );
    expect(mockPostAgentMessage).toHaveBeenCalledWith(
      expect.objectContaining({ tripId: "trip-1", agentName: "concierge", body: expect.stringContaining("Reopened") })
    );
    expect(mockBroadcast).toHaveBeenCalledWith("trip-1");
  });
});
