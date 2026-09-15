import { describe, expect, it, vi, beforeEach } from "vitest";

const mockTripSingle = vi.fn();
const mockMembersCount = vi.fn();

vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => ({
    from: (table: string) => {
      if (table === "trips") {
        return { select: () => ({ eq: () => ({ single: () => mockTripSingle() }) }) };
      }
      if (table === "members") {
        return { select: () => ({ eq: () => mockMembersCount() }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { GET } from "./route";

beforeEach(() => {
  mockTripSingle.mockReset();
  mockMembersCount.mockReset().mockResolvedValue({ count: 3 });
});

describe("GET /api/join/[code]", () => {
  it("404s for an unknown invite code", async () => {
    mockTripSingle.mockResolvedValue({ data: null, error: { message: "not found" } });
    const res = await GET(new Request("http://localhost"), { params: Promise.resolve({ code: "ABCDEF" }) });
    expect(res.status).toBe(404);
  });

  it("returns the trip peek and joinable flag", async () => {
    mockTripSingle.mockResolvedValue({
      data: { id: "trip-1", name: "Goa, probably", rough_intent: "Beachy weekend", joining_open: true, status: "lobby" },
      error: null,
    });
    const res = await GET(new Request("http://localhost"), { params: Promise.resolve({ code: "ABCDEF" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.trip).toEqual({ name: "Goa, probably", roughIntent: "Beachy weekend", memberCount: 3 });
    expect(body.joinable).toBe(true);
  });

  it("marks a closed trip as not joinable", async () => {
    mockTripSingle.mockResolvedValue({
      data: { id: "trip-1", name: "Goa, probably", rough_intent: null, joining_open: true, status: "closed" },
      error: null,
    });
    const res = await GET(new Request("http://localhost"), { params: Promise.resolve({ code: "ABCDEF" }) });
    const body = await res.json();
    expect(body.joinable).toBe(false);
  });
});
