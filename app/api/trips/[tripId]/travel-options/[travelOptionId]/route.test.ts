import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetAuthUser = vi.fn();
const mockResolveCaller = vi.fn();
const mockTripOwnerCheck = vi.fn();
const mockTripAdminCheck = vi.fn();
const mockTravelOptionSelect = vi.fn();
const mockTravelOptionUpdate = vi.fn();
const mockTravelOptionDelete = vi.fn();
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
      if (table === "travel_options") {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => mockTravelOptionSelect() }) }) }),
          update: (patch: unknown) => ({ eq: () => ({ eq: () => ({ select: () => ({ single: () => mockTravelOptionUpdate(patch) }) }) }) }),
          delete: () => ({ eq: () => mockTravelOptionDelete() }),
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

const params = Promise.resolve({ tripId: "trip-1", travelOptionId: "travel-1" });

function patchRequest(body: unknown) {
  return new Request("http://localhost", { method: "PATCH", body: JSON.stringify(body) });
}

beforeEach(() => {
  mockGetAuthUser.mockReset();
  mockResolveCaller.mockReset();
  mockTripOwnerCheck.mockReset();
  mockTripAdminCheck.mockReset();
  mockTravelOptionSelect.mockReset();
  mockTravelOptionUpdate.mockReset().mockResolvedValue({ data: { id: "travel-1", locked: true }, error: null });
  mockTravelOptionDelete.mockReset().mockResolvedValue({ error: null });
  mockBroadcast.mockReset();
});

describe("PATCH /api/trips/[tripId]/travel-options/[travelOptionId]", () => {
  it("rejects a non-owning admin", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "admin-2", email: "x@example.com" });
    mockTripOwnerCheck.mockResolvedValue({ data: { admin_user_id: "admin-1" }, error: null });
    const res = await PATCH(patchRequest({ locked: true }), { params });
    expect(res.status).toBe(403);
    expect(mockTravelOptionUpdate).not.toHaveBeenCalled();
  });

  it("locks for the owning admin", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "admin-1", email: "x@example.com" });
    mockTripOwnerCheck.mockResolvedValue({ data: { admin_user_id: "admin-1" }, error: null });
    const res = await PATCH(patchRequest({ locked: true }), { params });
    expect(res.status).toBe(200);
    expect(mockTravelOptionUpdate).toHaveBeenCalledWith({ locked: true });
    expect(mockBroadcast).toHaveBeenCalledWith("trip-1");
  });
});

describe("DELETE /api/trips/[tripId]/travel-options/[travelOptionId]", () => {
  it("returns 404 for a travel option outside this trip", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m1", status: "active" });
    mockTravelOptionSelect.mockResolvedValue({ data: null, error: null });
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), { params });
    expect(res.status).toBe(404);
  });

  it("blocks a non-owner, non-admin from deleting someone else's travel option", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m2", status: "active" });
    mockTravelOptionSelect.mockResolvedValue({ data: { id: "travel-1", member_id: "m1" }, error: null });
    mockGetAuthUser.mockResolvedValue(null);
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), { params });
    expect(res.status).toBe(403);
    expect(mockTravelOptionDelete).not.toHaveBeenCalled();
  });

  it("lets the travel option's own member delete it", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m1", status: "active" });
    mockTravelOptionSelect.mockResolvedValue({ data: { id: "travel-1", member_id: "m1" }, error: null });
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), { params });
    expect(res.status).toBe(200);
    expect(mockTravelOptionDelete).toHaveBeenCalled();
  });

  it("lets the trip admin delete someone else's travel option", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m2", status: "active" });
    mockTravelOptionSelect.mockResolvedValue({ data: { id: "travel-1", member_id: "m1" }, error: null });
    mockGetAuthUser.mockResolvedValue({ id: "admin-1", email: "x@example.com" });
    mockTripAdminCheck.mockResolvedValue({ data: { admin_user_id: "admin-1" }, error: null });
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), { params });
    expect(res.status).toBe(200);
    expect(mockTravelOptionDelete).toHaveBeenCalled();
  });
});
