import { generateText } from "ai";
import { flashModel, estimateCost } from "./runtime/model";
import { logAgentRun } from "./runtime/log-run";
import { postAgentMessage } from "./runtime/post-agent-message";
import type { MessageRow } from "@/lib/database.types";

const MODEL_ID = "gemini-3.6-flash";

// The "adds their opinions/suggestions based on what the entire group is
// discussing" agent — a recap plus, only when the chat clearly points to
// one, a concrete suggestion. Cadence (3h + enough volume) lives in
// sweepDigest, same deterministic-core/LLM-shell split as every other agent.
export async function runDigest(
  tripId: string,
  recentMessages: Pick<MessageRow, "body" | "author_type">[]
): Promise<{ posted: boolean }> {
  const transcript = recentMessages
    .map((m) => `${m.author_type === "agent" ? "Agent" : "Member"}: ${m.body}`)
    .join("\n");

  const prompt = `Here's what's been discussed in a group trip-planning chat since the last update:

${transcript}

Write a short (2-3 sentence) recap of what's been discussed. If the discussion clearly points to something actionable that hasn't already been formally proposed — an activity or place mentioned more than once, a preference the group seems to be converging on — add one concrete, specific suggestion as a final sentence. If nothing is clearly actionable yet, don't force one; just give the recap. Conversational tone, no bullet points or headers.`;

  const start = Date.now();
  try {
    const { text, usage } = await generateText({ model: flashModel, prompt });
    await logAgentRun({
      tripId,
      agent: "concierge",
      trigger: "sweep.digest",
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      cost: estimateCost(MODEL_ID, usage.inputTokens ?? 0, usage.outputTokens ?? 0),
      latencyMs: Date.now() - start,
      outcome: "success",
    });
    await postAgentMessage({ tripId, agentName: "concierge", body: text.trim(), metadata: { kind: "digest" } });
    return { posted: true };
  } catch (error) {
    await logAgentRun({
      tripId,
      agent: "concierge",
      trigger: "sweep.digest",
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      latencyMs: Date.now() - start,
      outcome: "error",
      errorMessage: String(error),
    });
    return { posted: false };
  }
}
