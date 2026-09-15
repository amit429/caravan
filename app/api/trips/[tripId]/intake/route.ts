import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { resolveCaller, callerAuthError } from "@/lib/auth/resolve-caller";
import { intakeSchema } from "@/lib/validation";
import { broadcastTripChange } from "@/lib/realtime/broadcast";
import { ensureThread } from "@/lib/threads/ensure-thread";
import { postAgentMessage } from "@/lib/agents/post-agent-message";
import { buildIntakeReceipt } from "@/lib/threads/intake-receipt";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  const supabase = createServiceSupabaseClient();
  const caller = await resolveCaller(tripId, supabase);
  const authError = callerAuthError(caller);
  if (authError) return authError;

  const { data: facts } = await supabase
    .from("facts")
    .select()
    .eq("trip_id", tripId)
    .eq("member_id", caller!.id)
    .is("superseded_by", null);
  const { data: availability } = await supabase
    .from("availability")
    .select()
    .eq("trip_id", tripId)
    .eq("member_id", caller!.id);

  return NextResponse.json({
    completed: (facts?.length ?? 0) > 0,
    facts: facts ?? [],
    availability: availability ?? [],
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  const supabase = createServiceSupabaseClient();
  const caller = await resolveCaller(tripId, supabase);
  const authError = callerAuthError(caller);
  if (authError) return authError;
  const memberId = caller!.id;

  const body = await request.json();
  const parsed = intakeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Intake is resubmittable (edit your own answers): replace this member's prior
  // intake-sourced facts/availability rather than accumulating duplicates.
  await supabase.from("availability").delete().eq("trip_id", tripId).eq("member_id", memberId);
  await supabase
    .from("facts")
    .delete()
    .eq("trip_id", tripId)
    .eq("member_id", memberId)
    .eq("source", "intake");

  const { error: availabilityError } = await supabase.from("availability").insert(
    parsed.data.availability.map((window) => ({
      trip_id: tripId,
      member_id: memberId,
      start_date: window.startDate,
      end_date: window.endDate,
      strength: window.strength,
    }))
  );
  if (availabilityError) {
    return NextResponse.json({ error: "could_not_save_availability" }, { status: 500 });
  }

  const factRows = [
    { category: "budget", type: "SOFT" as const, value: { band: parsed.data.budgetBand } },
    { category: "departure_city", type: "SOFT" as const, value: { city: parsed.data.departureCity } },
    { category: "vibe", type: "SOFT" as const, value: { tags: parsed.data.vibe } },
    { category: "hard_no", type: "HARD" as const, value: { items: parsed.data.hardNos } },
  ].map((fact) => ({
    trip_id: tripId,
    member_id: memberId,
    category: fact.category,
    type: fact.type,
    value: fact.value,
    confidence: 1.0,
    source: "intake" as const,
  }));

  const { error: factsError } = await supabase.from("facts").insert(factRows);
  if (factsError) {
    return NextResponse.json({ error: "could_not_save_facts" }, { status: 500 });
  }

  // The agent "confirms what it heard" back in the member's own thread (spec
  // D8 / docs/design/screens.html F/D2) rather than just silently saving —
  // this is what makes intake read as the agent listening, not a form drop.
  const threadId = await ensureThread(tripId, memberId, supabase);
  await postAgentMessage({
    tripId,
    agentName: "concierge",
    threadId,
    body: buildIntakeReceipt({
      budgetBand: parsed.data.budgetBand,
      departureCity: parsed.data.departureCity,
      vibe: parsed.data.vibe,
      hardNos: parsed.data.hardNos,
    }),
  });

  await broadcastTripChange(tripId);
  return NextResponse.json({ ok: true }, { status: 201 });
}
