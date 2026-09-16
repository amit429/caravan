import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetAuthUser = vi.fn();
const mockTripOwnerCheck = vi.fn();
const mockIdeaSelect = vi.fn();
const mockBookingInsert = vi.fn();
const mockBroadcast = vi.fn();

vi.mock("@/lib/realtime/broadcast", () => ({ broadcastTripChange: (...args: unknown[]) => mockBroadcast(...args) }));
vi.mock("@/lib/auth/session", () => ({ getAuthUser: () => mockGetAuthUser() }));
vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => ({
    from: (table: string) => {
      if (table === "trips") return { select: () => ({ eq: () => ({ maybeSingle: () => mockTripOwnerCheck() }) }) };
      if (table === "ideas") return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => mockIdeaSelect() }) }) }) };
      if (table === "bookings") {
        return { insert: (row: unknown) => ({ select: () => ({ single: () => mockBookingInsert(row) }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { POST } from "./route";

const params = Promise.resolve({ tripId: "trip-1", ideaId: "idea-1" });

beforeEach(() => {
  mockGetAuthUser.mockReset();
  mockTripOwnerCheck.mockReset();
  mockIdeaSelect.mockReset();
  mockBookingInsert.mockReset().mockResolvedValue({ data: { id: "booking-1", item: "Some Hotel" }, error: null });
  mockBroadcast.mockReset();
});

describe("POST /api/trips/[tripId]/ideas/[ideaId]/promote", () => {
  it("rejects a non-owning admin", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "admin-2", email: "x@example.com" });
    mockTripOwnerCheck.mockResolvedValue({ data: { admin_user_id: "admin-1" }, error: null });
    const res = await POST(new Request("http://localhost", { method: "POST" }), { params });
    expect(res.status).toBe(403);
    expect(mockBookingInsert).not.toHaveBeenCalled();
  });

  it("404s when the idea doesn't exist on this trip", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "admin-1", email: "x@example.com" });
    mockTripOwnerCheck.mockResolvedValue({ data: { admin_user_id: "admin-1" }, error: null });
    mockIdeaSelect.mockResolvedValue({ data: null });
    const res = await POST(new Request("http://localhost", { method: "POST" }), { params });
    expect(res.status).toBe(404);
  });

  it("rejects promoting a plain activity idea (only stay/travel suggestions qualify)", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "admin-1", email: "x@example.com" });
    mockTripOwnerCheck.mockResolvedValue({ data: { admin_user_id: "admin-1" }, error: null });
    mockIdeaSelect.mockResolvedValue({ data: { id: "idea-1", title: "Scuba diving", url: null, category: "activity" } });
    const res = await POST(new Request("http://localhost", { method: "POST" }), { params });
    expect(res.status).toBe(400);
    expect(mockBookingInsert).not.toHaveBeenCalled();
  });

  it("creates a booking from a stay/travel suggestion for the owning admin", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "admin-1", email: "x@example.com" });
    mockTripOwnerCheck.mockResolvedValue({ data: { admin_user_id: "admin-1" }, error: null });
    mockIdeaSelect.mockResolvedValue({ data: { id: "idea-1", title: "Some Hotel", url: "https://example.com", category: "stay" } });
    const res = await POST(new Request("http://localhost", { method: "POST" }), { params });
    expect(res.status).toBe(201);
    expect(mockBookingInsert).toHaveBeenCalledWith(
      expect.objectContaining({ trip_id: "trip-1", item: "Some Hotel" })
    );
    expect(mockBroadcast).toHaveBeenCalledWith("trip-1");
  });
});
