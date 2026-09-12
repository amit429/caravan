import { describe, expect, it, vi, beforeEach } from "vitest";

const mockResolveCaller = vi.fn();
const mockGetAdminUser = vi.fn();
const mockUpsert = vi.fn();
const mockBroadcast = vi.fn();

vi.mock("@/lib/realtime/broadcast", () => ({ broadcastTripChange: (...args: unknown[]) => mockBroadcast(...args) }));

vi.mock("@/lib/auth/resolve-caller", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/resolve-caller")>("@/lib/auth/resolve-caller");
  return { ...actual, resolveCaller: (...args: unknown[]) => mockResolveCaller(...args) };
});
vi.mock("@/lib/auth/session", () => ({ getAdminUser: () => mockGetAdminUser() }));
vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => ({
    from: () => ({
      upsert: (row: unknown, opts: unknown) => ({ select: () => ({ single: () => mockUpsert(row, opts) }) }),
    }),
  }),
}));

import { PATCH } from "./route";

const params = Promise.resolve({ tripId: "trip-1", bookingId: "booking-1" });

function req(body: unknown) {
  return new Request("http://localhost", { method: "PATCH", body: JSON.stringify(body) });
}

beforeEach(() => {
  mockResolveCaller.mockReset();
  mockGetAdminUser.mockReset().mockResolvedValue(null);
  mockUpsert.mockReset().mockResolvedValue({ data: { booked: true }, error: null });
  mockBroadcast.mockReset();
});

describe("PATCH /api/trips/[tripId]/bookings/[bookingId]/status", () => {
  it("rejects a caller with no session", async () => {
    mockResolveCaller.mockResolvedValue(null);
    const res = await PATCH(req({ booked: true }), { params });
    expect(res.status).toBe(401);
  });

  it("lets a member set their own status", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m1", status: "active" });
    const res = await PATCH(req({ booked: true }), { params });
    expect(res.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalledWith(
      { booking_id: "booking-1", member_id: "m1", booked: true, updated_at: expect.any(String) },
      { onConflict: "booking_id,member_id" }
    );
    expect(mockBroadcast).toHaveBeenCalledWith("trip-1");
  });

  it("blocks a member from setting someone else's status", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m1", status: "active" });
    const res = await PATCH(req({ booked: true, memberId: "m2" }), { params });
    expect(res.status).toBe(403);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("lets the admin set someone else's status", async () => {
    mockResolveCaller.mockResolvedValue({ id: "admin-member-id", status: "active" });
    mockGetAdminUser.mockResolvedValue({ id: "admin-1", email: "amit@example.com" });
    const res = await PATCH(req({ booked: true, memberId: "m2" }), { params });
    expect(res.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalledWith(
      { booking_id: "booking-1", member_id: "m2", booked: true, updated_at: expect.any(String) },
      { onConflict: "booking_id,member_id" }
    );
  });
});
