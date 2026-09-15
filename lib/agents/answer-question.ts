import { generateText } from "ai";
import { flashModel, estimateCost } from "./model";
import { logAgentRun } from "./log-run";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { DECISION_TYPE_TITLE } from "@/lib/decision-titles";
import type { DecisionRow, CostEstimateRow, TaskRow, BookingRow } from "@/lib/database.types";

const MODEL_ID = "gemini-3.6-flash";

// D3's "Ask the agent — costs, dates, who's said what." The one Q&A surface
// in an otherwise structured-record app: no arithmetic or set logic here
// (spec §7.4 still holds — this only reads what the deterministic layer
// already computed, like locked decisions and the cost estimate), it just
// answers in plain language from what's already on Plan.
export async function answerTripQuestion(tripId: string, question: string): Promise<string> {
  const supabase = createServiceSupabaseClient();
  const [{ data: decisions }, { data: costEstimate }, { data: tasks }, { data: bookings }] = await Promise.all([
    supabase.from("decisions").select().eq("trip_id", tripId),
    supabase.from("cost_estimates").select().eq("trip_id", tripId).maybeSingle(),
    supabase.from("tasks").select().eq("trip_id", tripId),
    supabase.from("bookings").select().eq("trip_id", tripId),
  ]);

  const locked = ((decisions ?? []) as DecisionRow[]).filter((d) => d.state === "LOCKED");
  const lockedSummary =
    locked
      .map((d) => `${DECISION_TYPE_TITLE[d.type] ?? d.type}: ${d.options.find((o) => o.id === d.locked_option)?.label ?? d.locked_option}`)
      .join("; ") || "nothing locked yet";

  const cost = costEstimate as CostEstimateRow | null;
  const costSummary = cost
    ? `₹${cost.min_per_head}-${cost.max_per_head} per head for ${cost.destination}`
    : "no cost estimate yet";

  const allTasks = (tasks ?? []) as TaskRow[];
  const taskSummary = allTasks.length > 0 ? `${allTasks.filter((t) => t.done).length} of ${allTasks.length} checklist items done` : "no checklist yet";

  const allBookings = (bookings ?? []) as BookingRow[];
  const bookingSummary = allBookings.length > 0 ? allBookings.map((b) => b.item).join(", ") : "nothing being tracked yet";

  const prompt = `You are the trip-planning agent for a group trip. Answer the member's question using ONLY the context below — never invent a detail you weren't given. If the context doesn't cover it, say so plainly instead of guessing.

Context:
- Locked decisions: ${lockedSummary}
- Cost estimate: ${costSummary}
- Prep checklist: ${taskSummary}
- Bookings being tracked: ${bookingSummary}

Question: "${question}"

Answer in 1-3 sentences, conversational, no bullet points or headers.`;

  const start = Date.now();
  try {
    const { text, usage } = await generateText({ model: flashModel, prompt });
    await logAgentRun({
      tripId,
      agent: "concierge",
      trigger: "member.ask",
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      cost: estimateCost(MODEL_ID, usage.inputTokens ?? 0, usage.outputTokens ?? 0),
      latencyMs: Date.now() - start,
      outcome: "success",
    });
    return text.trim();
  } catch (error) {
    await logAgentRun({
      tripId,
      agent: "concierge",
      trigger: "member.ask",
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      latencyMs: Date.now() - start,
      outcome: "error",
      errorMessage: String(error),
    });
    return "Something went wrong answering that — try again in a bit.";
  }
}
