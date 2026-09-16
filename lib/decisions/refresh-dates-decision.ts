import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { computeTopDateWindows, formatWindowLabel } from "@/lib/dates/date-solver";
import { postAgentMessage } from "@/lib/agents/runtime/post-agent-message";
import { broadcastTripChange } from "@/lib/realtime/broadcast";
import { DECISION_TYPE_TITLE } from "@/lib/decisions/decision-titles";
import type { AvailabilityRow, DecisionRow, MemberRow } from "@/lib/database.types";

export type RefreshReason = "availability" | "duration";

const REASON_TEXT: Record<RefreshReason, string> = {
  availability: "Availability changed",
  duration: "The preferred trip length changed",
};

// An OPEN/VOTING DATES decision's options are a snapshot from whenever it
// was created — nothing kept them in sync as new availability came in via
// chat or a duration preference changed later. Locked decisions are real
// commitments and are left alone; anything still open is only ever a
// proposal, so dropping and recomputing clean is safe — same pattern as the
// existing DESTINATION regenerate-on-member-removal path
// (lib/trips/remove-member.ts), just triggered by a different input change.
export async function refreshDatesDecisionIfStale(tripId: string, reason: RefreshReason): Promise<void> {
  const supabase = createServiceSupabaseClient();
  const [{ data: trip }, { data: decisions }, { data: activeMembers }, { data: availability }] = await Promise.all([
    supabase.from("trips").select("preferred_trip_days").eq("id", tripId).single(),
    supabase.from("decisions").select().eq("trip_id", tripId).eq("type", "DATES").in("state", ["OPEN", "VOTING"]),
    supabase.from("members").select("id").eq("trip_id", tripId).eq("status", "active"),
    supabase.from("availability").select().eq("trip_id", tripId),
  ]);
  const openDecision = ((decisions ?? []) as DecisionRow[])[0];
  if (!openDecision) return;

  const activeMemberIds = ((activeMembers ?? []) as Pick<MemberRow, "id">[]).map((m) => m.id);
  const preferredDays = (trip as { preferred_trip_days: number } | null)?.preferred_trip_days ?? 7;
  const windows = computeTopDateWindows((availability ?? []) as AvailabilityRow[], activeMemberIds, preferredDays);
  const freshLabels = windows.map((w) => formatWindowLabel(w));
  const currentLabels = openDecision.options.map((o) => o.label);

  const unchanged =
    freshLabels.length === currentLabels.length && freshLabels.every((label, i) => label === currentLabels[i]);
  if (unchanged) return;

  await supabase.from("decisions").delete().eq("id", openDecision.id);
  if (windows.length === 0) return; // nothing left to offer instead — just drop the stale vote

  const { data: fresh } = await supabase
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

  if (fresh) {
    const optionCount = windows.length;
    const optionWord = optionCount === 1 ? "option" : "options";
    await postAgentMessage({
      tripId,
      agentName: "concierge",
      body: `${REASON_TEXT[reason]}, so I refreshed "${DECISION_TYPE_TITLE.DATES}" with ${optionCount} new ${optionWord} — if you'd already voted, vote again when you get a chance.`,
    });
    await broadcastTripChange(tripId);
  }
}
