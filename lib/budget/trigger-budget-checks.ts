import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { postAgentMessage } from "@/lib/agents/runtime/post-agent-message";
import { ensureThread } from "@/lib/threads/ensure-thread";
import { flagMembersOverBudget, budgetCheckThreshold } from "@/lib/budget/cost-flags";
import type { FactRow } from "@/lib/database.types";

// The other half of the cost estimate actually meaning something: once it's
// clear someone's ceiling doesn't cover the realistic cost, ask them
// privately instead of leaving the group to quietly notice "N people are
// over" with no path forward. One pending ask per member at a time (enforced
// by the DB's partial unique index) — a later re-estimate can ask again once
// they've answered, but never piles a second ask on an unanswered one.
export async function triggerBudgetChecks(tripId: string, estimate: { minPerHead: number; maxPerHead: number }): Promise<void> {
  const supabase = createServiceSupabaseClient();
  const { data: facts } = await supabase
    .from("facts")
    .select()
    .eq("trip_id", tripId)
    .eq("category", "budget")
    .is("superseded_by", null);
  const budgetFacts = (facts ?? []) as FactRow[];
  const memberCeilings = budgetFacts.map((f) => ({ memberId: f.member_id, ceiling: (f.value as { amount: number }).amount }));
  const flaggedMemberIds = flagMembersOverBudget(estimate, memberCeilings);
  if (flaggedMemberIds.length === 0) return;

  const threshold = budgetCheckThreshold(estimate);

  const { data: pending } = await supabase
    .from("budget_checks")
    .select("member_id")
    .eq("trip_id", tripId)
    .eq("status", "pending");
  const alreadyPending = new Set((pending ?? []).map((p) => (p as { member_id: string }).member_id));

  for (const memberId of flaggedMemberIds) {
    if (alreadyPending.has(memberId)) continue;

    const { data: check } = await supabase
      .from("budget_checks")
      .insert({ trip_id: tripId, member_id: memberId, threshold_amount: threshold, status: "pending" })
      .select("id")
      .single();
    if (!check) continue;

    const threadId = await ensureThread(tripId, memberId, supabase);
    await postAgentMessage({
      tripId,
      agentName: "quartermaster",
      threadId,
      body: `The cost estimate landed around ₹${threshold.toLocaleString("en-IN")} a head — a bit above what you'd said. Any chance you could stretch to that, or is that a hard limit?`,
      metadata: { kind: "budget_check", budgetCheckId: check.id, thresholdAmount: threshold, status: "pending" },
    });
  }
}
