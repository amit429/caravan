import { describe, expect, it, vi, beforeEach } from "vitest";

const mockResolveCaller = vi.fn();
const mockGetAdminUser = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockBroadcast = vi.fn();
const mockTripSingle = vi.fn();

vi.mock("@/lib/realtime/broadcast", () => ({ broadcastTripChange: (...args: unknown[]) => mockBroadcast(...args) }));

vi.mock("@/lib/auth/resolve-caller", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/resolve-caller")>("@/lib/auth/resolve-caller");
  return { ...actual, resolveCaller: (...args: unknown[]) => mockResolveCaller(...args) };
});
vi.mock("@/lib/auth/session", () => ({ getAuthUser: () => mockGetAdminUser() }));
vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => ({
    from: (table: string) => {
      if (table === "trips") return { select: () => ({ eq: () => ({ maybeSingle: () => mockTripSingle() }) }) };
      return {
        select: () => ({ eq: () => ({ order: () => mockSelect() }) }),
        insert: (row: unknown) => ({ select: () => ({ single: () => mockInsert(row) }) }),
      };
    },
  }),
}));

import { GET, POST } from "./route";

const params = Promise.resolve({ tripId: "trip-1" });

beforeEach(() => {
  mockResolveCaller.mockReset();
  mockGetAdminUser.mockReset();
  mockSelect.mockReset();
  mockInsert.mockReset();
  mockBroadcast.mockReset();
  mockTripSingle.mockReset().mockResolvedValue({ data: { admin_user_id: "admin-1" }, error: null });
});

describe("GET /api/trips/[tripId]/bookings", () => {
  it("rejects a caller with no session", async () => {
    mockResolveCaller.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost"), { params });
    expect(res.status).toBe(401);
  });

  it("lists bookings for a resolved caller", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m1", status: "active" });
    mockSelect.mockResolvedValue({ data: [{ id: "b1" }], error: null });
    const res = await GET(new Request("http://localhost"), { params });
    expect(res.status).toBe(200);
  });
});

describe("POST /api/trips/[tripId]/bookings", () => {
  it("rejects a non-admin caller", async () => {
    mockGetAdminUser.mockResolvedValue(null);
    const res = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ item: "Flight" }) }), {
      params,
    });
    expect(res.status).toBe(401);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("rejects an admin who doesn't own this trip", async () => {
    mockGetAdminUser.mockResolvedValue({ id: "admin-2", email: "other@example.com" });
    const res = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ item: "Flight" }) }), {
      params,
    });
    expect(res.status).toBe(403);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("creates a booking item for the admin", async () => {
    mockGetAdminUser.mockResolvedValue({ id: "admin-1", email: "amit@example.com" });
    mockInsert.mockResolvedValue({ data: { id: "b1", item: "Flight" }, error: null });
    const res = await POST(
      new Request("http://localhost", { method: "POST", body: JSON.stringify({ item: "Flight", deadline: "2026-11-01" }) }),
      { params }
    );
    expect(res.status).toBe(201);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ trip_id: "trip-1", item: "Flight", deadline: "2026-11-01" })
    );
    expect(mockBroadcast).toHaveBeenCalledWith("trip-1");
  });
});
