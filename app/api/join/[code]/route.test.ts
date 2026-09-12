import { describe, expect, it, vi, beforeEach } from "vitest";

const mockTripSingle = vi.fn();
const mockMemberMaybeSingle = vi.fn();
const mockMemberInsertSingle = vi.fn();

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
          insert: () => ({ select: () => ({ single: () => mockMemberInsertSingle() }) }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

vi.mock("@/lib/auth/member-jwt", () => ({
  signMemberToken: vi.fn().mockResolvedValue("signed-token"),
}));

import { POST } from "./route";

beforeEach(() => {
  mockTripSingle.mockReset();
  mockMemberMaybeSingle.mockReset();
  mockMemberInsertSingle.mockReset();
});

function joinRequest(body: unknown) {
  return new Request("http://localhost/api/join/ABCDEF", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/join/[code]", () => {
  it("404s for an unknown invite code", async () => {
    mockTripSingle.mockResolvedValue({ data: null, error: { message: "not found" } });
    const res = await POST(joinRequest({ displayName: "Ishaan", email: "i@example.com" }), {
      params: Promise.resolve({ code: "ABCDEF" }),
    });
    expect(res.status).toBe(404);
  });

  it("409s when joining is closed", async () => {
    mockTripSingle.mockResolvedValue({
      data: { id: "trip-1", joining_open: false },
      error: null,
    });
    const res = await POST(joinRequest({ displayName: "Ishaan", email: "i@example.com" }), {
      params: Promise.resolve({ code: "ABCDEF" }),
    });
    expect(res.status).toBe(409);
  });

  it("resumes an existing member by email instead of creating a duplicate", async () => {
    mockTripSingle.mockResolvedValue({ data: { id: "trip-1", joining_open: true }, error: null });
    mockMemberMaybeSingle.mockResolvedValue({
      data: { id: "member-1", trip_id: "trip-1", email: "i@example.com" },
      error: null,
    });
    const res = await POST(joinRequest({ displayName: "Ishaan", email: "i@example.com" }), {
      params: Promise.resolve({ code: "ABCDEF" }),
    });
    expect(res.status).toBe(200);
    expect(mockMemberInsertSingle).not.toHaveBeenCalled();
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("caravan_member_token=signed-token");
  });

  it("creates a new member when the email hasn't joined yet", async () => {
    mockTripSingle.mockResolvedValue({ data: { id: "trip-1", joining_open: true }, error: null });
    mockMemberMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockMemberInsertSingle.mockResolvedValue({
      data: { id: "member-2", trip_id: "trip-1", email: "new@example.com" },
      error: null,
    });
    const res = await POST(joinRequest({ displayName: "New", email: "new@example.com" }), {
      params: Promise.resolve({ code: "ABCDEF" }),
    });
    expect(res.status).toBe(200);
    expect(mockMemberInsertSingle).toHaveBeenCalled();
  });
});
