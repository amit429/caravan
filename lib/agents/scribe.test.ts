import { describe, expect, it, vi, beforeEach } from "vitest";
import type { MemberRow, MessageRow } from "@/lib/database.types";

const mockGenerateObject = vi.fn();
const mockLogAgentRun = vi.fn();
const mockPostAgentMessage = vi.fn();
const mockFactsInsert = vi.fn();
const mockFactsInsertResult = vi.fn();
const mockFactsUpdate = vi.fn();
const mockAvailabilityInsert = vi.fn();

vi.mock("ai", () => ({ generateObject: (...args: unknown[]) => mockGenerateObject(...args) }));
vi.mock("./runtime/log-run", () => ({ logAgentRun: (...args: unknown[]) => mockLogAgentRun(...args) }));
vi.mock("./runtime/post-agent-message", () => ({ postAgentMessage: (...args: unknown[]) => mockPostAgentMessage(...args) }));
vi.mock("./runtime/model", () => ({
  flashModel: "mock-flash-model",
  estimateCost: () => 0,
  fastGoogleOptions: { google: { thinkingConfig: { thinkingBudget: 0 } } },
}));
vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => ({
    from: (table: string) => {
      if (table === "facts") {
        return {
          insert: (row: unknown) => {
            mockFactsInsert(row);
            return { select: () => ({ single: () => mockFactsInsertResult() }) };
          },
          update: (patch: unknown) => ({
            eq: () => ({ eq: () => ({ eq: () => ({ is: () => ({ neq: () => mockFactsUpdate(patch) }) }) }) }),
          }),
        };
      }
      if (table === "availability") return { insert: (row: unknown) => mockAvailabilityInsert(row) };
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { runScribe } from "./scribe";

const member: MemberRow = {
  id: "member-1",
  trip_id: "trip-1",
  display_name: "Karan",
  email: "karan@example.com",
  role: "member",
  status: "active",
  device_token_hash: null,
  joined_at: "2026-01-01T00:00:00Z",
  nudge_tier: 0,
  flagged_at: null,
};

const message: MessageRow = {
  id: "msg-1",
  trip_id: "trip-1",
  lane: "group",
  thread_id: null,
  author_type: "member",
  author_id: "member-1",
  agent_name: null,
  body: "I can't travel Nov 20-25, and my budget is 10-20k",
  metadata: {},
  created_at: "2026-01-01T00:00:00Z",
};

function usage(input = 10, output = 10) {
  return { inputTokens: input, outputTokens: output };
}

beforeEach(() => {
  mockGenerateObject.mockReset();
  mockLogAgentRun.mockReset();
  mockPostAgentMessage.mockReset();
  mockFactsInsert.mockReset();
  mockFactsInsertResult.mockReset().mockResolvedValue({ data: { id: "fact-new-1" }, error: null });
  mockFactsUpdate.mockReset().mockResolvedValue({ error: null });
  mockAvailabilityInsert.mockReset().mockResolvedValue({ error: null });
});

describe("runScribe", () => {
  it("does nothing when the gate says there's nothing extractable", async () => {
    mockGenerateObject.mockResolvedValueOnce({ object: { containsExtractableInfo: false }, usage: usage() });
    await runScribe({ tripId: "trip-1", message, authorMember: member });
    expect(mockGenerateObject).toHaveBeenCalledTimes(1);
    expect(mockFactsInsert).not.toHaveBeenCalled();
    expect(mockPostAgentMessage).not.toHaveBeenCalled();
  });

  it("skips extractions below the confidence threshold", async () => {
    mockGenerateObject
      .mockResolvedValueOnce({ object: { containsExtractableInfo: true }, usage: usage() })
      .mockResolvedValueOnce({
        object: {
          extractions: [
            {
              kind: "fact",
              memberId: "member-1",
              category: "budget",
              type: "SOFT",
              value: { band: "10-20k" },
              confidence: 0.4,
              rationale: "Karan's budget is 10-20k",
            },
          ],
        },
        usage: usage(),
      });
    await runScribe({ tripId: "trip-1", message, authorMember: member });
    expect(mockFactsInsert).not.toHaveBeenCalled();
    expect(mockPostAgentMessage).not.toHaveBeenCalled();
  });

  it("ignores extractions attributed to a different member than the message author", async () => {
    mockGenerateObject
      .mockResolvedValueOnce({ object: { containsExtractableInfo: true }, usage: usage() })
      .mockResolvedValueOnce({
        object: {
          extractions: [
            {
              kind: "fact",
              memberId: "someone-else",
              category: "budget",
              type: "SOFT",
              value: { band: "10-20k" },
              confidence: 0.95,
              rationale: "shouldn't apply",
            },
          ],
        },
        usage: usage(),
      });
    await runScribe({ tripId: "trip-1", message, authorMember: member });
    expect(mockFactsInsert).not.toHaveBeenCalled();
  });

  it("files a high-confidence hard fact and posts a receipt", async () => {
    mockGenerateObject
      .mockResolvedValueOnce({ object: { containsExtractableInfo: true }, usage: usage() })
      .mockResolvedValueOnce({
        object: {
          extractions: [
            {
              kind: "fact",
              memberId: "member-1",
              category: "hard_no",
              type: "HARD",
              value: { text: "Nov 20-25" },
              confidence: 0.9,
              rationale: "Karan can't travel Nov 20-25 (hard)",
            },
          ],
        },
        usage: usage(),
      });
    await runScribe({ tripId: "trip-1", message, authorMember: member });
    expect(mockFactsInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        trip_id: "trip-1",
        member_id: "member-1",
        category: "hard_no",
        type: "HARD",
        source: "extract",
        source_message_id: "msg-1",
      })
    );
    expect(mockPostAgentMessage).toHaveBeenCalledWith(
      expect.objectContaining({ tripId: "trip-1", agentName: "scribe", body: expect.stringContaining("Nov 20-25") })
    );
  });

  it("supersedes a member's prior budget fact when a newer one is filed by chat", async () => {
    mockGenerateObject
      .mockResolvedValueOnce({ object: { containsExtractableInfo: true }, usage: usage() })
      .mockResolvedValueOnce({
        object: {
          extractions: [
            {
              kind: "fact",
              memberId: "member-1",
              category: "budget",
              type: "SOFT",
              value: { band: "20-35k" },
              confidence: 0.9,
              rationale: "Karan's budget is actually 20-35k now",
            },
          ],
        },
        usage: usage(),
      });
    await runScribe({ tripId: "trip-1", message, authorMember: member });
    expect(mockFactsUpdate).toHaveBeenCalledWith({ superseded_by: "fact-new-1" });
  });

  it("does not supersede anything for additive categories like hard_no", async () => {
    mockGenerateObject
      .mockResolvedValueOnce({ object: { containsExtractableInfo: true }, usage: usage() })
      .mockResolvedValueOnce({
        object: {
          extractions: [
            {
              kind: "fact",
              memberId: "member-1",
              category: "hard_no",
              type: "HARD",
              value: { text: "no camping" },
              confidence: 0.9,
              rationale: "Karan: no camping",
            },
          ],
        },
        usage: usage(),
      });
    await runScribe({ tripId: "trip-1", message, authorMember: member });
    expect(mockFactsUpdate).not.toHaveBeenCalled();
  });

  it("forwards threadId so a thread-origin extraction's receipt stays in that thread", async () => {
    mockGenerateObject
      .mockResolvedValueOnce({ object: { containsExtractableInfo: true }, usage: usage() })
      .mockResolvedValueOnce({
        object: {
          extractions: [
            {
              kind: "fact",
              memberId: "member-1",
              category: "budget",
              type: "SOFT",
              value: { band: "10-20k" },
              confidence: 0.9,
              rationale: "budget 10-20k",
            },
          ],
        },
        usage: usage(),
      });
    await runScribe({ tripId: "trip-1", message, authorMember: member, threadId: "thread-1" });
    expect(mockPostAgentMessage).toHaveBeenCalledWith(expect.objectContaining({ threadId: "thread-1" }));
  });

  it("files an availability extraction into the availability table", async () => {
    mockGenerateObject
      .mockResolvedValueOnce({ object: { containsExtractableInfo: true }, usage: usage() })
      .mockResolvedValueOnce({
        object: {
          extractions: [
            {
              kind: "availability",
              memberId: "member-1",
              startDate: "2026-11-01",
              endDate: "2026-11-10",
              strength: "free",
              confidence: 0.85,
              rationale: "Karan's free Nov 1-10",
            },
          ],
        },
        usage: usage(),
      });
    await runScribe({ tripId: "trip-1", message, authorMember: member });
    expect(mockAvailabilityInsert).toHaveBeenCalledWith(
      expect.objectContaining({ trip_id: "trip-1", member_id: "member-1", start_date: "2026-11-01", strength: "free" })
    );
  });

  it("fails closed and logs an error when the gate call itself throws", async () => {
    mockGenerateObject.mockRejectedValueOnce(new Error("network error"));
    await runScribe({ tripId: "trip-1", message, authorMember: member });
    expect(mockFactsInsert).not.toHaveBeenCalled();
    expect(mockLogAgentRun).toHaveBeenCalledWith(expect.objectContaining({ outcome: "error" }));
  });
});
