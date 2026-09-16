import { describe, expect, it, vi, beforeEach } from "vitest";

const mockResolveCaller = vi.fn();
const mockTravelOptionsSelect = vi.fn();
const mockTravelOptionsInsert = vi.fn();
const mockExtractTravelOptionDetails = vi.fn();
const mockBroadcast = vi.fn();

vi.mock("@/lib/realtime/broadcast", () => ({ broadcastTripChange: (...args: unknown[]) => mockBroadcast(...args) }));
vi.mock("@/lib/travel/extract-travel-option", () => ({
  extractTravelOptionDetails: (...args: unknown[]) => mockExtractTravelOptionDetails(...args),
}));
vi.mock("@/lib/auth/resolve-caller", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/resolve-caller")>("@/lib/auth/resolve-caller");
  return { ...actual, resolveCaller: (...args: unknown[]) => mockResolveCaller(...args) };
});
vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ order: () => mockTravelOptionsSelect() }) }),
      insert: (row: unknown) => ({ select: () => ({ single: () => mockTravelOptionsInsert(row) }) }),
    }),
  }),
}));

import { GET, POST } from "./route";

const params = Promise.resolve({ tripId: "trip-1" });

function postRequest(body: unknown) {
  return new Request("http://localhost", { method: "POST", body: JSON.stringify(body) });
}

beforeEach(() => {
  mockResolveCaller.mockReset();
  mockTravelOptionsSelect.mockReset().mockResolvedValue({ data: [], error: null });
  mockTravelOptionsInsert.mockReset().mockResolvedValue({ data: { id: "travel-1" }, error: null });
  mockExtractTravelOptionDetails.mockReset().mockResolvedValue({ title: "IndiGo 6E-204", mode: "air", timing: null, price: null });
  mockBroadcast.mockReset();
});

describe("GET /api/trips/[tripId]/travel-options", () => {
  it("rejects a caller with no session", async () => {
    mockResolveCaller.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost"), { params });
    expect(res.status).toBe(401);
  });

  it("lists travel options for a resolved caller", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m1", status: "active" });
    mockTravelOptionsSelect.mockResolvedValue({ data: [{ id: "travel-1" }], error: null });
    const res = await GET(new Request("http://localhost"), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.travelOptions).toHaveLength(1);
  });
});

describe("POST /api/trips/[tripId]/travel-options", () => {
  it("rejects an invalid body (bad mode)", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m1", status: "active" });
    const res = await POST(postRequest({ name: "Bus", mode: "space" }), { params });
    expect(res.status).toBe(400);
  });

  it("lets a manually-given mode/timing/price win over the AI-derived ones", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m1", status: "active" });
    mockExtractTravelOptionDetails.mockResolvedValue({ title: "IndiGo 6E-204", mode: "air", timing: "06:00", price: "₹5,000" });

    const res = await POST(
      postRequest({ name: "IndiGo 6E-204", mode: "road", timing: "08:00", price: "₹4,200" }),
      { params }
    );
    expect(res.status).toBe(201);
    expect(mockTravelOptionsInsert).toHaveBeenCalledWith(
      expect.objectContaining({ trip_id: "trip-1", member_id: "m1", mode: "road", timing: "08:00", price: "₹4,200", source: "manual" })
    );
  });

  it("falls back to AI-derived timing/price when none given manually", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m1", status: "active" });
    mockExtractTravelOptionDetails.mockResolvedValue({ title: "IndiGo 6E-204", mode: "air", timing: "06:00", price: "₹5,000" });

    await POST(postRequest({ name: "IndiGo 6E-204", mode: "air" }), { params });

    expect(mockTravelOptionsInsert).toHaveBeenCalledWith(expect.objectContaining({ timing: "06:00", price: "₹5,000" }));
  });
});
