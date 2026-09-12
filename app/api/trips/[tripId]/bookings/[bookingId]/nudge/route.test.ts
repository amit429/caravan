import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetAdminUser = vi.fn();
const mockPostAgentMessage = vi.fn();
const mockBookingSingle = vi.fn();
const mockMembersSelect = vi.fn();
const mockStatusSelect = vi.fn();

vi.mock("@/lib/auth/session", () => ({ getAdminUser: () => mockGetAdminUser() }));
vi.mock("@/lib/agents/post-agent-message", () => ({ postAgentMessage: (...args: unknown[]) => mockPostAgentMessage(...args) }));
vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => ({
    from: (table: string) => {
      if (table === "bookings") return { select: () => ({ eq: () => ({ single: () => mockBookingSingle() }) }) };
      if (table === "members") return { select: () => ({ eq: () => ({ eq: () => mockMembersSelect() }) }) };
      if (table === "booking_status") return { select: () => ({ eq: () => mockStatusSelect() }) };
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { POST } from "./route";

const params = Promise.resolve({ tripId: "trip-1", bookingId: "booking-1" });

beforeEach(() => {
  mockGetAdminUser.mockReset();
  mockPostAgentMessage.mockReset();
  mockBookingSingle.mockReset().mockResolvedValue({ data: { id: "booking-1", item: "Flight to Goa" }, error: null });
  mockMembersSelect
    .mockReset()
    .mockResolvedValue({ data: [{ id: "m1", display_name: "Rhea" }, { id: "m2", display_name: "Sam" }], error: null });
  mockStatusSelect.mockReset().mockResolvedValue({ data: [{ member_id: "m1", booked: true }], error: null });
});

describe("POST /api/trips/[tripId]/bookings/[bookingId]/nudge", () => {
  it("rejects a non-admin caller", async () => {
    mockGetAdminUser.mockResolvedValue(null);
    const res = await POST(new Request("http://localhost", { method: "POST" }), { params });
    expect(res.status).toBe(401);
    expect(mockPostAgentMessage).not.toHaveBeenCalled();
  });

  it("posts a nudge naming everyone who hasn't booked", async () => {
    mockGetAdminUser.mockResolvedValue({ id: "admin-1", email: "amit@example.com" });
    const res = await POST(new Request("http://localhost", { method: "POST" }), { params });
    expect(res.status).toBe(200);
    expect(mockPostAgentMessage).toHaveBeenCalledWith(
      expect.objectContaining({ agentName: "quartermaster", body: expect.stringContaining("Sam") })
    );
  });

  it("returns ok without posting when everyone has already booked", async () => {
    mockGetAdminUser.mockResolvedValue({ id: "admin-1", email: "amit@example.com" });
    mockMembersSelect.mockResolvedValue({ data: [{ id: "m1", display_name: "Rhea" }], error: null });
    const res = await POST(new Request("http://localhost", { method: "POST" }), { params });
    expect(res.status).toBe(200);
    expect(mockPostAgentMessage).not.toHaveBeenCalled();
  });
});
