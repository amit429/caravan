import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetAuthUser = vi.fn();
const mockTripSingle = vi.fn();
const mockRemoveMemberAndRerun = vi.fn();
const mockBroadcast = vi.fn();

vi.mock("@/lib/realtime/broadcast", () => ({ broadcastTripChange: (...args: unknown[]) => mockBroadcast(...args) }));
vi.mock("@/lib/auth/session", () => ({ getAuthUser: () => mockGetAuthUser() }));
vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => mockTripSingle() }) }) }),
  }),
}));
vi.mock("@/lib/trips/remove-member", () => ({
  removeMemberAndRerun: (...args: unknown[]) => mockRemoveMemberAndRerun(...args),
}));

import { POST } from "./route";

beforeEach(() => {
  mockGetAuthUser.mockReset();
  mockTripSingle.mockReset();
  mockRemoveMemberAndRerun.mockReset();
  mockRemoveMemberAndRerun.mockResolvedValue({ ok: true, destinationRegenerated: false, costRegenerated: false });
  mockBroadcast.mockReset();
});

describe("POST /api/trips/[tripId]/members/[memberId]/remove", () => {
  it("rejects a non-owning admin", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "admin-2" });
    mockTripSingle.mockResolvedValue({ data: { admin_user_id: "admin-1" }, error: null });
    const res = await POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ tripId: "trip-1", memberId: "member-1" }),
    });
    expect(res.status).toBe(403);
    expect(mockRemoveMemberAndRerun).not.toHaveBeenCalled();
  });

  it("removes the member and rebroadcasts for the owning admin", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "admin-1" });
    mockTripSingle.mockResolvedValue({ data: { admin_user_id: "admin-1" }, error: null });
    const res = await POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ tripId: "trip-1", memberId: "member-1" }),
    });
    expect(res.status).toBe(200);
    expect(mockRemoveMemberAndRerun).toHaveBeenCalledWith("trip-1", "member-1");
    expect(mockBroadcast).toHaveBeenCalledWith("trip-1");
  });
});
