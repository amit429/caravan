import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetAdminUser = vi.fn();
const mockGetMemberSession = vi.fn();
const mockDecisionSingle = vi.fn();
const mockUpsert = vi.fn();
const mockBroadcast = vi.fn();

vi.mock("@/lib/realtime/broadcast", () => ({ broadcastTripChange: (...args: unknown[]) => mockBroadcast(...args) }));

vi.mock("@/lib/auth/session", () => ({
  getAdminUser: () => mockGetAdminUser(),
  getMemberSession: () => mockGetMemberSession(),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => ({
    from: (table: string) => {
      if (table === "members") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: "member-1", status: "active" }, error: null }) }),
            }),
          }),
        };
      }
      if (table === "decisions") {
        return { select: () => ({ eq: () => ({ eq: () => ({ single: () => mockDecisionSingle() }) }) }) };
      }
      if (table === "votes") {
        return {
          upsert: (row: unknown) => ({
            select: () => ({ single: () => mockUpsert(row) }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { POST } from "./route";

function postRequest(body: unknown) {
  return new Request("http://localhost/api/trips/trip-1/decisions/decision-1/vote", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const params = Promise.resolve({ tripId: "trip-1", decisionId: "decision-1" });

beforeEach(() => {
  mockGetAdminUser.mockReset();
  mockGetMemberSession.mockReset();
  mockDecisionSingle.mockReset();
  mockUpsert.mockReset();
  mockBroadcast.mockReset();
});

describe("POST /api/trips/[tripId]/decisions/[decisionId]/vote", () => {
  it("rejects an unauthenticated caller", async () => {
    mockGetAdminUser.mockResolvedValue(null);
    mockGetMemberSession.mockResolvedValue(null);
    const res = await POST(postRequest({ optionId: "a" }), { params });
    expect(res.status).toBe(401);
  });

  it("rejects voting on an already-locked decision", async () => {
    mockGetAdminUser.mockResolvedValue(null);
    mockGetMemberSession.mockResolvedValue({ tripId: "trip-1", memberId: "member-1" });
    mockDecisionSingle.mockResolvedValue({
      data: { id: "decision-1", state: "LOCKED", options: [{ id: "a", label: "A" }] },
      error: null,
    });
    const res = await POST(postRequest({ optionId: "a" }), { params });
    expect(res.status).toBe(409);
  });

  it("rejects a vote for an option that doesn't exist on the decision", async () => {
    mockGetAdminUser.mockResolvedValue(null);
    mockGetMemberSession.mockResolvedValue({ tripId: "trip-1", memberId: "member-1" });
    mockDecisionSingle.mockResolvedValue({
      data: { id: "decision-1", state: "OPEN", options: [{ id: "a", label: "A" }] },
      error: null,
    });
    const res = await POST(postRequest({ optionId: "nonexistent" }), { params });
    expect(res.status).toBe(400);
  });

  it("upserts the vote for a valid option on an open decision", async () => {
    mockGetAdminUser.mockResolvedValue(null);
    mockGetMemberSession.mockResolvedValue({ tripId: "trip-1", memberId: "member-1" });
    mockDecisionSingle.mockResolvedValue({
      data: { id: "decision-1", state: "OPEN", options: [{ id: "a", label: "A" }] },
      error: null,
    });
    mockUpsert.mockResolvedValue({ data: { id: "vote-1", option_id: "a" }, error: null });
    const res = await POST(postRequest({ optionId: "a", isVeto: true }), { params });
    expect(res.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ decision_id: "decision-1", member_id: "member-1", option_id: "a", is_veto: true })
    );
    expect(mockBroadcast).toHaveBeenCalledWith("trip-1");
  });
});
