import { generateText } from "ai";
import { flashModel, estimateCost } from "./runtime/model";
import { logAgentRun } from "./runtime/log-run";
import { postAgentMessage } from "./runtime/post-agent-message";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { formatWindowLabel } from "@/lib/dates/date-solver";
import type { DateWindow } from "@/lib/dates/date-solver";
import type { AvailabilityRow, MemberRow } from "@/lib/database.types";

const MODEL_ID = "gemini-3.6-flash";

// Deterministic core, LLM shell (spec §7.4) — whether to nudge at all (a
// majority fits a window, this member doesn't) is sweepDateOutreach's plain
// rule; this only writes the actual words, grounded in the member's own
// filed availability so it never invents a reason they supposedly can't make it.
export async function runDateOutreach(
  tripId: string,
  threadId: string,
  member: Pick<MemberRow, "id" | "display_name">,
  window: Pick<DateWindow, "startDate" | "endDate">,
  fitCount: number,
  totalCount: number
): Promise<{ posted: boolean }> {
  const supabase = createServiceSupabaseClient();
  const { data: availability } = await supabase
    .from("availability")
    .select("start_date, end_date, strength")
    .eq("member_id", member.id);

  const theirDates =
    ((availability ?? []) as Pick<AvailabilityRow, "start_date" | "end_date" | "strength">[])
      .map((a) => `${a.start_date} to ${a.end_date} (${a.strength})`)
      .join("; ") || "nothing on file";

  const windowLabel = formatWindowLabel(window);
  const prompt = `You're a trip-planning assistant messaging ${member.display_name} privately, just to them. ${fitCount} of ${totalCount} people in their group can make ${windowLabel}, but ${member.display_name}'s own stated availability doesn't overlap with it. Their stated availability: ${theirDates}.

Write a short (1-2 sentence), warm, specific message asking if they could shift to make ${windowLabel} work, referencing their actual stated dates so it's clear you looked at them. Make clear it's completely fine if they can't. No guilt-tripping, no exclamation points, plain conversational tone. Address them by name.`;

  const start = Date.now();
  try {
    const { text, usage } = await generateText({ model: flashModel, prompt });
    await logAgentRun({
      tripId,
      agent: "chaser",
      trigger: "sweep.date_outreach",
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      cost: estimateCost(MODEL_ID, usage.inputTokens ?? 0, usage.outputTokens ?? 0),
      latencyMs: Date.now() - start,
      outcome: "success",
    });
    await postAgentMessage({ tripId, agentName: "chaser", body: text.trim(), threadId });
    return { posted: true };
  } catch (error) {
    await logAgentRun({
      tripId,
      agent: "chaser",
      trigger: "sweep.date_outreach",
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
