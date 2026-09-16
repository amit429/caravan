import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { postAgentMessage } from "@/lib/agents/runtime/post-agent-message";
import { broadcastTripChange } from "@/lib/realtime/broadcast";
import { isPastDeadline, needsDeadlineReminder, nextNudgeTier } from "@/lib/agents/chaser-rules";
import { pickWinningOption } from "@/lib/decisions/tally-votes";
import { handleDecisionLocked } from "@/lib/decisions/on-decision-locked";
import { computeTopDateWindows, formatWindowLabel } from "@/lib/dates/date-solver";
import { buildDecisionOpenedMessage } from "@/lib/decisions/opened-message";
import { runScout } from "@/lib/agents/scout";
import { runDateOutreach } from "@/lib/agents/date-outreach";
import { runDigest } from "@/lib/agents/digest";
import { ensureThread } from "@/lib/threads/ensure-thread";
import type { AvailabilityRow, DateOutreachNudgeRow, DecisionRow, FactRow, MemberRow, MessageRow } from "@/lib/database.types";

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
  const [{ data: decisions }, { data: activeMembers }] = await Promise.all([
    supabase.from("decisions").select().eq("trip_id", tripId).in("state", ["OPEN", "VOTING"]),
    supabase.from("members").select("id").eq("trip_id", tripId).eq("status", "active"),
  ]);
  const activeMemberIds = (activeMembers ?? []).map((m) => (m as Pick<MemberRow, "id">).id);
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
        await handleDecisionLocked(tripId, { type: decision.type });
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
      continue;
    }

    // Quorum lock: independent of any deadline (most decisions never get
    // one — confirmed on the live trip this was built for) — the instant
    // every active member has voted and the leader isn't vetoed, it locks.
    // No "propose then confirm" step; that was an explicit product decision,
    // not an oversight.
    if (activeMemberIds.length > 0) {
      const { data: votes } = await supabase
        .from("votes")
        .select("option_id, is_veto, member_id")
        .eq("decision_id", decision.id);
      const allVotes = votes ?? [];
      const voterIds = new Set(allVotes.map((v) => v.member_id));
      const everyoneVoted = activeMemberIds.every((id) => voterIds.has(id));

      if (everyoneVoted) {
        const winner = pickWinningOption(decision.options, allVotes);
        if (winner) {
          const label = decision.options.find((o) => o.id === winner)?.label ?? winner;
          await supabase
            .from("decisions")
            .update({
              state: "LOCKED",
              locked_option: winner,
              rationale: "Locked automatically — everyone's voted.",
            })
            .eq("id", decision.id);
          await postAgentMessage({
            tripId,
            agentName: "chaser",
            body: `Locked: ${label}. Everyone's voted.`,
          });
          await handleDecisionLocked(tripId, { type: decision.type });
          continue;
        }
        // Everyone voted but every option left standing is vetoed — that's
        // an admin call (override or repropose), not something to guess.
      }
    }

    if (needsDeadlineReminder(decision, now)) {
      await supabase.from("decisions").update({ reminded_at: now.toISOString() }).eq("id", decision.id);
      await postAgentMessage({
        tripId,
        agentName: "chaser",
        body: `Voting on ${DECISION_TITLES[decision.type] ?? "this"} closes in the next 24h.`,
      });
    }
  }
}

// The other half of "trip-leader effort zero": once everyone's answered,
// generating destination options — and once everyone's shared their dates,
// putting a DATES decision up for a vote — shouldn't wait on an admin
// noticing and tapping a button. Same "every active member" bar as the
// quorum lock above, for the same reason: it's already backed by working
// nudge infrastructure (sweepIntakeNudges), not a new dependency.
export async function sweepAutoGeneration(tripId: string) {
  const supabase = createServiceSupabaseClient();
  const [{ data: trip }, { data: activeMembers }, { data: facts }, { data: availability }, { data: decisions }] = await Promise.all([
    supabase.from("trips").select("preferred_trip_days").eq("id", tripId).single(),
    supabase.from("members").select("id").eq("trip_id", tripId).eq("status", "active"),
    supabase.from("facts").select("member_id").eq("trip_id", tripId),
    supabase.from("availability").select().eq("trip_id", tripId),
    supabase.from("decisions").select("type").eq("trip_id", tripId),
  ]);
  const activeMemberIds = (activeMembers ?? []).map((m) => (m as Pick<MemberRow, "id">).id);
  if (activeMemberIds.length === 0) return;

  const existingDecisionTypes = new Set((decisions ?? []).map((d) => (d as Pick<DecisionRow, "type">).type));

  const membersWithIntake = new Set((facts ?? []).map((f) => (f as Pick<FactRow, "member_id">).member_id));
  const everyoneAnswered = activeMemberIds.every((id) => membersWithIntake.has(id));
  if (everyoneAnswered && !existingDecisionTypes.has("DESTINATION")) {
    // Scout has its own internal gate (needs at least one budget fact) and
    // its own failure handling — a best-effort call, same as the manual
    // "Generate destinations" button already is.
    await runScout(tripId);
  }

  const allAvailability = (availability ?? []) as AvailabilityRow[];
  const membersWithAvailability = new Set(allAvailability.map((a) => a.member_id));
  const everyoneSharedDates = activeMemberIds.every((id) => membersWithAvailability.has(id));
  if (everyoneSharedDates && !existingDecisionTypes.has("DATES")) {
    const preferredDays = (trip as { preferred_trip_days: number } | null)?.preferred_trip_days ?? 7;
    const windows = computeTopDateWindows(allAvailability, activeMemberIds, preferredDays);
    if (windows.length > 0) {
      const { data: decision } = await supabase
        .from("decisions")
        .insert({
          trip_id: tripId,
          type: "DATES",
          state: "OPEN",
          options: windows.map((w, i) => ({ id: `window-${i}`, label: formatWindowLabel(w) })),
          quorum_rule: "simple_majority",
          default_on_silence: "none",
        })
        .select()
        .single();
      if (decision) {
        await postAgentMessage({
          tripId,
          agentName: "concierge",
          body: buildDecisionOpenedMessage(decision as DecisionRow),
        });
        await broadcastTripChange(tripId);
      }
    }
  }
}

