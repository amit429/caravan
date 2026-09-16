import { describe, expect, it, vi, beforeEach } from "vitest";

const mockResolveCaller = vi.fn();
const mockVoteSelect = vi.fn();
const mockVoteInsert = vi.fn();
const mockVoteDelete = vi.fn();
const mockBroadcast = vi.fn();

vi.mock("@/lib/realtime/broadcast", () => ({ broadcastTripChange: (...args: unknown[]) => mockBroadcast(...args) }));
vi.mock("@/lib/auth/resolve-caller", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/resolve-caller")>("@/lib/auth/resolve-caller");
  return { ...actual, resolveCaller: (...args: unknown[]) => mockResolveCaller(...args) };
});
vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => mockVoteSelect() }) }) }),
      insert: (row: unknown) => mockVoteInsert(row),
      delete: () => ({ eq: () => mockVoteDelete() }),
    }),
  }),
}));

import { POST } from "./route";

const params = Promise.resolve({ tripId: "trip-1", travelOptionId: "travel-1" });

beforeEach(() => {
  mockResolveCaller.mockReset();
  mockVoteSelect.mockReset();
  mockVoteInsert.mockReset().mockResolvedValue({ error: null });
  mockVoteDelete.mockReset().mockResolvedValue({ error: null });
  mockBroadcast.mockReset();
});

describe("POST /api/trips/[tripId]/travel-options/[travelOptionId]/vote", () => {
  it("rejects a caller with no session", async () => {
    mockResolveCaller.mockResolvedValue(null);
    const res = await POST(new Request("http://localhost", { method: "POST" }), { params });
    expect(res.status).toBe(401);
  });

  it("adds a vote when none exists yet", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m1", status: "active" });
    mockVoteSelect.mockResolvedValue({ data: null });
    const res = await POST(new Request("http://localhost", { method: "POST" }), { params });
    const body = await res.json();
    expect(body).toEqual({ voted: true });
    expect(mockVoteInsert).toHaveBeenCalledWith({ travel_option_id: "travel-1", member_id: "m1" });
  });

  it("removes an existing vote on a second tap", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m1", status: "active" });
    mockVoteSelect.mockResolvedValue({ data: { id: "vote-1" } });
    const res = await POST(new Request("http://localhost", { method: "POST" }), { params });
    const body = await res.json();
    expect(body).toEqual({ voted: false });
    expect(mockVoteDelete).toHaveBeenCalled();
  });
});
