import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetAuthUser = vi.fn();
const mockTripOwnerCheck = vi.fn();
const mockDecisionsDelete = vi.fn();
const mockBroadcast = vi.fn();

vi.mock("@/lib/realtime/broadcast", () => ({ broadcastTripChange: (...args: unknown[]) => mockBroadcast(...args) }));
vi.mock("@/lib/auth/session", () => ({ getAuthUser: () => mockGetAuthUser() }));
vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => ({
    from: (table: string) => {
      if (table === "trips") return { select: () => ({ eq: () => ({ maybeSingle: () => mockTripOwnerCheck() }) }) };
      if (table === "decisions") return { delete: () => ({ eq: () => ({ eq: () => mockDecisionsDelete() }) }) };
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { DELETE } from "./route";

const params = Promise.resolve({ tripId: "trip-1", decisionId: "decision-1" });

beforeEach(() => {
  mockGetAuthUser.mockReset();
  mockTripOwnerCheck.mockReset();
  mockDecisionsDelete.mockReset().mockResolvedValue({ error: null });
  mockBroadcast.mockReset();
});

describe("DELETE /api/trips/[tripId]/decisions/[decisionId]", () => {
  it("rejects a non-owning admin", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "admin-2", email: "x@example.com" });
    mockTripOwnerCheck.mockResolvedValue({ data: { admin_user_id: "admin-1" }, error: null });
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), { params });
    expect(res.status).toBe(403);
    expect(mockDecisionsDelete).not.toHaveBeenCalled();
  });

  it("deletes the decision for the owning admin and rebroadcasts", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "admin-1", email: "x@example.com" });
    mockTripOwnerCheck.mockResolvedValue({ data: { admin_user_id: "admin-1" }, error: null });
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), { params });
    expect(res.status).toBe(200);
    expect(mockDecisionsDelete).toHaveBeenCalled();
    expect(mockBroadcast).toHaveBeenCalledWith("trip-1");
  });
});
