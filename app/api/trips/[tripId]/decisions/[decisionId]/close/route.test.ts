import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetAdminUser = vi.fn();
const mockDecisionSingle = vi.fn();
const mockVotesSelect = vi.fn();
const mockUpdate = vi.fn();
const mockPostAgentMessage = vi.fn();
const mockHandleDecisionLocked = vi.fn();
const mockAfter = vi.fn();

vi.mock("@/lib/agents/runtime/post-agent-message", () => ({ postAgentMessage: (...args: unknown[]) => mockPostAgentMessage(...args) }));
vi.mock("@/lib/decisions/on-decision-locked", () => ({
  handleDecisionLocked: (...args: unknown[]) => mockHandleDecisionLocked(...args),
}));

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...actual, after: (fn: unknown) => mockAfter(fn) };
});

vi.mock("@/lib/auth/session", () => ({
  getAuthUser: () => mockGetAdminUser(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: () => ({
    from: (table: string) => {
      if (table === "decisions") {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ single: () => mockDecisionSingle() }) }) }),
          update: (patch: unknown) => ({
            eq: () => ({ select: () => ({ single: () => mockUpdate(patch) }) }),
          }),
        };
      }
      if (table === "votes") {
        return { select: () => ({ eq: () => mockVotesSelect() }) };
      }
      if (table === "members") {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: "admin-member-1" }, error: null }) }) }) }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { POST } from "./route";

const params = Promise.resolve({ tripId: "trip-1", decisionId: "decision-1" });
const options = [
  { id: "goa", label: "Goa" },
  { id: "manali", label: "Manali" },
];

function postRequest(body: unknown = {}) {
  return new Request("http://localhost/api/trips/trip-1/decisions/decision-1/close", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockGetAdminUser.mockReset();
  mockDecisionSingle.mockReset();
  mockVotesSelect.mockReset();
  mockUpdate.mockReset();
  mockPostAgentMessage.mockReset();
  mockHandleDecisionLocked.mockReset();
  mockAfter.mockReset();
});

describe("POST /api/trips/[tripId]/decisions/[decisionId]/close", () => {
  it("rejects a non-admin caller", async () => {
    mockGetAdminUser.mockResolvedValue(null);
    const res = await POST(postRequest(), { params });
    expect(res.status).toBe(401);
  });

  it("rejects closing an already-locked decision", async () => {
    mockGetAdminUser.mockResolvedValue({ id: "admin-1", email: "amit@example.com" });
    mockDecisionSingle.mockResolvedValue({ data: { id: "decision-1", state: "LOCKED", options }, error: null });
    const res = await POST(postRequest(), { params });
    expect(res.status).toBe(409);
  });

  it("auto-picks the option with the most votes", async () => {
    mockGetAdminUser.mockResolvedValue({ id: "admin-1", email: "amit@example.com" });
    mockDecisionSingle.mockResolvedValue({ data: { id: "decision-1", type: "DESTINATION", state: "OPEN", options }, error: null });
    mockVotesSelect.mockResolvedValue({
      data: [
        { option_id: "goa", is_veto: false, member_id: "m1" },
        { option_id: "goa", is_veto: false, member_id: "m2" },
        { option_id: "manali", is_veto: false, member_id: "m3" },
      ],
      error: null,
    });
    mockUpdate.mockResolvedValue({ data: { id: "decision-1", state: "LOCKED", locked_option: "goa" }, error: null });
    const res = await POST(postRequest(), { params });
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ state: "LOCKED", locked_option: "goa" }));
    expect(mockPostAgentMessage).toHaveBeenCalledWith(
      expect.objectContaining({ tripId: "trip-1", agentName: "concierge", body: expect.stringContaining("Goa") })
    );
  });

  it("defers handleDecisionLocked to after the response, with the decision's type", async () => {
    mockGetAdminUser.mockResolvedValue({ id: "admin-1", email: "amit@example.com" });
    mockDecisionSingle.mockResolvedValue({ data: { id: "decision-1", type: "DESTINATION", state: "OPEN", options }, error: null });
    mockVotesSelect.mockResolvedValue({
      data: [{ option_id: "goa", is_veto: false, member_id: "m1" }],
      error: null,
    });
    mockUpdate.mockResolvedValue({ data: { id: "decision-1", state: "LOCKED", locked_option: "goa" }, error: null });
    await POST(postRequest(), { params });
    expect(mockHandleDecisionLocked).not.toHaveBeenCalled(); // not yet — only once the deferred callback fires
    expect(mockAfter).toHaveBeenCalled();
    const deferred = mockAfter.mock.calls[0][0] as () => Promise<void>;
    await deferred();
    expect(mockHandleDecisionLocked).toHaveBeenCalledWith("trip-1", { type: "DESTINATION" });
  });

  it("blocks locking a vetoed option without override", async () => {
    mockGetAdminUser.mockResolvedValue({ id: "admin-1", email: "amit@example.com" });
    mockDecisionSingle.mockResolvedValue({ data: { id: "decision-1", state: "OPEN", options }, error: null });
    mockVotesSelect.mockResolvedValue({
      data: [{ option_id: "goa", is_veto: true, member_id: "m1" }],
      error: null,
    });
    const res = await POST(postRequest({ optionId: "goa" }), { params });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("hard_constraint_blocks_option");
  });

  it("allows an admin override to lock a vetoed option", async () => {
    mockGetAdminUser.mockResolvedValue({ id: "admin-1", email: "amit@example.com" });
    mockDecisionSingle.mockResolvedValue({ data: { id: "decision-1", state: "OPEN", options }, error: null });
    mockVotesSelect.mockResolvedValue({
      data: [{ option_id: "goa", is_veto: true, member_id: "m1" }],
      error: null,
    });
    mockUpdate.mockResolvedValue({ data: { id: "decision-1", state: "LOCKED", locked_option: "goa" }, error: null });
    const res = await POST(postRequest({ optionId: "goa", override: true }), { params });
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ locked_option: "goa", locked_by: "admin-member-1" })
    );
  });
});
