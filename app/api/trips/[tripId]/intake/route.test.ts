import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetAdminUser = vi.fn();
const mockGetMemberSession = vi.fn();
const mockInsertAvailability = vi.fn();
const mockInsertFacts = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  getAdminUser: () => mockGetAdminUser(),
  getMemberSession: () => mockGetMemberSession(),
}));

// A minimal thenable query-builder stand-in: every chain method returns itself,
// and awaiting it resolves via `then`. This mirrors how supabase-js's real
// builder works without hardcoding one fixed chain depth per call site.
function chainable(resolvedValue: unknown) {
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    is: () => builder,
    delete: () => builder,
    maybeSingle: () => Promise.resolve(resolvedValue),
    single: () => Promise.resolve(resolvedValue),
    then: (resolve: (v: unknown) => void) => resolve(resolvedValue),
  };
  return builder;
}

vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => ({
    from: (table: string) => {
      if (table === "members") {
        return { select: () => chainable({ data: { id: "member-1", status: "active" }, error: null }) };
      }
      if (table === "availability") {
        return {
          select: () => chainable({ data: [], error: null }),
          delete: () => chainable({ error: null }),
          insert: (rows: unknown) => mockInsertAvailability(rows),
        };
      }
      if (table === "facts") {
        return {
          select: () => chainable({ data: [], error: null }),
          delete: () => chainable({ error: null }),
          insert: (rows: unknown) => mockInsertFacts(rows),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { POST } from "./route";

const validIntake = {
  availability: [{ startDate: "2026-11-01", endDate: "2026-11-10", strength: "free" }],
  budgetBand: "10-20k",
  departureCity: "Pune",
  vibe: ["Beach"],
  hardNos: ["No overnight buses"],
};

function postRequest(body: unknown) {
  return new Request("http://localhost/api/trips/trip-1/intake", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockGetAdminUser.mockReset();
  mockGetMemberSession.mockReset();
  mockInsertAvailability.mockReset().mockResolvedValue({ error: null });
  mockInsertFacts.mockReset().mockResolvedValue({ error: null });
});

describe("POST /api/trips/[tripId]/intake", () => {
  it("rejects a caller with no session", async () => {
    mockGetAdminUser.mockResolvedValue(null);
    mockGetMemberSession.mockResolvedValue(null);
    const res = await POST(postRequest(validIntake), { params: Promise.resolve({ tripId: "trip-1" }) });
    expect(res.status).toBe(401);
  });

  it("rejects an invalid body", async () => {
    mockGetAdminUser.mockResolvedValue(null);
    mockGetMemberSession.mockResolvedValue({ tripId: "trip-1", memberId: "member-1" });
    const res = await POST(postRequest({ ...validIntake, availability: [] }), {
      params: Promise.resolve({ tripId: "trip-1" }),
    });
    expect(res.status).toBe(400);
  });

  it("saves availability and facts for a valid submission", async () => {
    mockGetAdminUser.mockResolvedValue(null);
    mockGetMemberSession.mockResolvedValue({ tripId: "trip-1", memberId: "member-1" });
    const res = await POST(postRequest(validIntake), { params: Promise.resolve({ tripId: "trip-1" }) });
    expect(res.status).toBe(201);

    expect(mockInsertAvailability).toHaveBeenCalledWith([
      expect.objectContaining({ trip_id: "trip-1", member_id: "member-1", start_date: "2026-11-01", strength: "free" }),
    ]);

    const factRows = mockInsertFacts.mock.calls[0][0];
    expect(factRows).toHaveLength(4);
    expect(factRows).toContainEqual(
      expect.objectContaining({ category: "hard_no", type: "HARD", value: { items: ["No overnight buses"] } })
    );
    expect(factRows).toContainEqual(
      expect.objectContaining({ category: "budget", type: "SOFT", value: { band: "10-20k" } })
    );
  });
});
