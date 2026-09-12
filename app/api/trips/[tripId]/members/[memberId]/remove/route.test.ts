import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetAdminUser = vi.fn();
const mockTripSingle = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/auth/session", () => ({ getAdminUser: () => mockGetAdminUser() }));
vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ single: () => mockTripSingle() }) }),
      update: (patch: unknown) => ({ eq: () => mockUpdate(patch) }),
    }),
  }),
}));

import { POST } from "./route";

beforeEach(() => {
  mockGetAdminUser.mockReset();
  mockTripSingle.mockReset();
  mockUpdate.mockReset();
  mockUpdate.mockResolvedValue({ error: null });
});

describe("POST /api/trips/[tripId]/members/[memberId]/remove", () => {
  it("rejects a non-owning admin", async () => {
    mockGetAdminUser.mockResolvedValue({ id: "admin-2" });
    mockTripSingle.mockResolvedValue({ data: { admin_user_id: "admin-1" }, error: null });
    const res = await POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ tripId: "trip-1", memberId: "member-1" }),
    });
    expect(res.status).toBe(403);
  });

  it("marks the member removed for the owning admin", async () => {
    mockGetAdminUser.mockResolvedValue({ id: "admin-1" });
    mockTripSingle.mockResolvedValue({ data: { admin_user_id: "admin-1" }, error: null });
    const res = await POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ tripId: "trip-1", memberId: "member-1" }),
    });
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith({ status: "removed" });
  });
});
