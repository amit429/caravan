import { describe, expect, it, vi, beforeEach } from "vitest";

const mockResolveCaller = vi.fn();
const mockMaybeSingle = vi.fn();
const mockDelete = vi.fn();
const mockInsert = vi.fn();
const mockBroadcast = vi.fn();

vi.mock("@/lib/realtime/broadcast", () => ({ broadcastTripChange: (...args: unknown[]) => mockBroadcast(...args) }));

vi.mock("@/lib/auth/resolve-caller", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/resolve-caller")>("@/lib/auth/resolve-caller");
  return { ...actual, resolveCaller: (...args: unknown[]) => mockResolveCaller(...args) };
});
vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => mockMaybeSingle() }) }) }),
      insert: (row: unknown) => mockInsert(row),
      delete: () => ({ eq: () => mockDelete() }),
    }),
  }),
}));

import { POST } from "./route";

const params = Promise.resolve({ tripId: "trip-1", ideaId: "idea-1" });

beforeEach(() => {
  mockResolveCaller.mockReset();
  mockMaybeSingle.mockReset();
  mockDelete.mockReset().mockResolvedValue({ error: null });
  mockInsert.mockReset().mockResolvedValue({ error: null });
  mockBroadcast.mockReset();
});

describe("POST /api/trips/[tripId]/ideas/[ideaId]/vote", () => {
  it("rejects a caller with no session", async () => {
    mockResolveCaller.mockResolvedValue(null);
    const res = await POST(new Request("http://localhost", { method: "POST" }), { params });
    expect(res.status).toBe(401);
  });

  it("adds a vote when the caller hasn't voted yet", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m1", status: "active" });
    mockMaybeSingle.mockResolvedValue({ data: null });
    const res = await POST(new Request("http://localhost", { method: "POST" }), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ voted: true });
    expect(mockInsert).toHaveBeenCalledWith({ idea_id: "idea-1", member_id: "m1" });
    expect(mockBroadcast).toHaveBeenCalledWith("trip-1");
  });

  it("removes the vote when the caller already voted (toggle)", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m1", status: "active" });
    mockMaybeSingle.mockResolvedValue({ data: { id: "vote-1" } });
    const res = await POST(new Request("http://localhost", { method: "POST" }), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ voted: false });
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockBroadcast).toHaveBeenCalledWith("trip-1");
  });
});
