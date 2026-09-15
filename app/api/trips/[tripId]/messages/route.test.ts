import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetAdminUser = vi.fn();
const mockGetMemberSession = vi.fn();
const mockTripSingle = vi.fn();
const mockMemberMaybeSingle = vi.fn();
const mockInsertSingle = vi.fn();
const mockMessagesSelect = vi.fn();
const mockAfter = vi.fn();
const mockBroadcast = vi.fn();

vi.mock("@/lib/realtime/broadcast", () => ({ broadcastTripChange: (...args: unknown[]) => mockBroadcast(...args) }));

vi.mock("@/lib/auth/session", () => ({
  getAdminUser: () => mockGetAdminUser(),
  getMemberSession: () => mockGetMemberSession(),
}));

// `after()` requires a real Next.js request scope, which a unit test never
// has. Stub it as a no-op recorder — the deferred callback (Scribe) is
// exercised separately, not through this route's tests.
vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...actual, after: (fn: unknown) => mockAfter(fn) };
});

vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => ({
    from: (table: string) => {
      if (table === "trips") {
        return { select: () => ({ eq: () => ({ single: () => mockTripSingle() }) }) };
      }
      if (table === "members") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({ maybeSingle: () => mockMemberMaybeSingle() }),
              single: () => mockMemberMaybeSingle(),
            }),
          }),
        };
      }
      if (table === "messages") {
        return {
          insert: (row: unknown) => ({ select: () => ({ single: () => mockInsertSingle(row) }) }),
          select: () => ({ eq: () => ({ eq: () => ({ order: () => mockMessagesSelect() }) }) }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { GET, POST } from "./route";

beforeEach(() => {
  mockGetAdminUser.mockReset();
  mockGetMemberSession.mockReset();
  mockTripSingle.mockReset();
  mockMemberMaybeSingle.mockReset();
  mockInsertSingle.mockReset();
  mockMessagesSelect.mockReset();
  mockAfter.mockReset();
  mockBroadcast.mockReset();
});

describe("GET /api/trips/[tripId]/messages", () => {
  it("rejects a caller with no session", async () => {
    mockGetAdminUser.mockResolvedValue(null);
    mockGetMemberSession.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost"), { params: Promise.resolve({ tripId: "trip-1" }) });
    expect(res.status).toBe(401);
  });

  it("lists only group-lane messages for a resolved caller", async () => {
    mockGetAdminUser.mockResolvedValue(null);
    mockGetMemberSession.mockResolvedValue({ tripId: "trip-1", memberId: "member-1" });
    mockMemberMaybeSingle.mockResolvedValue({ data: { id: "member-1", status: "active" }, error: null });
    mockMessagesSelect.mockResolvedValue({ data: [{ id: "msg-1", lane: "group" }], error: null });
    const res = await GET(new Request("http://localhost"), { params: Promise.resolve({ tripId: "trip-1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.messages).toEqual([{ id: "msg-1", lane: "group" }]);
  });
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
    expect(mockBroadcast).toHaveBeenCalledWith("trip-1", {
      type: "message",
      message: { id: "msg-1", trip_id: "trip-1", body: "hi", author_id: "member-1" },
    });
  });
});
