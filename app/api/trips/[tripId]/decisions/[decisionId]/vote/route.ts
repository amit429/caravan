import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { resolveCaller, callerAuthError } from "@/lib/auth/resolve-caller";
import { voteSchema } from "@/lib/validation";
import { broadcastTripChange } from "@/lib/realtime/broadcast";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string; decisionId: string }> }
) {
  const { tripId, decisionId } = await params;
  const supabase = createServiceSupabaseClient();
  const caller = await resolveCaller(tripId, supabase);
  const authError = callerAuthError(caller);
  if (authError) return authError;

  const body = await request.json();
  const parsed = voteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data: decision } = await supabase
    .from("decisions")
    .select("id, state, options")
    .eq("id", decisionId)
    .eq("trip_id", tripId)
    .single();
  if (!decision) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (decision.state === "LOCKED") {
    return NextResponse.json({ error: "decision_already_locked" }, { status: 409 });
  }
  const validOptionIds = new Set((decision.options as { id: string }[]).map((o) => o.id));
  if (!validOptionIds.has(parsed.data.optionId)) {
    return NextResponse.json({ error: "unknown_option" }, { status: 400 });
  }

  // Every member's vote weighs the same regardless of participation elsewhere
  // (spec D7) — one vote per member per decision, upserted so re-voting changes
  // your answer instead of adding a second ballot.
  const { data: vote, error } = await supabase
    .from("votes")
    .upsert(
      { decision_id: decisionId, member_id: caller!.id, option_id: parsed.data.optionId, is_veto: parsed.data.isVeto },
      { onConflict: "decision_id,member_id" }
    )
    .select()
    .single();
  if (error) return NextResponse.json({ error: "could_not_save_vote" }, { status: 500 });
  await broadcastTripChange(tripId);
  return NextResponse.json({ vote });
}

// Clicking the option you already voted/vetoed a second time removes your
// ballot entirely, same toggle semantics idea votes already have — this is
// the "clicking again" half of that, which upsert alone can't express.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ tripId: string; decisionId: string }> }
) {
  const { tripId, decisionId } = await params;
  const supabase = createServiceSupabaseClient();
  const caller = await resolveCaller(tripId, supabase);
  const authError = callerAuthError(caller);
  if (authError) return authError;

  const { data: decision } = await supabase
    .from("decisions")
    .select("id, state")
    .eq("id", decisionId)
    .eq("trip_id", tripId)
    .single();
  if (!decision) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (decision.state === "LOCKED") {
    return NextResponse.json({ error: "decision_already_locked" }, { status: 409 });
  }

  await supabase.from("votes").delete().eq("decision_id", decisionId).eq("member_id", caller!.id);
  await broadcastTripChange(tripId);
  return NextResponse.json({ ok: true });
}
