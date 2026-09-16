import { describe, expect, it, vi, beforeEach } from "vitest";
import type { MemberRow, MessageRow } from "@/lib/database.types";

const mockGenerateObject = vi.fn();
const mockLogAgentRun = vi.fn();
const mockPostAgentMessage = vi.fn();
const mockFactsInsert = vi.fn();
const mockFactsInsertResult = vi.fn();
const mockFactsUpdate = vi.fn();
const mockAvailabilityInsert = vi.fn();
const mockIdeasInsert = vi.fn();
const mockIdeasExistingLookup = vi.fn();
const mockExtractIdeaMetadata = vi.fn();

vi.mock("ai", () => ({
  generateObject: (...args: unknown[]) => mockGenerateObject(...args),
  // Real NoObjectGeneratedError.isInstance checks a private symbol on real
  // SDK errors — a plain mocked rejection is never one, same as this stub.
  NoObjectGeneratedError: { isInstance: () => false },
}));
vi.mock("./runtime/log-run", () => ({ logAgentRun: (...args: unknown[]) => mockLogAgentRun(...args) }));
vi.mock("./runtime/post-agent-message", () => ({ postAgentMessage: (...args: unknown[]) => mockPostAgentMessage(...args) }));
vi.mock("./runtime/model", () => ({
  flashModel: "mock-flash-model",
  estimateCost: () => 0,
  fastGoogleOptions: { google: { thinkingConfig: { thinkingBudget: 0 } } },
}));
vi.mock("@/lib/ideas/extract-idea", () => ({
  extractIdeaMetadata: (...args: unknown[]) => mockExtractIdeaMetadata(...args),
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
      // No "decisions" branch here on purpose: buildDateContext's lookups are
      // best-effort (wrapped in try/catch) and this mock intentionally
      // doesn't implement `.select()` for either table above, or `decisions`
      // at all — every existing test exercises that graceful-degradation
      // path, not a happy one, and still passes.
      if (table === "ideas") {
        return {
          select: () => ({
            eq: () => ({ eq: () => ({ maybeSingle: () => mockIdeasExistingLookup() }) }),
          }),
          insert: (row: unknown) => mockIdeasInsert(row),
        };
      }
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
  mockIdeasInsert.mockReset().mockResolvedValue({ error: null });
  mockIdeasExistingLookup.mockReset().mockResolvedValue({ data: null });
  mockExtractIdeaMetadata.mockReset().mockResolvedValue({ title: "Scraped Title", note: "Scraped note", imageUrl: null });
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
    const result = await runScribe({ tripId: "trip-1", message, authorMember: member });
    expect(mockFactsInsert).not.toHaveBeenCalled();
    expect(mockLogAgentRun).toHaveBeenCalledWith(expect.objectContaining({ outcome: "error" }));
    expect(result).toEqual({ posted: false });
  });

  it("files a link idea, reusing extractIdeaMetadata and the idea's category", async () => {
    mockGenerateObject
      .mockResolvedValueOnce({ object: { containsExtractableInfo: true }, usage: usage() })
      .mockResolvedValueOnce({
        object: {
          extractions: [
            {
              kind: "idea",
              memberId: "member-1",
              category: "stay",
              title: "Some Hotel",
              url: "https://example.com/hotel",
              confidence: 0.9,
              rationale: "Karan found a hotel",
            },
          ],
        },
        usage: usage(),
      });
    const result = await runScribe({ tripId: "trip-1", message, authorMember: member });
    expect(mockExtractIdeaMetadata).toHaveBeenCalledWith("https://example.com/hotel");
    expect(mockIdeasInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        trip_id: "trip-1",
        member_id: "member-1",
        category: "stay",
        url: "https://example.com/hotel",
        title: "Scraped Title",
      })
    );
    expect(result).toEqual({ posted: true });
  });

  it("files a plain-text idea with no URL directly from the model's title/note", async () => {
    mockGenerateObject
      .mockResolvedValueOnce({ object: { containsExtractableInfo: true }, usage: usage() })
      .mockResolvedValueOnce({
        object: {
          extractions: [
            {
              kind: "idea",
              memberId: "member-1",
              category: "activity",
              title: "Scuba diving",
              note: "Karan wants to go scuba diving",
              confidence: 0.9,
              rationale: "Karan proposed scuba diving",
            },
          ],
        },
        usage: usage(),
      });
    await runScribe({ tripId: "trip-1", message, authorMember: member });
    expect(mockExtractIdeaMetadata).not.toHaveBeenCalled();
    expect(mockIdeasInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "activity",
        url: null,
        title: "Scuba diving",
        note: "Karan wants to go scuba diving",
      })
    );
  });

  it("dedupes a link idea already filed for this trip instead of inserting a second card", async () => {
    mockIdeasExistingLookup.mockResolvedValue({ data: { id: "idea-existing" } });
    mockGenerateObject
      .mockResolvedValueOnce({ object: { containsExtractableInfo: true }, usage: usage() })
      .mockResolvedValueOnce({
        object: {
          extractions: [
            {
              kind: "idea",
              memberId: "member-1",
              category: "travel",
              title: "Flight deal",
              url: "https://example.com/flights",
              confidence: 0.9,
              rationale: "Karan shared a flight link",
            },
          ],
        },
        usage: usage(),
      });
    const result = await runScribe({ tripId: "trip-1", message, authorMember: member });
    expect(mockIdeasInsert).not.toHaveBeenCalled();
    expect(mockPostAgentMessage).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringContaining("already have") })
    );
    expect(result).toEqual({ posted: true });
  });

  it("retries once after a schema-validation failure and succeeds on the second attempt", async () => {
    mockGenerateObject
      .mockResolvedValueOnce({ object: { containsExtractableInfo: true }, usage: usage() })
      .mockRejectedValueOnce(new Error("AI_NoObjectGeneratedError"))
      .mockResolvedValueOnce({
        object: {
          extractions: [
            {
              kind: "availability",
              memberId: "member-1",
              startDate: "2026-11-01",
              endDate: "2026-11-03",
              strength: "blocked",
              confidence: 0.9,
              rationale: "Karan can't make Nov 1-3",
            },
          ],
        },
        usage: usage(),
      });
    const result = await runScribe({ tripId: "trip-1", message, authorMember: member });
    expect(mockGenerateObject).toHaveBeenCalledTimes(3); // gate + failed extract + retried extract
    expect(mockAvailabilityInsert).toHaveBeenCalledWith(expect.objectContaining({ start_date: "2026-11-01" }));
    expect(result).toEqual({ posted: true });
  });

  it("posts an honest fallback receipt instead of staying silent when both extraction attempts fail", async () => {
    mockGenerateObject
      .mockResolvedValueOnce({ object: { containsExtractableInfo: true }, usage: usage() })
      .mockRejectedValueOnce(new Error("AI_NoObjectGeneratedError"))
      .mockRejectedValueOnce(new Error("AI_NoObjectGeneratedError"));
    const result = await runScribe({ tripId: "trip-1", message, authorMember: member });
    expect(mockPostAgentMessage).toHaveBeenCalledWith(
      expect.objectContaining({ agentName: "scribe", body: expect.stringContaining("couldn't pin down") })
    );
    expect(mockLogAgentRun).toHaveBeenCalledWith(expect.objectContaining({ outcome: "error" }));
    // The fallback receipt itself counts as "posted" — a caller relying on
    // this (the You-thread route) must not stack a second, unrelated reply
    // on top of the one that already went out.
    expect(result).toEqual({ posted: true });
  });

  it("returns posted: true after successfully filing a fact", async () => {
    mockGenerateObject
      .mockResolvedValueOnce({ object: { containsExtractableInfo: true }, usage: usage() })
      .mockResolvedValueOnce({
        object: {
          extractions: [
            {
              kind: "fact",
              memberId: "member-1",
              category: "vibe",
              type: "SOFT",
              value: { tags: ["Beach"] },
              confidence: 0.9,
              rationale: "Karan wants beach vibes",
            },
          ],
        },
        usage: usage(),
      });
    const result = await runScribe({ tripId: "trip-1", message, authorMember: member });
    expect(result).toEqual({ posted: true });
  });
});
