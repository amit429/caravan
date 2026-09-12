import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetAdminUser = vi.fn();
const mockRunQuartermaster = vi.fn();

vi.mock("@/lib/auth/session", () => ({ getAdminUser: () => mockGetAdminUser() }));
vi.mock("@/lib/agents/quartermaster", () => ({ runQuartermaster: (...args: unknown[]) => mockRunQuartermaster(...args) }));

import { POST } from "./route";

const params = Promise.resolve({ tripId: "trip-1" });

beforeEach(() => {
  mockGetAdminUser.mockReset();
  mockRunQuartermaster.mockReset();
});

describe("POST /api/trips/[tripId]/quartermaster", () => {
  it("rejects a non-admin caller", async () => {
    mockGetAdminUser.mockResolvedValue(null);
    const res = await POST(new Request("http://localhost", { method: "POST" }), { params });
    expect(res.status).toBe(401);
    expect(mockRunQuartermaster).not.toHaveBeenCalled();
  });

  it("returns 409 with the reason when Quartermaster declines to run", async () => {
    mockGetAdminUser.mockResolvedValue({ id: "admin-1", email: "amit@example.com" });
    mockRunQuartermaster.mockResolvedValue({ ok: false, reason: "Lock a destination and dates first." });
    const res = await POST(new Request("http://localhost", { method: "POST" }), { params });
    expect(res.status).toBe(409);
  });

  it("returns 201 when Quartermaster succeeds", async () => {
    mockGetAdminUser.mockResolvedValue({ id: "admin-1", email: "amit@example.com" });
    mockRunQuartermaster.mockResolvedValue({ ok: true });
    const res = await POST(new Request("http://localhost", { method: "POST" }), { params });
    expect(res.status).toBe(201);
  });
});
