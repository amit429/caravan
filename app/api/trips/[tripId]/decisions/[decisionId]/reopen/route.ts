import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { postAgentMessage } from "@/lib/agents/runtime/post-agent-message";
import { broadcastTripChange } from "@/lib/realtime/broadcast";
import { DECISION_TYPE_TITLE } from "@/lib/decisions/decision-titles";
import type { DecisionType } from "@/lib/database.types";

// PRD G6 / spec's decision state enum already anticipated REOPENED — this
// was the one lifecycle transition with schema support and no route. Votes
// are left as-is on purpose: "reopen" means give it another look, not wipe
// the board and start over.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ tripId: string; decisionId: string }> }
) {
  const admin = await getAuthUser();
  if (!admin) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { tripId, decisionId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: decision } = await supabase
    .from("decisions")
    .select("id, type, state")
    .eq("id", decisionId)
    .eq("trip_id", tripId)
    .single();
  if (!decision) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (decision.state !== "LOCKED") {
    return NextResponse.json({ error: "decision_not_locked" }, { status: 409 });
  }

  const { data: updated, error } = await supabase
    .from("decisions")
    .update({ state: "REOPENED", locked_option: null, locked_by: null, rationale: null })
    .eq("id", decisionId)
    .select()
    .single();
  if (error) return NextResponse.json({ error: "could_not_reopen_decision" }, { status: 500 });

  await postAgentMessage({
    tripId,
    agentName: "concierge",
    body: `Reopened: ${DECISION_TYPE_TITLE[decision.type as DecisionType] ?? "this"}. The admin wants another look.`,
  });
  await broadcastTripChange(tripId);
  return NextResponse.json({ decision: updated });
}
