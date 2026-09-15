import { describe, expect, it, vi, beforeEach } from "vitest";

const mockResolveCaller = vi.fn();
const mockGetAdminUser = vi.fn();
const mockIdeaSelect = vi.fn();
const mockTripSingle = vi.fn();
const mockDelete = vi.fn();
const mockBroadcast = vi.fn();

vi.mock("@/lib/realtime/broadcast", () => ({ broadcastTripChange: (...args: unknown[]) => mockBroadcast(...args) }));
vi.mock("@/lib/auth/session", () => ({ getAuthUser: () => mockGetAdminUser() }));
vi.mock("@/lib/auth/resolve-caller", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/resolve-caller")>("@/lib/auth/resolve-caller");
  return { ...actual, resolveCaller: (...args: unknown[]) => mockResolveCaller(...args) };
});
vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => ({
    from: (table: string) => {
      if (table === "ideas") {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => mockIdeaSelect() }) }) }),
          delete: () => ({ eq: () => mockDelete() }),
        };
      }
      if (table === "trips") return { select: () => ({ eq: () => ({ single: () => mockTripSingle() }) }) };
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { DELETE } from "./route";

const params = Promise.resolve({ tripId: "trip-1", ideaId: "idea-1" });

beforeEach(() => {
  mockResolveCaller.mockReset();
  mockGetAdminUser.mockReset();
  mockIdeaSelect.mockReset();
  mockTripSingle.mockReset();
  mockDelete.mockReset().mockResolvedValue({ error: null });
  mockBroadcast.mockReset();
});

describe("DELETE /api/trips/[tripId]/ideas/[ideaId]", () => {
  it("rejects a caller with no session", async () => {
    mockResolveCaller.mockResolvedValue(null);
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), { params });
    expect(res.status).toBe(401);
  });

  it("returns 404 for an idea outside this trip", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m1", status: "active" });
    mockIdeaSelect.mockResolvedValue({ data: null, error: null });
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), { params });
    expect(res.status).toBe(404);
  });

  it("lets the author delete their own idea", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m1", status: "active" });
    mockIdeaSelect.mockResolvedValue({ data: { id: "idea-1", member_id: "m1" }, error: null });
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), { params });
    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalled();
    expect(mockBroadcast).toHaveBeenCalledWith("trip-1");
  });

  it("blocks a different member from deleting someone else's idea", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m2", status: "active" });
    mockIdeaSelect.mockResolvedValue({ data: { id: "idea-1", member_id: "m1" }, error: null });
    mockGetAdminUser.mockResolvedValue(null);
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), { params });
    expect(res.status).toBe(403);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("lets the trip's own admin delete someone else's idea", async () => {
    mockResolveCaller.mockResolvedValue({ id: "admin-member-1", status: "active" });
    mockIdeaSelect.mockResolvedValue({ data: { id: "idea-1", member_id: "m1" }, error: null });
    mockGetAdminUser.mockResolvedValue({ id: "admin-1", email: "amit@example.com" });
    mockTripSingle.mockResolvedValue({ data: { admin_user_id: "admin-1" }, error: null });
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), { params });
    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalled();
  });

  it("blocks an admin of a different trip", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m3", status: "active" });
    mockIdeaSelect.mockResolvedValue({ data: { id: "idea-1", member_id: "m1" }, error: null });
    mockGetAdminUser.mockResolvedValue({ id: "admin-2", email: "other@example.com" });
    mockTripSingle.mockResolvedValue({ data: { admin_user_id: "admin-1" }, error: null });
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), { params });
    expect(res.status).toBe(403);
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
