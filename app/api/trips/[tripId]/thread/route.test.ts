import { describe, expect, it, vi, beforeEach } from "vitest";

const mockResolveCaller = vi.fn();
const mockEnsureThread = vi.fn();
const mockLoadThread = vi.fn();
const mockRunScribe = vi.fn();
const mockAnswerTripQuestion = vi.fn();
const mockPostAgentMessage = vi.fn();
const mockBroadcast = vi.fn();
const mockAfter = vi.fn();
const mockInsertSingle = vi.fn();
const mockMemberSingle = vi.fn();

vi.mock("@/lib/realtime/broadcast", () => ({ broadcastTripChange: (...args: unknown[]) => mockBroadcast(...args) }));
vi.mock("@/lib/threads/ensure-thread", () => ({ ensureThread: (...args: unknown[]) => mockEnsureThread(...args) }));
vi.mock("@/lib/threads/load-thread", () => ({ loadThread: (...args: unknown[]) => mockLoadThread(...args) }));
vi.mock("@/lib/agents/scribe", () => ({ runScribe: (...args: unknown[]) => mockRunScribe(...args) }));
vi.mock("@/lib/agents/answer-question", () => ({ answerTripQuestion: (...args: unknown[]) => mockAnswerTripQuestion(...args) }));
vi.mock("@/lib/agents/runtime/post-agent-message", () => ({ postAgentMessage: (...args: unknown[]) => mockPostAgentMessage(...args) }));

vi.mock("@/lib/auth/resolve-caller", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/resolve-caller")>("@/lib/auth/resolve-caller");
  return { ...actual, resolveCaller: (...args: unknown[]) => mockResolveCaller(...args) };
});

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...actual, after: (fn: unknown) => mockAfter(fn) };
});

vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => ({
    from: (table: string) => {
      if (table === "messages") {
        return {
          insert: (row: unknown) => ({ select: () => ({ single: () => mockInsertSingle(row) }) }),
        };
      }
      if (table === "members") {
        return { select: () => ({ eq: () => ({ single: () => mockMemberSingle() }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { GET, POST } from "./route";

const params = Promise.resolve({ tripId: "trip-1" });

beforeEach(() => {
  mockResolveCaller.mockReset();
  mockEnsureThread.mockReset().mockResolvedValue("thread-1");
  mockLoadThread.mockReset().mockResolvedValue({ threadId: "thread-1", messages: [] });
  mockRunScribe.mockReset().mockResolvedValue({ posted: true });
  mockAnswerTripQuestion.mockReset().mockResolvedValue("The cost estimate is 11k-14k a head.");
  mockPostAgentMessage.mockReset();
  mockBroadcast.mockReset();
  mockAfter.mockReset();
  mockInsertSingle.mockReset();
  mockMemberSingle.mockReset();
});

describe("GET /api/trips/[tripId]/thread", () => {
  it("rejects a caller with no session", async () => {
    mockResolveCaller.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost"), { params });
    expect(res.status).toBe(401);
  });

  it("rejects a removed member", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m1", status: "removed" });
    const res = await GET(new Request("http://localhost"), { params });
    expect(res.status).toBe(403);
  });

  it("returns the caller's own thread from loadThread", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m1", status: "active" });
    mockLoadThread.mockResolvedValue({ threadId: "thread-1", messages: [{ id: "msg-1" }] });
    const res = await GET(new Request("http://localhost"), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.threadId).toBe("thread-1");
    expect(body.messages).toHaveLength(1);
    expect(mockLoadThread).toHaveBeenCalledWith("trip-1", "m1", expect.anything());
  });
});

describe("POST /api/trips/[tripId]/thread", () => {
  function postRequest(body: unknown) {
    return new Request("http://localhost", { method: "POST", body: JSON.stringify(body) });
  }

  it("rejects a caller with no session", async () => {
    mockResolveCaller.mockResolvedValue(null);
    const res = await POST(postRequest({ body: "hi" }), { params });
    expect(res.status).toBe(401);
  });

  it("rejects an empty body", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m1", status: "active" });
    const res = await POST(postRequest({ body: "" }), { params });
    expect(res.status).toBe(400);
  });

  it("posts a member message into the caller's own thread and broadcasts it", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m1", status: "active" });
    mockInsertSingle.mockResolvedValue({ data: { id: "msg-1", body: "My budget is 15k", thread_id: "thread-1" }, error: null });
    const res = await POST(postRequest({ body: "My budget is 15k" }), { params });
    expect(res.status).toBe(201);
    expect(mockInsertSingle).toHaveBeenCalledWith(
      expect.objectContaining({ trip_id: "trip-1", thread_id: "thread-1", lane: "thread", author_id: "m1" })
    );
    expect(mockBroadcast).toHaveBeenCalledWith("trip-1", {
      type: "thread_message",
      threadId: "thread-1",
      message: { id: "msg-1", body: "My budget is 15k", thread_id: "thread-1" },
    });
    expect(mockAfter).toHaveBeenCalled();
  });

  it("runs Scribe with the threadId once the deferred callback fires", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m1", status: "active" });
    mockInsertSingle.mockResolvedValue({ data: { id: "msg-1", body: "My budget is 15k" }, error: null });
    mockMemberSingle.mockResolvedValue({ data: { id: "m1", display_name: "Rhea" }, error: null });
    await POST(postRequest({ body: "My budget is 15k" }), { params });
    const deferred = mockAfter.mock.calls[0][0] as () => Promise<void>;
    await deferred();
    expect(mockRunScribe).toHaveBeenCalledWith(
      expect.objectContaining({ tripId: "trip-1", threadId: "thread-1" })
    );
  });

  it("falls back to answerTripQuestion when Scribe files nothing, so the thread never goes silent", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m1", status: "active" });
    mockInsertSingle.mockResolvedValue({ data: { id: "msg-1", body: "When are we going" }, error: null });
    mockMemberSingle.mockResolvedValue({ data: { id: "m1", display_name: "Rhea" }, error: null });
    mockRunScribe.mockResolvedValue({ posted: false });
    await POST(postRequest({ body: "When are we going" }), { params });
    const deferred = mockAfter.mock.calls[0][0] as () => Promise<void>;
    await deferred();
    expect(mockAnswerTripQuestion).toHaveBeenCalledWith("trip-1", "When are we going");
    expect(mockPostAgentMessage).toHaveBeenCalledWith(
      expect.objectContaining({ tripId: "trip-1", agentName: "concierge", threadId: "thread-1" })
    );
  });

  it("does not double-reply when Scribe already posted something (a filed receipt or its own fallback)", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m1", status: "active" });
    mockInsertSingle.mockResolvedValue({ data: { id: "msg-1", body: "My budget is 15k" }, error: null });
    mockMemberSingle.mockResolvedValue({ data: { id: "m1", display_name: "Rhea" }, error: null });
    mockRunScribe.mockResolvedValue({ posted: true });
    await POST(postRequest({ body: "My budget is 15k" }), { params });
    const deferred = mockAfter.mock.calls[0][0] as () => Promise<void>;
    await deferred();
    expect(mockAnswerTripQuestion).not.toHaveBeenCalled();
  });

  it("answers instead of running Scribe when intent is 'ask'", async () => {
    mockResolveCaller.mockResolvedValue({ id: "m1", status: "active" });
    mockInsertSingle.mockResolvedValue({ data: { id: "msg-1", body: "What's the cost estimate?" }, error: null });
    await POST(postRequest({ body: "What's the cost estimate?", intent: "ask" }), { params });
    const deferred = mockAfter.mock.calls[0][0] as () => Promise<void>;
    await deferred();
    expect(mockAnswerTripQuestion).toHaveBeenCalledWith("trip-1", "What's the cost estimate?");
    expect(mockPostAgentMessage).toHaveBeenCalledWith(
      expect.objectContaining({ tripId: "trip-1", agentName: "concierge", threadId: "thread-1", body: "The cost estimate is 11k-14k a head." })
    );
    expect(mockRunScribe).not.toHaveBeenCalled();
  });
});
