import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetAdminUser = vi.fn();
const mockInsertTrip = vi.fn();
const mockInsertMember = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  getAdminUser: () => mockGetAdminUser(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: () => ({
    from: (table: string) => {
      if (table === "trips") {
        return {
          insert: (row: unknown) => ({
            select: () => ({
              single: () => mockInsertTrip(row),
            }),
          }),
        };
      }
      if (table === "members") {
        return { insert: (row: unknown) => mockInsertMember(row) };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { POST } from "./route";

beforeEach(() => {
  mockGetAdminUser.mockReset();
  mockInsertTrip.mockReset();
  mockInsertMember.mockReset();
  mockInsertMember.mockResolvedValue({ error: null });
});

describe("POST /api/trips", () => {
  it("rejects unauthenticated requests", async () => {
    mockGetAdminUser.mockResolvedValue(null);
    const req = new Request("http://localhost/api/trips", {
      method: "POST",
      body: JSON.stringify({ name: "Goa" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("rejects an invalid body", async () => {
    mockGetAdminUser.mockResolvedValue({ id: "admin-1", email: "amit@example.com" });
    const req = new Request("http://localhost/api/trips", {
      method: "POST",
      body: JSON.stringify({ name: "" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("creates a trip and mirrors the admin as a member", async () => {
    mockGetAdminUser.mockResolvedValue({ id: "admin-1", email: "amit@example.com" });
    mockInsertTrip.mockResolvedValue({
      data: { id: "trip-1", name: "Goa", admin_user_id: "admin-1", invite_code: "ABCDEF" },
      error: null,
    });
    const req = new Request("http://localhost/api/trips", {
      method: "POST",
      body: JSON.stringify({ name: "Goa, probably" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.trip.id).toBe("trip-1");
    expect(mockInsertMember).toHaveBeenCalledWith(
      expect.objectContaining({
        trip_id: "trip-1",
        email: "amit@example.com",
        role: "admin",
      })
    );
  });
});
