import { runPlanner } from "@/lib/agents/planner";
import { runCostEstimator } from "@/lib/agents/cost-estimator";
import { runQuartermaster } from "@/lib/agents/quartermaster";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import type { DecisionRow } from "@/lib/database.types";

// Fires whatever a fresh lock unblocks, right when it happens, instead of
// waiting for the admin to notice and press a button — the whole point of
// this phase. Called from every place a decision can transition to LOCKED:
// the admin's manual close route, Chaser's deadline-based lock, and Chaser's
// new quorum-based lock. Every generation call here is already self-gating
// and safe to call more than once (Planner/Cost-estimator upsert; Quarter-
// master declines outright once tasks exist), so this never needs to track
// "have I already fired for this trip" itself.
export async function handleDecisionLocked(tripId: string, decision: Pick<DecisionRow, "type">): Promise<void> {
  if (decision.type === "DESTINATION") {
    await runPlanner(tripId);
    await runCostEstimator(tripId);
  }

  if (decision.type === "DESTINATION" || decision.type === "DATES") {
    const supabase = createServiceSupabaseClient();
    const { data: decisions } = await supabase
      .from("decisions")
      .select("type, state")
      .eq("trip_id", tripId)
      .in("type", ["DESTINATION", "DATES"]);
    const rows = (decisions ?? []) as Pick<DecisionRow, "type" | "state">[];
    const destinationLocked = rows.some((d) => d.type === "DESTINATION" && d.state === "LOCKED");
    const datesLocked = rows.some((d) => d.type === "DATES" && d.state === "LOCKED");
    if (destinationLocked && datesLocked) {
      await runQuartermaster(tripId);
    }
  }
}
