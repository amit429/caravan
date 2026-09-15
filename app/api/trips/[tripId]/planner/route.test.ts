import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetAdminUser = vi.fn();
const mockRunPlanner = vi.fn();
const mockTripSingle = vi.fn();

vi.mock("@/lib/auth/session", () => ({ getAuthUser: () => mockGetAdminUser() }));
vi.mock("@/lib/agents/planner", () => ({ runPlanner: (...args: unknown[]) => mockRunPlanner(...args) }));
vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => mockTripSingle() }) }) }),
  }),
}));

import { POST } from "./route";

const params = Promise.resolve({ tripId: "trip-1" });

beforeEach(() => {
  mockGetAdminUser.mockReset();
  mockRunPlanner.mockReset();
  mockTripSingle.mockReset().mockResolvedValue({ data: { admin_user_id: "admin-1" }, error: null });
});

describe("POST /api/trips/[tripId]/planner", () => {
  it("rejects a non-admin caller", async () => {
    mockGetAdminUser.mockResolvedValue(null);
    const res = await POST(new Request("http://localhost", { method: "POST" }), { params });
    expect(res.status).toBe(401);
    expect(mockRunPlanner).not.toHaveBeenCalled();
  });

  it("rejects an admin who doesn't own this trip", async () => {
    mockGetAdminUser.mockResolvedValue({ id: "admin-2", email: "other@example.com" });
    const res = await POST(new Request("http://localhost", { method: "POST" }), { params });
    expect(res.status).toBe(403);
    expect(mockRunPlanner).not.toHaveBeenCalled();
  });

  it("returns 409 with the reason when Planner declines to run", async () => {
    mockGetAdminUser.mockResolvedValue({ id: "admin-1", email: "amit@example.com" });
    mockRunPlanner.mockResolvedValue({ ok: false, reason: "Lock a destination first." });
    const res = await POST(new Request("http://localhost", { method: "POST" }), { params });
    expect(res.status).toBe(409);
  });

  it("returns 201 when Planner succeeds", async () => {
    mockGetAdminUser.mockResolvedValue({ id: "admin-1", email: "amit@example.com" });
    mockRunPlanner.mockResolvedValue({ ok: true });
    const res = await POST(new Request("http://localhost", { method: "POST" }), { params });
    expect(res.status).toBe(201);
  });
});
