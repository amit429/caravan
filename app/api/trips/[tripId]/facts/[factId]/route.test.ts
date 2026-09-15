import { describe, expect, it, vi, beforeEach } from "vitest";

const mockResolveCaller = vi.fn();
const mockFactSelect = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockBroadcast = vi.fn();

vi.mock("@/lib/realtime/broadcast", () => ({ broadcastTripChange: (...args: unknown[]) => mockBroadcast(...args) }));
vi.mock("@/lib/auth/resolve-caller", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/resolve-caller")>("@/lib/auth/resolve-caller");
  return { ...actual, resolveCaller: (...args: unknown[]) => mockResolveCaller(...args) };
});
vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => mockFactSelect() }) }) }),
      update: (patch: unknown) => ({ eq: () => ({ select: () => ({ single: () => mockUpdate(patch) }) }) }),
      delete: () => ({ eq: () => mockDelete() }),
    }),
  }),
}));

import { PATCH, DELETE } from "./route";

const params = Promise.resolve({ tripId: "trip-1", factId: "fact-1" });

function patchRequest(body: unknown) {
  return new Request("http://localhost", { method: "PATCH", body: JSON.stringify(body) });
}

beforeEach(() => {
  mockResolveCaller.mockReset();
  mockFactSelect.mockReset();
  mockUpdate.mockReset().mockResolvedValue({ data: { id: "fact-1", type: "SOFT" }, error: null });
  mockDelete.mockReset().mockResolvedValue({ error: null });
  mockBroadcast.mockReset();
});

describe("PATCH /api/trips/[tripId]/facts/[factId]", () => {
  it("rejects a caller with no session", async () => {
    mockResolveCaller.mockResolvedValue(null);
    const res = await PATCH(patchRequest({ type: "SOFT" }), { params });
    expect(res.status).toBe(401);
  });

  it("rejects an invalid body", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m1", status: "active" });
    const res = await PATCH(patchRequest({ type: "HARD" }), { params });
    expect(res.status).toBe(400);
  });

  it("returns 404 for a fact outside this trip", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m1", status: "active" });
    mockFactSelect.mockResolvedValue({ data: null, error: null });
    const res = await PATCH(patchRequest({ type: "SOFT" }), { params });
    expect(res.status).toBe(404);
  });

  it("blocks softening someone else's fact", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m2", status: "active" });
    mockFactSelect.mockResolvedValue({ data: { id: "fact-1", member_id: "m1" }, error: null });
    const res = await PATCH(patchRequest({ type: "SOFT" }), { params });
    expect(res.status).toBe(403);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("lets the fact's own member soften it", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m1", status: "active" });
    mockFactSelect.mockResolvedValue({ data: { id: "fact-1", member_id: "m1" }, error: null });
    const res = await PATCH(patchRequest({ type: "SOFT" }), { params });
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith({ type: "SOFT" });
    expect(mockBroadcast).toHaveBeenCalledWith("trip-1");
  });
});

describe("DELETE /api/trips/[tripId]/facts/[factId]", () => {
  it("blocks deleting someone else's fact", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m2", status: "active" });
    mockFactSelect.mockResolvedValue({ data: { id: "fact-1", member_id: "m1" }, error: null });
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), { params });
    expect(res.status).toBe(403);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("lets the fact's own member delete it", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m1", status: "active" });
    mockFactSelect.mockResolvedValue({ data: { id: "fact-1", member_id: "m1" }, error: null });
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), { params });
    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalled();
    expect(mockBroadcast).toHaveBeenCalledWith("trip-1");
  });
});
