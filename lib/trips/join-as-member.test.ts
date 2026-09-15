import { describe, expect, it, vi, beforeEach } from "vitest";

const mockTripSelect = vi.fn();
const mockMemberSelect = vi.fn();
const mockInsert = vi.fn();
const mockBroadcast = vi.fn();

vi.mock("@/lib/realtime/broadcast", () => ({ broadcastTripChange: (...args: unknown[]) => mockBroadcast(...args) }));
vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => ({
    from: (table: string) => {
      if (table === "trips") return { select: () => ({ eq: () => ({ maybeSingle: () => mockTripSelect() }) }) };
      if (table === "members") {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => mockMemberSelect() }) }) }),
          insert: (row: unknown) => ({ select: () => ({ single: () => mockInsert(row) }) }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { joinTripAsMember } from "./join-as-member";

const authUser = { id: "u1", email: "ishaan@example.com", name: "Ishaan" };

beforeEach(() => {
  mockTripSelect.mockReset();
  mockMemberSelect.mockReset();
  mockInsert.mockReset();
  mockBroadcast.mockReset();
});

describe("joinTripAsMember", () => {
  it("returns not_found for an invalid code", async () => {
    mockTripSelect.mockResolvedValue({ data: null, error: null });
    const result = await joinTripAsMember("BAD-CODE", authUser);
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("resumes an existing active membership without inserting", async () => {
    mockTripSelect.mockResolvedValue({ data: { id: "trip-1", joining_open: true, status: "lobby" }, error: null });
    mockMemberSelect.mockResolvedValue({ data: { id: "member-1", status: "active" }, error: null });
    const result = await joinTripAsMember("GOA-4K2", authUser);
    expect(result).toEqual({ ok: true, member: { id: "member-1", status: "active" } });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("refuses a removed member trying to rejoin", async () => {
    mockTripSelect.mockResolvedValue({ data: { id: "trip-1", joining_open: true, status: "lobby" }, error: null });
    mockMemberSelect.mockResolvedValue({ data: { id: "member-1", status: "removed" }, error: null });
    const result = await joinTripAsMember("GOA-4K2", authUser);
    expect(result).toEqual({ ok: false, reason: "removed" });
  });

  it("refuses a new join when joining is closed", async () => {
    mockTripSelect.mockResolvedValue({ data: { id: "trip-1", joining_open: false, status: "lobby" }, error: null });
    mockMemberSelect.mockResolvedValue({ data: null, error: null });
    const result = await joinTripAsMember("GOA-4K2", authUser);
    expect(result).toEqual({ ok: false, reason: "joining_closed" });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("creates a new member from the authenticated user's name and email", async () => {
    mockTripSelect.mockResolvedValue({ data: { id: "trip-1", joining_open: true, status: "lobby" }, error: null });
    mockMemberSelect.mockResolvedValue({ data: null, error: null });
    mockInsert.mockResolvedValue({ data: { id: "member-2", status: "active" }, error: null });
    const result = await joinTripAsMember("GOA-4K2", authUser);
    expect(mockInsert).toHaveBeenCalledWith({ trip_id: "trip-1", display_name: "Ishaan", email: "ishaan@example.com" });
    expect(result).toEqual({ ok: true, member: { id: "member-2", status: "active" } });
    expect(mockBroadcast).toHaveBeenCalledWith("trip-1");
  });
});
