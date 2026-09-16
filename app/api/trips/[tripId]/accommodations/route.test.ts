import { describe, expect, it, vi, beforeEach } from "vitest";

const mockResolveCaller = vi.fn();
const mockAccommodationsSelect = vi.fn();
const mockAccommodationsInsert = vi.fn();
const mockExtractAccommodationDetails = vi.fn();
const mockBroadcast = vi.fn();

vi.mock("@/lib/realtime/broadcast", () => ({ broadcastTripChange: (...args: unknown[]) => mockBroadcast(...args) }));
vi.mock("@/lib/accommodations/extract-accommodation", () => ({
  extractAccommodationDetails: (...args: unknown[]) => mockExtractAccommodationDetails(...args),
}));
vi.mock("@/lib/auth/resolve-caller", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/resolve-caller")>("@/lib/auth/resolve-caller");
  return { ...actual, resolveCaller: (...args: unknown[]) => mockResolveCaller(...args) };
});
vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ order: () => mockAccommodationsSelect() }) }),
      insert: (row: unknown) => ({ select: () => ({ single: () => mockAccommodationsInsert(row) }) }),
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
  mockAccommodationsSelect.mockReset().mockResolvedValue({ data: [], error: null });
  mockAccommodationsInsert.mockReset().mockResolvedValue({ data: { id: "accom-1" }, error: null });
  mockExtractAccommodationDetails.mockReset().mockResolvedValue({ title: "Alaya Ubud", imageUrl: null, price: null, area: "Ubud" });
  mockBroadcast.mockReset();
});

describe("GET /api/trips/[tripId]/accommodations", () => {
  it("rejects a caller with no session", async () => {
    mockResolveCaller.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost"), { params });
    expect(res.status).toBe(401);
  });

  it("lists accommodations for a resolved caller", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m1", status: "active" });
    mockAccommodationsSelect.mockResolvedValue({ data: [{ id: "accom-1" }], error: null });
    const res = await GET(new Request("http://localhost"), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.accommodations).toHaveLength(1);
  });
});

describe("POST /api/trips/[tripId]/accommodations", () => {
  it("rejects an invalid body", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m1", status: "active" });
    const res = await POST(postRequest({ name: "" }), { params });
    expect(res.status).toBe(400);
  });

  it("enriches via extractAccommodationDetails and lets a manual price win over the AI-derived one", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m1", status: "active" });
    mockExtractAccommodationDetails.mockResolvedValue({ title: "Alaya Ubud", imageUrl: "https://x.com/p.jpg", price: "₹4,000/night", area: "Ubud" });

    const res = await POST(postRequest({ name: "Alaya Ubud", url: "https://example.com/hotel", price: "₹3,500/night" }), { params });
    expect(res.status).toBe(201);

    expect(mockExtractAccommodationDetails).toHaveBeenCalledWith({ name: "Alaya Ubud", url: "https://example.com/hotel" });
    expect(mockAccommodationsInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        trip_id: "trip-1",
        member_id: "m1",
        name: "Alaya Ubud",
        price: "₹3,500/night",
        area: "Ubud",
        source: "manual",
      })
    );
  });

  it("falls back to the AI-derived price when none was given manually", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m1", status: "active" });
    mockExtractAccommodationDetails.mockResolvedValue({ title: "Alaya Ubud", imageUrl: null, price: "₹4,000/night", area: "Ubud" });

    await POST(postRequest({ name: "Alaya Ubud" }), { params });

    expect(mockAccommodationsInsert).toHaveBeenCalledWith(expect.objectContaining({ price: "₹4,000/night" }));
  });
});
