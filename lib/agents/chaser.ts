import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { postAgentMessage } from "@/lib/agents/post-agent-message";
import { isPastDeadline, needsDeadlineReminder, nextNudgeTier } from "@/lib/agents/chaser-rules";
import { pickWinningOption } from "@/lib/tally-votes";
import type { DecisionRow, FactRow, MemberRow } from "@/lib/database.types";

const DECISION_TITLES: Record<string, string> = {
  DATES: "the dates",
  DESTINATION: "the destination",
  BUDGET: "the budget",
  STAY: "where to stay",
  ACTIVITY: "the activity",
  CUSTOM: "this",
};

// Chaser's whole job is cron + plain rules (spec §7.4) — no LLM call anywhere
// in this file. Factored out of the Inngest function itself so it's testable
// without Inngest's step harness.
export async function sweepDecisions(tripId: string) {
  const supabase = createServiceSupabaseClient();
  const { data: decisions } = await supabase
    .from("decisions")
    .select()
    .eq("trip_id", tripId)
    .in("state", ["OPEN", "VOTING"]);
  const now = new Date();

  for (const decision of (decisions ?? []) as DecisionRow[]) {
    if (isPastDeadline(decision, now)) {
      const { data: votes } = await supabase
        .from("votes")
        .select("option_id, is_veto")
        .eq("decision_id", decision.id);
      const winner = pickWinningOption(decision.options, votes ?? []);

      if (winner) {
        const label = decision.options.find((o) => o.id === winner)?.label ?? winner;
        await supabase
          .from("decisions")
          .update({
            state: "LOCKED",
            locked_option: winner,
            rationale: "Locked automatically — voting deadline passed.",
          })
          .eq("id", decision.id);
        await postAgentMessage({
          tripId,
          agentName: "chaser",
          body: `Locked: ${label}. Deadline passed, this had the most votes.`,
        });
      } else {
        // Nobody voted at all — locking anything would be a guess, and the
        // LLM/agent layer never gets to guess on someone's behalf (spec D6).
        // Clear the deadline so this doesn't re-trigger every sweep; it's an
        // admin follow-up now, not a Chaser one.
        await supabase.from("decisions").update({ deadline: null }).eq("id", decision.id);
        await postAgentMessage({
          tripId,
          agentName: "chaser",
          body: `Nobody voted before the deadline for ${DECISION_TITLES[decision.type] ?? "this"}. Needs a new deadline.`,
        });
      }
    } else if (needsDeadlineReminder(decision, now)) {
      await supabase.from("decisions").update({ reminded_at: now.toISOString() }).eq("id", decision.id);
      await postAgentMessage({
        tripId,
        agentName: "chaser",
        body: `Voting on ${DECISION_TITLES[decision.type] ?? "this"} closes in the next 24h.`,
      });
    }
  }
}

// D6's silence ladder, batched per trip per sweep so several members crossing
// a threshold in the same tick produce one message, not several in a row
// (spec §8.2: an agent never posts twice in a row without something changing
// between). Tiers 1-2 post to the group board — naming who hasn't answered
// yet mirrors the PRD's own reference copy ("Karan and Farhan haven't — I've
// nudged them"), since non-response isn't the sensitive part; the *private*
// nudge the spec also describes has no channel to send through without
// threads, which don't exist yet. Tier 3 is silent — it only flags the
// member for the admin, who already sees Plan.
export async function sweepIntakeNudges(tripId: string) {
  const supabase = createServiceSupabaseClient();
  const [{ data: members }, { data: facts }] = await Promise.all([
    supabase.from("members").select().eq("trip_id", tripId).eq("status", "active"),
    supabase.from("facts").select("member_id").eq("trip_id", tripId),
  ]);
  const membersWithIntake = new Set(((facts ?? []) as FactRow[]).map((f) => f.member_id));
  const now = new Date();

  const tier1: MemberRow[] = [];
  const tier2: MemberRow[] = [];

  for (const member of (members ?? []) as MemberRow[]) {
    const tier = nextNudgeTier(member, membersWithIntake.has(member.id), now);
    if (tier === 1) tier1.push(member);
    else if (tier === 2) tier2.push(member);
    else if (tier === 3) {
      await supabase.from("members").update({ nudge_tier: 3, flagged_at: now.toISOString() }).eq("id", member.id);
    }
  }

  if (tier1.length > 0) {
    await supabase
      .from("members")
      .update({ nudge_tier: 1 })
      .in("id", tier1.map((m) => m.id));
    await postAgentMessage({
      tripId,
      agentName: "chaser",
      body: `Still waiting on ${joinNames(tier1)} for their 5 questions.`,
    });
  }

  if (tier2.length > 0) {
    await supabase
      .from("members")
      .update({ nudge_tier: 2 })
      .in("id", tier2.map((m) => m.id));
    await postAgentMessage({
      tripId,
      agentName: "chaser",
      body: `Second nudge for ${joinNames(tier2)} — answer the 5 questions, or tell the admin you're flexible.`,
    });
  }
}

function joinNames(members: MemberRow[]): string {
  const names = members.map((m) => m.display_name);
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
