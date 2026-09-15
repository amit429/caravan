import { createServiceSupabaseClient } from "@/lib/supabase/service";
import type { AgentName } from "@/lib/database.types";

// Every agent call is logged (spec §12.4): know cost-per-trip by week 2, not
// month 6. Logging failures are swallowed — a broken log write should never
// take down the agent action that triggered it.
export async function logAgentRun(params: {
  tripId: string;
  agent: AgentName;
  trigger: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  latencyMs: number;
  outcome: "success" | "error" | "skipped";
  errorMessage?: string;
}) {
  try {
    const supabase = createServiceSupabaseClient();
    await supabase.from("agent_runs").insert({
      trip_id: params.tripId,
      agent: params.agent,
      trigger: params.trigger,
      input_tokens: params.inputTokens,
      output_tokens: params.outputTokens,
      cost: params.cost,
      latency_ms: params.latencyMs,
      outcome: params.outcome,
      error_message: params.errorMessage ?? null,
    });
  } catch (error) {
    console.error("failed to log agent run", error);
  }
}
