import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetAdminUser = vi.fn();
const mockSingle = vi.fn();
const mockUpdate = vi.fn();
const mockBroadcast = vi.fn();
const mockResolveCaller = vi.fn();
const mockTripGet = vi.fn();
const mockMembersGet = vi.fn();
const mockPostAgentMessage = vi.fn();
const mockTripOwnerCheck = vi.fn();
const mockTripDelete = vi.fn();
const mockMemberCount = vi.fn();

vi.mock("@/lib/realtime/broadcast", () => ({ broadcastTripChange: (...args: unknown[]) => mockBroadcast(...args) }));
vi.mock("@/lib/agents/post-agent-message", () => ({ postAgentMessage: (...args: unknown[]) => mockPostAgentMessage(...args) }));

vi.mock("@/lib/auth/resolve-caller", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/resolve-caller")>("@/lib/auth/resolve-caller");
  return { ...actual, resolveCaller: (...args: unknown[]) => mockResolveCaller(...args) };
});

vi.mock("@/lib/auth/session", () => ({
  getAuthUser: () => mockGetAdminUser(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: () => ({
    from: (table: string) => {
      if (table === "members") return { select: () => ({ eq: () => ({ eq: () => mockMemberCount() }) }) };
      return {
        select: () => ({
          eq: () => ({
            single: () => mockSingle(),
          }),
        }),
        update: (patch: unknown) => ({
          eq: () => ({
            select: () => ({
              single: () => mockUpdate(patch),
            }),
          }),
        }),
      };
    },
  }),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => ({
    from: (table: string) => {
      if (table === "trips") {
        return {
          select: () => ({ eq: () => ({ single: () => mockTripGet(), maybeSingle: () => mockTripOwnerCheck() }) }),
          delete: () => ({ eq: () => mockTripDelete() }),
        };
      }
      if (table === "members") return { select: () => ({ eq: () => ({ eq: () => ({ order: () => mockMembersGet() }) }) }) };
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { GET, PATCH, DELETE } from "./route";

const params = Promise.resolve({ tripId: "trip-1" });

beforeEach(() => {
  mockGetAdminUser.mockReset();
  mockSingle.mockReset();
  mockUpdate.mockReset().mockResolvedValue({ data: { id: "trip-1", status: "active" }, error: null });
  mockBroadcast.mockReset();
  mockResolveCaller.mockReset();
  mockTripGet.mockReset();
  mockMembersGet.mockReset().mockResolvedValue({ data: [], error: null });
  mockPostAgentMessage.mockReset();
  mockTripOwnerCheck.mockReset();
  mockTripDelete.mockReset().mockResolvedValue({ error: null });
  mockMemberCount.mockReset().mockResolvedValue({ count: 4, error: null });
});

describe("GET /api/trips/[tripId]", () => {
  it("rejects a caller with no session", async () => {
    mockResolveCaller.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost"), { params });
    expect(res.status).toBe(401);
  });

  it("rejects a removed member", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m1", status: "removed" });
    const res = await GET(new Request("http://localhost"), { params });
    expect(res.status).toBe(403);
  });

  it("returns trip status and active members for a resolved caller", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m1", status: "active" });
    mockTripGet.mockResolvedValue({ data: { id: "trip-1", name: "Goa", status: "lobby" }, error: null });
    mockMembersGet.mockResolvedValue({ data: [{ id: "m1", display_name: "Rhea" }], error: null });
    const res = await GET(new Request("http://localhost"), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.trip).toEqual({ id: "trip-1", name: "Goa", status: "lobby" });
    expect(body.members).toHaveLength(1);
  });
});

function patchRequest(action: string) {
  return new Request("http://localhost/api/trips/trip-1", {
    method: "PATCH",
    body: JSON.stringify({ action }),
  });
}

describe("PATCH /api/trips/[tripId]", () => {
  it("rejects a non-owning admin", async () => {
    mockGetAdminUser.mockResolvedValue({ id: "admin-2", email: "x@example.com" });
    mockSingle.mockResolvedValue({ data: { id: "trip-1", admin_user_id: "admin-1", status: "lobby" }, error: null });
    const res = await PATCH(patchRequest("start"), { params: Promise.resolve({ tripId: "trip-1" }) });
    expect(res.status).toBe(403);
  });

  it("rejects starting a trip that's already active", async () => {
    mockGetAdminUser.mockResolvedValue({ id: "admin-1", email: "x@example.com" });
    mockSingle.mockResolvedValue({ data: { id: "trip-1", admin_user_id: "admin-1", status: "active" }, error: null });
    const res = await PATCH(patchRequest("start"), { params: Promise.resolve({ tripId: "trip-1" }) });
    expect(res.status).toBe(409);
  });

  it("rejects starting a trip with 3 or fewer active members", async () => {
    mockGetAdminUser.mockResolvedValue({ id: "admin-1", email: "x@example.com" });
    mockSingle.mockResolvedValue({ data: { id: "trip-1", admin_user_id: "admin-1", status: "lobby" }, error: null });
    mockMemberCount.mockResolvedValue({ count: 3, error: null });
    const res = await PATCH(patchRequest("start"), { params: Promise.resolve({ tripId: "trip-1" }) });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("not_enough_members");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("starts a lobby trip and posts the kickoff message", async () => {
    mockGetAdminUser.mockResolvedValue({ id: "admin-1", email: "x@example.com" });
    mockSingle.mockResolvedValue({
      data: { id: "trip-1", admin_user_id: "admin-1", status: "lobby", rough_intent: "Beachy weekend", vibe: [], budget_hint: null },
      error: null,
    });
    mockUpdate.mockResolvedValue({ data: { id: "trip-1", status: "active" }, error: null });
    const res = await PATCH(patchRequest("start"), { params: Promise.resolve({ tripId: "trip-1" }) });
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "active" }));
    expect(mockBroadcast).toHaveBeenCalledWith("trip-1");
    expect(mockPostAgentMessage).toHaveBeenCalledWith(
      expect.objectContaining({ tripId: "trip-1", agentName: "concierge", body: expect.stringContaining("Beachy weekend") })
    );
  });
});

describe("DELETE /api/trips/[tripId]", () => {
  it("rejects a non-owning admin", async () => {
    mockGetAdminUser.mockResolvedValue({ id: "admin-2", email: "x@example.com" });
    mockTripOwnerCheck.mockResolvedValue({ data: { admin_user_id: "admin-1" }, error: null });
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), { params });
    expect(res.status).toBe(403);
    expect(mockTripDelete).not.toHaveBeenCalled();
  });

  it("deletes the trip for the owning admin", async () => {
    mockGetAdminUser.mockResolvedValue({ id: "admin-1", email: "x@example.com" });
    mockTripOwnerCheck.mockResolvedValue({ data: { admin_user_id: "admin-1" }, error: null });
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), { params });
    expect(res.status).toBe(200);
    expect(mockTripDelete).toHaveBeenCalled();
  });
});
