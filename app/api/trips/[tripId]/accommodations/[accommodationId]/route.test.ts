import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetAuthUser = vi.fn();
const mockResolveCaller = vi.fn();
const mockTripOwnerCheck = vi.fn();
const mockTripAdminCheck = vi.fn();
const mockAccommodationSelect = vi.fn();
const mockAccommodationUpdate = vi.fn();
const mockAccommodationDelete = vi.fn();
const mockBroadcast = vi.fn();

vi.mock("@/lib/realtime/broadcast", () => ({ broadcastTripChange: (...args: unknown[]) => mockBroadcast(...args) }));
vi.mock("@/lib/auth/session", () => ({ getAuthUser: () => mockGetAuthUser() }));
vi.mock("@/lib/auth/resolve-caller", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/resolve-caller")>("@/lib/auth/resolve-caller");
  return { ...actual, resolveCaller: (...args: unknown[]) => mockResolveCaller(...args) };
});
vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => ({
    from: (table: string) => {
      if (table === "accommodations") {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => mockAccommodationSelect() }) }) }),
          update: (patch: unknown) => ({ eq: () => ({ eq: () => ({ select: () => ({ single: () => mockAccommodationUpdate(patch) }) }) }) }),
          delete: () => ({ eq: () => mockAccommodationDelete() }),
        };
      }
      if (table === "trips") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => mockTripOwnerCheck(),
              single: () => mockTripAdminCheck(),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { PATCH, DELETE } from "./route";

const params = Promise.resolve({ tripId: "trip-1", accommodationId: "accom-1" });

function patchRequest(body: unknown) {
  return new Request("http://localhost", { method: "PATCH", body: JSON.stringify(body) });
}

beforeEach(() => {
  mockGetAuthUser.mockReset();
  mockResolveCaller.mockReset();
  mockTripOwnerCheck.mockReset();
  mockTripAdminCheck.mockReset();
  mockAccommodationSelect.mockReset();
  mockAccommodationUpdate.mockReset().mockResolvedValue({ data: { id: "accom-1", locked: true }, error: null });
  mockAccommodationDelete.mockReset().mockResolvedValue({ error: null });
  mockBroadcast.mockReset();
});

describe("PATCH /api/trips/[tripId]/accommodations/[accommodationId]", () => {
  it("rejects a non-owning admin", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "admin-2", email: "x@example.com" });
    mockTripOwnerCheck.mockResolvedValue({ data: { admin_user_id: "admin-1" }, error: null });
    const res = await PATCH(patchRequest({ locked: true }), { params });
    expect(res.status).toBe(403);
    expect(mockAccommodationUpdate).not.toHaveBeenCalled();
  });

  it("locks with a date range for the owning admin", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "admin-1", email: "x@example.com" });
    mockTripOwnerCheck.mockResolvedValue({ data: { admin_user_id: "admin-1" }, error: null });

    const res = await PATCH(patchRequest({ locked: true, startDate: "2027-03-01", endDate: "2027-03-04" }), { params });
    expect(res.status).toBe(200);
    expect(mockAccommodationUpdate).toHaveBeenCalledWith({ locked: true, start_date: "2027-03-01", end_date: "2027-03-04" });
    expect(mockBroadcast).toHaveBeenCalledWith("trip-1");
  });
});

describe("DELETE /api/trips/[tripId]/accommodations/[accommodationId]", () => {
  it("returns 404 for an accommodation outside this trip", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m1", status: "active" });
    mockAccommodationSelect.mockResolvedValue({ data: null, error: null });
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), { params });
    expect(res.status).toBe(404);
  });

  it("blocks a non-owner, non-admin from deleting someone else's accommodation", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m2", status: "active" });
    mockAccommodationSelect.mockResolvedValue({ data: { id: "accom-1", member_id: "m1" }, error: null });
    mockGetAuthUser.mockResolvedValue(null);
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), { params });
    expect(res.status).toBe(403);
    expect(mockAccommodationDelete).not.toHaveBeenCalled();
  });

  it("lets the accommodation's own member delete it", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m1", status: "active" });
    mockAccommodationSelect.mockResolvedValue({ data: { id: "accom-1", member_id: "m1" }, error: null });
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), { params });
    expect(res.status).toBe(200);
    expect(mockAccommodationDelete).toHaveBeenCalled();
  });

  it("lets the trip admin delete someone else's accommodation", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m2", status: "active" });
    mockAccommodationSelect.mockResolvedValue({ data: { id: "accom-1", member_id: "m1" }, error: null });
    mockGetAuthUser.mockResolvedValue({ id: "admin-1", email: "x@example.com" });
    mockTripAdminCheck.mockResolvedValue({ data: { admin_user_id: "admin-1" }, error: null });
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), { params });
    expect(res.status).toBe(200);
    expect(mockAccommodationDelete).toHaveBeenCalled();
  });
});
