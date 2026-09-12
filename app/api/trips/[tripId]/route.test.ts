import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetAdminUser = vi.fn();
const mockSingle = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  getAdminUser: () => mockGetAdminUser(),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => mockSingle(),
        }),
      }),
      update: (patch: unknown) => ({
        eq: () => ({
          select: () => ({
            single: () => mockUpdate(patch),
          }),
        }),
      }),
    }),
  }),
}));

import { PATCH } from "./route";

beforeEach(() => {
  mockGetAdminUser.mockReset();
  mockSingle.mockReset();
  mockUpdate.mockReset();
});

function patchRequest(action: string) {
  return new Request("http://localhost/api/trips/trip-1", {
    method: "PATCH",
    body: JSON.stringify({ action }),
  });
}

describe("PATCH /api/trips/[tripId]", () => {
  it("rejects a non-owning admin", async () => {
    mockGetAdminUser.mockResolvedValue({ id: "admin-2", email: "x@example.com" });
    mockSingle.mockResolvedValue({ data: { id: "trip-1", admin_user_id: "admin-1", status: "lobby" }, error: null });
    const res = await PATCH(patchRequest("start"), { params: Promise.resolve({ tripId: "trip-1" }) });
    expect(res.status).toBe(403);
  });

  it("rejects starting a trip that's already active", async () => {
    mockGetAdminUser.mockResolvedValue({ id: "admin-1", email: "x@example.com" });
    mockSingle.mockResolvedValue({ data: { id: "trip-1", admin_user_id: "admin-1", status: "active" }, error: null });
    const res = await PATCH(patchRequest("start"), { params: Promise.resolve({ tripId: "trip-1" }) });
    expect(res.status).toBe(409);
  });

  it("starts a lobby trip", async () => {
    mockGetAdminUser.mockResolvedValue({ id: "admin-1", email: "x@example.com" });
    mockSingle.mockResolvedValue({ data: { id: "trip-1", admin_user_id: "admin-1", status: "lobby" }, error: null });
    mockUpdate.mockResolvedValue({ data: { id: "trip-1", status: "active" }, error: null });
    const res = await PATCH(patchRequest("start"), { params: Promise.resolve({ tripId: "trip-1" }) });
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "active" }));
  });
});
