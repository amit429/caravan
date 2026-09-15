import { describe, expect, it, vi, beforeEach } from "vitest";

const mockResolveCaller = vi.fn();
const mockGetAdminUser = vi.fn();
const mockSingle = vi.fn();
const mockUpdate = vi.fn();
const mockBroadcast = vi.fn();

vi.mock("@/lib/realtime/broadcast", () => ({ broadcastTripChange: (...args: unknown[]) => mockBroadcast(...args) }));

vi.mock("@/lib/auth/resolve-caller", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/resolve-caller")>("@/lib/auth/resolve-caller");
  return { ...actual, resolveCaller: (...args: unknown[]) => mockResolveCaller(...args) };
});
vi.mock("@/lib/auth/session", () => ({ getAuthUser: () => mockGetAdminUser() }));
vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ single: () => mockSingle() }) }) }),
      update: (patch: unknown) => ({ eq: () => ({ select: () => ({ single: () => mockUpdate(patch) }) }) }),
    }),
  }),
}));

import { PATCH } from "./route";

const params = Promise.resolve({ tripId: "trip-1", taskId: "task-1" });

function req(body: unknown) {
  return new Request("http://localhost", { method: "PATCH", body: JSON.stringify(body) });
}

beforeEach(() => {
  mockResolveCaller.mockReset();
  mockGetAdminUser.mockReset().mockResolvedValue(null);
  mockSingle.mockReset();
  mockUpdate.mockReset().mockResolvedValue({ data: { id: "task-1", done: true }, error: null });
  mockBroadcast.mockReset();
});

describe("PATCH /api/trips/[tripId]/tasks/[taskId]", () => {
  it("rejects a caller with no session", async () => {
    mockResolveCaller.mockResolvedValue(null);
    const res = await PATCH(req({ done: true }), { params });
    expect(res.status).toBe(401);
  });

  it("lets a member toggle their own task", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m1", status: "active" });
    mockSingle.mockResolvedValue({ data: { id: "task-1", member_id: "m1" }, error: null });
    const res = await PATCH(req({ done: true }), { params });
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith({ done: true });
    expect(mockBroadcast).toHaveBeenCalledWith("trip-1");
  });

  it("blocks a member from toggling someone else's task", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m1", status: "active" });
    mockSingle.mockResolvedValue({ data: { id: "task-1", member_id: "m2" }, error: null });
    const res = await PATCH(req({ done: true }), { params });
    expect(res.status).toBe(403);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("lets a member toggle a group task (member_id null)", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m1", status: "active" });
    mockSingle.mockResolvedValue({ data: { id: "task-1", member_id: null }, error: null });
    const res = await PATCH(req({ done: true }), { params });
    expect(res.status).toBe(200);
  });

  it("lets the admin toggle anyone's task", async () => {
    mockResolveCaller.mockResolvedValue({ id: "admin-member-id", status: "active", role: "admin" });
    mockSingle.mockResolvedValue({ data: { id: "task-1", member_id: "m2" }, error: null });
    const res = await PATCH(req({ done: true }), { params });
    expect(res.status).toBe(200);
  });
});
