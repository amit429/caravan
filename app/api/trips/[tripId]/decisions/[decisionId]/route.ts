import { NextResponse } from "next/server";
import { requireTripOwner } from "@/lib/auth/resolve-caller";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { broadcastTripChange } from "@/lib/realtime/broadcast";
import { postAgentMessage } from "@/lib/agents/post-agent-message";
import { DECISION_TYPE_TITLE } from "@/lib/decision-titles";
import type { DecisionRow, DecisionType } from "@/lib/database.types";

// votes.decision_id cascades, so deleting the decision cleans up its votes
// for free. Admin-only: this throws away a real, possibly-locked group
// decision, not a personal item like an idea or booking.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ tripId: string; decisionId: string }> }
) {
  const { tripId, decisionId } = await params;
  const supabase = createServiceSupabaseClient();
  const owner = await requireTripOwner(tripId, supabase);
  if ("error" in owner) return owner.error;

  const { data: decision } = await supabase
    .from("decisions")
    .select("type, state")
    .eq("id", decisionId)
    .eq("trip_id", tripId)
    .maybeSingle();

  const { error } = await supabase.from("decisions").delete().eq("id", decisionId).eq("trip_id", tripId);
  if (error) return NextResponse.json({ error: "delete_failed" }, { status: 500 });

  // The group might have already voted, or built a plan around this being
  // locked — going quiet about it disappearing would be worse than the
  // deletion itself. Always say what happened and invite the next step,
  // same as reopen/close already do for every other decision state change.
  if (decision) {
    const title = DECISION_TYPE_TITLE[(decision as { type: DecisionType }).type] ?? "That decision";
    const wasLocked = (decision as Pick<DecisionRow, "state">).state === "LOCKED";
    await postAgentMessage({
      tripId,
      agentName: "concierge",
      body: `The admin deleted "${title}"${wasLocked ? " — it was already locked in" : ""}. Starting fresh on this one — let's talk it through, and say the word if you want me to put new options together.`,
    });
  }

  await broadcastTripChange(tripId);
  return NextResponse.json({ ok: true });
}
