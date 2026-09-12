import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetAdminUser = vi.fn();
const mockGetMemberSession = vi.fn();
const mockTripSingle = vi.fn();
const mockMemberMaybeSingle = vi.fn();
const mockInsertSingle = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  getAdminUser: () => mockGetAdminUser(),
  getMemberSession: () => mockGetMemberSession(),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => ({
    from: (table: string) => {
      if (table === "trips") {
        return { select: () => ({ eq: () => ({ single: () => mockTripSingle() }) }) };
      }
      if (table === "members") {
        return {
          select: () => ({
            eq: () => ({ eq: () => ({ maybeSingle: () => mockMemberMaybeSingle() }) }),
          }),
        };
      }
      if (table === "messages") {
        return { insert: (row: unknown) => ({ select: () => ({ single: () => mockInsertSingle(row) }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { POST } from "./route";

beforeEach(() => {
  mockGetAdminUser.mockReset();
  mockGetMemberSession.mockReset();
  mockTripSingle.mockReset();
  mockMemberMaybeSingle.mockReset();
  mockInsertSingle.mockReset();
});

function postRequest(body: unknown) {
  return new Request("http://localhost/api/trips/trip-1/messages", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/trips/[tripId]/messages", () => {
  it("rejects a caller with neither admin nor member session", async () => {
    mockGetAdminUser.mockResolvedValue(null);
    mockGetMemberSession.mockResolvedValue(null);
    const res = await POST(postRequest({ body: "hi" }), { params: Promise.resolve({ tripId: "trip-1" }) });
    expect(res.status).toBe(401);
  });

  it("blocks posting while the trip is still in the lobby", async () => {
    mockGetAdminUser.mockResolvedValue(null);
    mockGetMemberSession.mockResolvedValue({ tripId: "trip-1", memberId: "member-1" });
    mockMemberMaybeSingle.mockResolvedValue({ data: { id: "member-1", status: "active" }, error: null });
    mockTripSingle.mockResolvedValue({ data: { id: "trip-1", status: "lobby" }, error: null });
    const res = await POST(postRequest({ body: "hi" }), { params: Promise.resolve({ tripId: "trip-1" }) });
    expect(res.status).toBe(409);
  });

  it("returns 403 for a removed member instead of posting", async () => {
    mockGetAdminUser.mockResolvedValue(null);
    mockGetMemberSession.mockResolvedValue({ tripId: "trip-1", memberId: "member-1" });
    mockMemberMaybeSingle.mockResolvedValue({ data: { id: "member-1", status: "removed" }, error: null });
    const res = await POST(postRequest({ body: "hi" }), { params: Promise.resolve({ tripId: "trip-1" }) });
    expect(res.status).toBe(403);
  });

  it("posts a message once the trip is active", async () => {
    mockGetAdminUser.mockResolvedValue(null);
    mockGetMemberSession.mockResolvedValue({ tripId: "trip-1", memberId: "member-1" });
    mockMemberMaybeSingle.mockResolvedValue({ data: { id: "member-1", status: "active" }, error: null });
    mockTripSingle.mockResolvedValue({ data: { id: "trip-1", status: "active" }, error: null });
    mockInsertSingle.mockResolvedValue({
      data: { id: "msg-1", trip_id: "trip-1", body: "hi", author_id: "member-1" },
      error: null,
    });
    const res = await POST(postRequest({ body: "hi" }), { params: Promise.resolve({ tripId: "trip-1" }) });
    expect(res.status).toBe(201);
  });
});