// "If majority people have dates based on the interval of the trip and 1 or
// 2 people don't, the agent should ask them if they can adjust" — the rule
// half of that: a majority (not everyone, that's sweepDecisions' quorum
// lock's job) fitting the trip's leading date window is what makes a member
// outside it worth privately asking, once, ever, per decision.
export async function sweepDateOutreach(tripId: string) {
  const supabase = createServiceSupabaseClient();
  const [{ data: trip }, { data: decisions }, { data: activeMembers }, { data: availability }] = await Promise.all([
    supabase.from("trips").select("preferred_trip_days").eq("id", tripId).single(),
    supabase.from("decisions").select().eq("trip_id", tripId).eq("type", "DATES").in("state", ["OPEN", "VOTING"]),
    supabase.from("members").select().eq("trip_id", tripId).eq("status", "active"),
    supabase.from("availability").select().eq("trip_id", tripId),
  ]);
  const decision = ((decisions ?? []) as DecisionRow[])[0];
  if (!decision) return;

  const activeMemberRows = (activeMembers ?? []) as MemberRow[];
  const activeMemberIds = activeMemberRows.map((m) => m.id);
  if (activeMemberIds.length === 0) return;

  const preferredDays = (trip as { preferred_trip_days: number } | null)?.preferred_trip_days ?? 7;
  const windows = computeTopDateWindows((availability ?? []) as AvailabilityRow[], activeMemberIds, preferredDays);
  const leading = windows[0];
  if (!leading) return;

  const fitCount = leading.membersIn.length + leading.membersPartial.length;
  const isMajority = fitCount * 2 > activeMemberIds.length;
  const everyoneFits = fitCount === activeMemberIds.length;
  if (!isMajority || everyoneFits) return;

  const outMemberIds = activeMemberIds.filter(
    (id) => !leading.membersIn.includes(id) && !leading.membersPartial.includes(id)
  );
  if (outMemberIds.length === 0) return;

  const { data: existingNudges } = await supabase
    .from("date_outreach_nudges")
    .select("member_id")
    .eq("decision_id", decision.id);
  const alreadyNudged = new Set(
    ((existingNudges ?? []) as Pick<DateOutreachNudgeRow, "member_id">[]).map((n) => n.member_id)
  );

  for (const memberId of outMemberIds) {
    if (alreadyNudged.has(memberId)) continue;
    const member = activeMemberRows.find((m) => m.id === memberId);
    if (!member) continue;
    const threadId = await ensureThread(tripId, memberId, supabase);
    const { posted } = await runDateOutreach(tripId, threadId, member, leading, fitCount, activeMemberIds.length);
    if (posted) {
      await supabase.from("date_outreach_nudges").insert({ decision_id: decision.id, member_id: memberId });
    }
  }
}

const HOUR_MS = 60 * 60 * 1000;
const DIGEST_MIN_HOURS = 3;
const DIGEST_MIN_MEMBER_MESSAGES = 5;

// The "adds their opinions/suggestions... every 3 hours if enough discussion
// has happened" cadence — clock and volume combined (confirmed in Phase 1
// planning), both derived from message history directly rather than a new
// tracked column, same way buildDateContext reads existing rows for context
// instead of storing a duplicate pointer.
export async function sweepDigest(tripId: string) {
  const supabase = createServiceSupabaseClient();
  const { data: trip } = await supabase.from("trips").select("created_at").eq("id", tripId).single();
  if (!trip) return;

  const { data: lastDigestRows } = await supabase
    .from("messages")
    .select("created_at")
    .eq("trip_id", tripId)
    .eq("lane", "group")
    .eq("agent_name", "concierge")
    .contains("metadata", { kind: "digest" })
    .order("created_at", { ascending: false })
    .limit(1);
  const since = lastDigestRows?.[0]?.created_at ?? trip.created_at;

  const hoursSince = (Date.now() - new Date(since).getTime()) / HOUR_MS;
  if (hoursSince < DIGEST_MIN_HOURS) return;

  const { data: newMessages } = await supabase
    .from("messages")
    .select("body, author_type")
    .eq("trip_id", tripId)
    .eq("lane", "group")
    .gt("created_at", since)
    .order("created_at", { ascending: true });

  const allNew = (newMessages ?? []) as Pick<MessageRow, "body" | "author_type">[];
  const memberMessageCount = allNew.filter((m) => m.author_type === "member").length;
  if (memberMessageCount < DIGEST_MIN_MEMBER_MESSAGES) return;

  await runDigest(tripId, allNew);
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
      // Tier 3 is silent to the group (spec §8.2) but the admin's Plan page
      // should still pick up the "flagged" badge live, same as every other
      // state change — postAgentMessage doesn't run here, so broadcast directly.
      await broadcastTripChange(tripId);
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
