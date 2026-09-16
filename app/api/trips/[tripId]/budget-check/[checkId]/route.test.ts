import { describe, expect, it, vi, beforeEach } from "vitest";

const mockResolveCaller = vi.fn();
const mockCheckSelect = vi.fn();
const mockCheckUpdate = vi.fn();
const mockFactsInsert = vi.fn();
const mockFactsUpdate = vi.fn();
const mockMemberSelect = vi.fn();
const mockBroadcast = vi.fn();
const mockPostAgentMessage = vi.fn();
const mockEnsureThread = vi.fn();
const mockMessageSelect = vi.fn();
const mockMessageUpdate = vi.fn();

vi.mock("@/lib/realtime/broadcast", () => ({ broadcastTripChange: (...args: unknown[]) => mockBroadcast(...args) }));
vi.mock("@/lib/agents/runtime/post-agent-message", () => ({ postAgentMessage: (...args: unknown[]) => mockPostAgentMessage(...args) }));
vi.mock("@/lib/threads/ensure-thread", () => ({ ensureThread: (...args: unknown[]) => mockEnsureThread(...args) }));
vi.mock("@/lib/auth/resolve-caller", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/resolve-caller")>("@/lib/auth/resolve-caller");
  return { ...actual, resolveCaller: (...args: unknown[]) => mockResolveCaller(...args) };
});
vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => ({
    from: (table: string) => {
      if (table === "budget_checks") {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => mockCheckSelect() }) }) }),
          update: (patch: unknown) => ({ eq: () => mockCheckUpdate(patch) }),
        };
      }
      if (table === "facts") {
        return {
          insert: (row: unknown) => {
            mockFactsInsert(row);
            return { select: () => ({ single: () => Promise.resolve({ data: { id: "fact-new-1" }, error: null }) }) };
          },
          update: (patch: unknown) => ({
            eq: () => ({ eq: () => ({ eq: () => ({ is: () => ({ neq: () => mockFactsUpdate(patch) }) }) }) }),
          }),
        };
      }
      if (table === "members") {
        return { select: () => ({ eq: () => ({ single: () => mockMemberSelect() }) }) };
      }
      if (table === "messages") {
        return {
          select: () => ({ eq: () => ({ contains: () => ({ maybeSingle: () => mockMessageSelect() }) }) }),
          update: (patch: unknown) => ({ eq: () => mockMessageUpdate(patch) }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { POST } from "./route";

const params = Promise.resolve({ tripId: "trip-1", checkId: "check-1" });

function postRequest(body: unknown) {
  return new Request("http://localhost", { method: "POST", body: JSON.stringify(body) });
}

beforeEach(() => {
  mockResolveCaller.mockReset();
  mockCheckSelect.mockReset();
  mockCheckUpdate.mockReset().mockResolvedValue({ error: null });
  mockFactsInsert.mockReset();
  mockFactsUpdate.mockReset().mockResolvedValue({ error: null });
  mockMemberSelect.mockReset().mockResolvedValue({ data: { display_name: "Karan" }, error: null });
  mockBroadcast.mockReset();
  mockPostAgentMessage.mockReset();
  mockEnsureThread.mockReset().mockResolvedValue("thread-1");
  mockMessageSelect.mockReset().mockResolvedValue({ data: { id: "msg-1", metadata: { kind: "budget_check", budgetCheckId: "check-1", status: "pending" } }, error: null });
  mockMessageUpdate.mockReset().mockResolvedValue({ error: null });
});

describe("POST /api/trips/[tripId]/budget-check/[checkId]", () => {
  it("rejects a caller with no session", async () => {
    mockResolveCaller.mockResolvedValue(null);
    const res = await POST(postRequest({ answer: "yes" }), { params });
    expect(res.status).toBe(401);
  });

  it("rejects a 'no' answer without a reason", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m1", status: "active" });
    const res = await POST(postRequest({ answer: "no" }), { params });
    expect(res.status).toBe(400);
  });

  it("returns 404 for a check outside this trip", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m1", status: "active" });
    mockCheckSelect.mockResolvedValue({ data: null, error: null });
    const res = await POST(postRequest({ answer: "yes" }), { params });
    expect(res.status).toBe(404);
  });

  it("blocks answering someone else's check", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m2", status: "active" });
    mockCheckSelect.mockResolvedValue({ data: { id: "check-1", member_id: "m1", status: "pending", threshold_amount: 60000 }, error: null });
    const res = await POST(postRequest({ answer: "yes" }), { params });
    expect(res.status).toBe(403);
  });

  it("rejects answering a check that's already been answered", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m1", status: "active" });
    mockCheckSelect.mockResolvedValue({ data: { id: "check-1", member_id: "m1", status: "yes", threshold_amount: 60000 }, error: null });
    const res = await POST(postRequest({ answer: "yes" }), { params });
    expect(res.status).toBe(409);
  });

  it("on yes: updates the budget fact to the threshold amount and confirms privately, no group post", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m1", status: "active" });
    mockCheckSelect.mockResolvedValue({ data: { id: "check-1", member_id: "m1", status: "pending", threshold_amount: 60000 }, error: null });

    const res = await POST(postRequest({ answer: "yes" }), { params });
    expect(res.status).toBe(200);

    expect(mockCheckUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "yes" }));
    expect(mockFactsInsert).toHaveBeenCalledWith(
      expect.objectContaining({ trip_id: "trip-1", member_id: "m1", category: "budget", type: "SOFT", value: { amount: 60000 } })
    );
    expect(mockFactsUpdate).toHaveBeenCalledWith({ superseded_by: "fact-new-1" });
    expect(mockPostAgentMessage).toHaveBeenCalledTimes(1);
    expect(mockPostAgentMessage).toHaveBeenCalledWith(
      expect.objectContaining({ threadId: "thread-1", body: expect.stringContaining("60,000") })
    );
    expect(mockMessageUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ status: "yes" }) })
    );
  });

  it("on no: requires a reason, posts a private confirmation and a named group message without the amount", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m1", status: "active" });
    mockCheckSelect.mockResolvedValue({ data: { id: "check-1", member_id: "m1", status: "pending", threshold_amount: 60000 }, error: null });

    const res = await POST(postRequest({ answer: "no", reason: "Already stretched thin this month" }), { params });
    expect(res.status).toBe(200);

    expect(mockCheckUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "no", reason: "Already stretched thin this month" })
    );
    expect(mockFactsInsert).not.toHaveBeenCalled();
    expect(mockPostAgentMessage).toHaveBeenCalledTimes(2);
    const groupMessage = mockPostAgentMessage.mock.calls.find((call) => !call[0].threadId);
    expect(groupMessage?.[0].body).toContain("Karan");
    expect(groupMessage?.[0].body).toContain("Already stretched thin this month");
    expect(groupMessage?.[0].body).not.toContain("60000");
    expect(groupMessage?.[0].body).not.toContain("60,000");
  });
});
