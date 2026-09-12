import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetAdminUser = vi.fn();
const mockRunScout = vi.fn();

vi.mock("@/lib/auth/session", () => ({ getAdminUser: () => mockGetAdminUser() }));
vi.mock("@/lib/agents/scout", () => ({ runScout: (...args: unknown[]) => mockRunScout(...args) }));

import { POST } from "./route";

const params = Promise.resolve({ tripId: "trip-1" });

beforeEach(() => {
  mockGetAdminUser.mockReset();
  mockRunScout.mockReset();
});

describe("POST /api/trips/[tripId]/scout", () => {
  it("rejects a non-admin caller", async () => {
    mockGetAdminUser.mockResolvedValue(null);
    const res = await POST(new Request("http://localhost", { method: "POST" }), { params });
    expect(res.status).toBe(401);
    expect(mockRunScout).not.toHaveBeenCalled();
  });

  it("returns 409 with the reason when Scout declines to run", async () => {
    mockGetAdminUser.mockResolvedValue({ id: "admin-1", email: "amit@example.com" });
    mockRunScout.mockResolvedValue({ ok: false, reason: "Need at least one budget answer first." });
    const res = await POST(new Request("http://localhost", { method: "POST" }), { params });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("budget");
  });

  it("returns 201 when Scout succeeds", async () => {
    mockGetAdminUser.mockResolvedValue({ id: "admin-1", email: "amit@example.com" });
    mockRunScout.mockResolvedValue({ ok: true });
    const res = await POST(new Request("http://localhost", { method: "POST" }), { params });
    expect(res.status).toBe(201);
  });
});
