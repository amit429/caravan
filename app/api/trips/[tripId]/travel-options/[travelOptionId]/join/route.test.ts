import { describe, expect, it, vi, beforeEach } from "vitest";

const mockResolveCaller = vi.fn();
const mockJoinSelect = vi.fn();
const mockJoinInsert = vi.fn();
const mockJoinDelete = vi.fn();
const mockBroadcast = vi.fn();

vi.mock("@/lib/realtime/broadcast", () => ({ broadcastTripChange: (...args: unknown[]) => mockBroadcast(...args) }));
vi.mock("@/lib/auth/resolve-caller", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/resolve-caller")>("@/lib/auth/resolve-caller");
  return { ...actual, resolveCaller: (...args: unknown[]) => mockResolveCaller(...args) };
});
vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => mockJoinSelect() }) }) }),
      insert: (row: unknown) => mockJoinInsert(row),
      delete: () => ({ eq: () => mockJoinDelete() }),
    }),
  }),
}));

import { POST } from "./route";

const params = Promise.resolve({ tripId: "trip-1", travelOptionId: "travel-1" });

beforeEach(() => {
  mockResolveCaller.mockReset();
  mockJoinSelect.mockReset();
  mockJoinInsert.mockReset().mockResolvedValue({ error: null });
  mockJoinDelete.mockReset().mockResolvedValue({ error: null });
  mockBroadcast.mockReset();
});

describe("POST /api/trips/[tripId]/travel-options/[travelOptionId]/join", () => {
  it("rejects a caller with no session", async () => {
    mockResolveCaller.mockResolvedValue(null);
    const res = await POST(new Request("http://localhost", { method: "POST" }), { params });
    expect(res.status).toBe(401);
  });

  it("joins when not already on this option", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m1", status: "active" });
    mockJoinSelect.mockResolvedValue({ data: null });
    const res = await POST(new Request("http://localhost", { method: "POST" }), { params });
    const body = await res.json();
    expect(body).toEqual({ joined: true });
    expect(mockJoinInsert).toHaveBeenCalledWith({ travel_option_id: "travel-1", member_id: "m1" });
  });

  it("leaves on a second tap", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m1", status: "active" });
    mockJoinSelect.mockResolvedValue({ data: { id: "join-1" } });
    const res = await POST(new Request("http://localhost", { method: "POST" }), { params });
    const body = await res.json();
    expect(body).toEqual({ joined: false });
    expect(mockJoinDelete).toHaveBeenCalled();
  });
});
