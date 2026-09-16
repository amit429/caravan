import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGenerateText = vi.fn();
const mockLogAgentRun = vi.fn();
const mockPostAgentMessage = vi.fn();

vi.mock("ai", () => ({ generateText: (...args: unknown[]) => mockGenerateText(...args) }));
vi.mock("./runtime/log-run", () => ({ logAgentRun: (...args: unknown[]) => mockLogAgentRun(...args) }));
vi.mock("./runtime/model", () => ({ flashModel: "mock-flash-model", estimateCost: () => 0 }));
vi.mock("./runtime/post-agent-message", () => ({ postAgentMessage: (...args: unknown[]) => mockPostAgentMessage(...args) }));

import { runDigest } from "./digest";

beforeEach(() => {
  mockGenerateText.mockReset();
  mockLogAgentRun.mockReset();
  mockPostAgentMessage.mockReset();
});

describe("runDigest", () => {
  it("builds a transcript from the given messages and posts the recap to the group with a digest metadata tag", async () => {
    mockGenerateText.mockResolvedValue({
      text: "The group's been debating scuba vs snorkeling. Worth putting scuba up as a formal idea.",
      usage: { inputTokens: 10, outputTokens: 5 },
    });
    const messages = [
      { body: "should we do scuba diving?", author_type: "member" as const },
      { body: "or snorkeling, either works", author_type: "member" as const },
    ];
    const result = await runDigest("trip-1", messages);
    expect(result).toEqual({ posted: true });
    const prompt = mockGenerateText.mock.calls[0][0].prompt as string;
    expect(prompt).toContain("Member: should we do scuba diving?");
    expect(prompt).toContain("Member: or snorkeling, either works");
    expect(mockPostAgentMessage).toHaveBeenCalledWith(
      expect.objectContaining({ tripId: "trip-1", agentName: "concierge", metadata: { kind: "digest" } })
    );
    expect(mockLogAgentRun).toHaveBeenCalledWith(expect.objectContaining({ outcome: "success" }));
  });

  it("returns posted:false and logs an error when the model call fails, without posting", async () => {
    mockGenerateText.mockRejectedValue(new Error("model unavailable"));
    const result = await runDigest("trip-1", [{ body: "hi", author_type: "member" }]);
    expect(result).toEqual({ posted: false });
    expect(mockPostAgentMessage).not.toHaveBeenCalled();
    expect(mockLogAgentRun).toHaveBeenCalledWith(expect.objectContaining({ outcome: "error" }));
  });
});
