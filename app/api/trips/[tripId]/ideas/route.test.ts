import { describe, expect, it, vi, beforeEach } from "vitest";

const mockResolveCaller = vi.fn();
const mockExtract = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockBroadcast = vi.fn();

vi.mock("@/lib/realtime/broadcast", () => ({ broadcastTripChange: (...args: unknown[]) => mockBroadcast(...args) }));

vi.mock("@/lib/auth/resolve-caller", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/resolve-caller")>("@/lib/auth/resolve-caller");
  return { ...actual, resolveCaller: (...args: unknown[]) => mockResolveCaller(...args) };
});
vi.mock("@/lib/ideas/extract-idea", () => ({ extractIdeaMetadata: (...args: unknown[]) => mockExtract(...args) }));
vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => ({
    from: (table: string) => {
      if (table === "ideas") {
        return {
          select: () => ({ eq: () => ({ order: () => mockSelect() }) }),
          insert: (row: unknown) => ({ select: () => ({ single: () => mockInsert(row) }) }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { GET, POST } from "./route";

const params = Promise.resolve({ tripId: "trip-1" });

beforeEach(() => {
  mockResolveCaller.mockReset();
  mockExtract.mockReset();
  mockSelect.mockReset();
  mockInsert.mockReset();
  mockBroadcast.mockReset();
});

describe("GET /api/trips/[tripId]/ideas", () => {
  it("rejects a caller with no session", async () => {
    mockResolveCaller.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost"), { params });
    expect(res.status).toBe(401);
  });

  it("lists ideas for a resolved caller", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m1", status: "active" });
    mockSelect.mockResolvedValue({ data: [{ id: "idea-1" }], error: null });
    const res = await GET(new Request("http://localhost"), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ideas).toEqual([{ id: "idea-1" }]);
  });
});

describe("POST /api/trips/[tripId]/ideas", () => {
  it("rejects an invalid url", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m1", status: "active" });
    const res = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ url: "not-a-url" }) }), {
      params,
    });
    expect(res.status).toBe(400);
    expect(mockExtract).not.toHaveBeenCalled();
  });

  it("extracts metadata and stores the idea under the caller", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m1", status: "active" });
    mockExtract.mockResolvedValue({ title: "Waterfall Trek", note: "A forest trek.", imageUrl: "https://x.com/p.jpg" });
    mockInsert.mockResolvedValue({ data: { id: "idea-1" }, error: null });

    const res = await POST(
      new Request("http://localhost", { method: "POST", body: JSON.stringify({ url: "https://example.com/trek" }) }),
      { params }
    );
    expect(res.status).toBe(201);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        trip_id: "trip-1",
        member_id: "m1",
        url: "https://example.com/trek",
        title: "Waterfall Trek",
        note: "A forest trek.",
        image_url: "https://x.com/p.jpg",
      })
    );
    expect(mockBroadcast).toHaveBeenCalledWith("trip-1");
  });
});
