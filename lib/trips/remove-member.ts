import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { runScout } from "@/lib/agents/scout";
import { runCostEstimator } from "@/lib/agents/cost-estimator";
import { postAgentMessage } from "@/lib/agents/runtime/post-agent-message";
import type { DecisionRow } from "@/lib/database.types";

type RemoveMemberResult = {
  ok: true;
  destinationRegenerated: boolean;
  costRegenerated: boolean;
};

// Removing someone isn't just hiding their name — their budget/vibe/hard-no
// facts, calendar picks, and votes are exactly what fed whatever the agent
// already proposed. Leaving that data in place would mean Scout/Quartermaster
// keep optimizing for a group that no longer exists. So: erase their
// preference signal, then re-derive anything that isn't locked in yet from
// whoever's left, same as if they'd never been in the conversation.
export async function removeMemberAndRerun(tripId: string, memberId: string): Promise<RemoveMemberResult> {
  const supabase = createServiceSupabaseClient();

  await supabase.from("members").update({ status: "removed" }).eq("id", memberId);

  await Promise.all([
    supabase.from("facts").delete().eq("trip_id", tripId).eq("member_id", memberId),
    supabase.from("availability").delete().eq("trip_id", tripId).eq("member_id", memberId),
    supabase.from("votes").delete().eq("member_id", memberId),
    supabase.from("idea_votes").delete().eq("member_id", memberId),
    supabase.from("booking_status").delete().eq("member_id", memberId),
  ]);

  const { data: decisions } = await supabase.from("decisions").select().eq("trip_id", tripId).eq("type", "DESTINATION");
  const destinationDecisions = (decisions ?? []) as DecisionRow[];
  const locked = destinationDecisions.find((d) => d.state === "LOCKED");
  // Anything not locked yet was never a real commitment — drop it and let
  // Scout propose fresh, rather than leave a stale option set (and its now
  // partly-orphaned votes) sitting alongside whatever comes next.
  const stale = destinationDecisions.filter((d) => d.state !== "LOCKED");

  let destinationRegenerated = false;
  if (stale.length > 0) {
    await supabase.from("decisions").delete().in("id", stale.map((d) => d.id));
    const rerun = await runScout(tripId);
    destinationRegenerated = rerun.ok;
  }

  let costRegenerated = false;
  if (locked) {
    const { data: existingEstimate } = await supabase.from("cost_estimates").select("id").eq("trip_id", tripId).maybeSingle();
    if (existingEstimate) {
      const rerun = await runCostEstimator(tripId);
      costRegenerated = rerun.ok;
    }
  }

  if (destinationRegenerated || costRegenerated) {
    await postAgentMessage({
      tripId,
      agentName: "concierge",
      body: "Someone left the group, so I refreshed the numbers based on who's still here.",
    });
  }

  return { ok: true, destinationRegenerated, costRegenerated };
}
