import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetAdminUser = vi.fn();
const mockInsertDecision = vi.fn();
const mockBroadcast = vi.fn();
const mockPostAgentMessage = vi.fn();

vi.mock("@/lib/realtime/broadcast", () => ({ broadcastTripChange: (...args: unknown[]) => mockBroadcast(...args) }));
vi.mock("@/lib/agents/runtime/post-agent-message", () => ({ postAgentMessage: (...args: unknown[]) => mockPostAgentMessage(...args) }));

vi.mock("@/lib/auth/session", () => ({
  getAuthUser: () => mockGetAdminUser(),
  getMemberSession: () => Promise.resolve(null),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: () => ({
    from: (table: string) => {
      if (table === "trips") {
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: "trip-1" }, error: null }) }) }) };
      }
      if (table === "decisions") {
        return {
          insert: (row: unknown) => ({
            select: () => ({ single: () => mockInsertDecision(row) }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }),
    }),
  }),
}));

import { POST } from "./route";

const validDecision = {
  type: "DATES",
  options: [
    { id: "a", label: "Nov 12-15" },
    { id: "b", label: "Nov 19-22" },
  ],
};

function postRequest(body: unknown) {
  return new Request("http://localhost/api/trips/trip-1/decisions", { method: "POST", body: JSON.stringify(body) });
}

beforeEach(() => {
  mockGetAdminUser.mockReset();
  mockInsertDecision.mockReset();
  mockBroadcast.mockReset();
  mockPostAgentMessage.mockReset();
});

describe("POST /api/trips/[tripId]/decisions", () => {
  it("rejects a non-admin caller", async () => {
    mockGetAdminUser.mockResolvedValue(null);
    const res = await POST(postRequest(validDecision), { params: Promise.resolve({ tripId: "trip-1" }) });
    expect(res.status).toBe(401);
  });

  it("rejects a decision with fewer than 2 options", async () => {
    mockGetAdminUser.mockResolvedValue({ id: "admin-1", email: "amit@example.com" });
    const res = await POST(postRequest({ ...validDecision, options: [{ id: "a", label: "Only one" }] }), {
      params: Promise.resolve({ tripId: "trip-1" }),
    });
    expect(res.status).toBe(400);
  });

  it("creates a decision in the OPEN state", async () => {
    mockGetAdminUser.mockResolvedValue({ id: "admin-1", email: "amit@example.com" });
    mockInsertDecision.mockResolvedValue({
      data: { id: "decision-1", trip_id: "trip-1", type: "DATES", state: "OPEN", options: validDecision.options, deadline: null },
      error: null,
    });
    const res = await POST(postRequest(validDecision), { params: Promise.resolve({ tripId: "trip-1" }) });
    expect(res.status).toBe(201);
    expect(mockInsertDecision).toHaveBeenCalledWith(
      expect.objectContaining({ trip_id: "trip-1", type: "DATES", state: "OPEN" })
    );
    expect(mockBroadcast).toHaveBeenCalledWith("trip-1");
    expect(mockPostAgentMessage).toHaveBeenCalledWith(
      expect.objectContaining({ tripId: "trip-1", agentName: "concierge", body: expect.stringContaining("New vote") })
    );
  });
});
