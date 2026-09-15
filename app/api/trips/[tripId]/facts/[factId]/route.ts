import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { resolveCaller, callerAuthError } from "@/lib/auth/resolve-caller";
import { broadcastTripChange } from "@/lib/realtime/broadcast";
import { factUpdateSchema } from "@/lib/validation";

// "Only Rhea can change her own facts. Corrections beat anything the agent
// reads, permanently." (docs/design/screens.html E2) — not even the trip's
// admin can edit or delete someone else's fact here, unlike almost every
// other resource in the app. This is the one place that rule is absolute.
type FactLookupResult = { fact: { id: string; member_id: string } } | { error: ReturnType<typeof NextResponse.json> };

async function loadOwnFact(
  tripId: string,
  factId: string,
  callerId: string,
  supabase: ReturnType<typeof createServiceSupabaseClient>
): Promise<FactLookupResult> {
  const { data: fact } = await supabase.from("facts").select("id, member_id").eq("id", factId).eq("trip_id", tripId).maybeSingle();
  if (!fact) return { error: NextResponse.json({ error: "not_found" }, { status: 404 }) };
  if (fact.member_id !== callerId) return { error: NextResponse.json({ error: "not_your_fact" }, { status: 403 }) };
  return { fact };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tripId: string; factId: string }> }
) {
  const { tripId, factId } = await params;
  const supabase = createServiceSupabaseClient();
  const caller = await resolveCaller(tripId, supabase);
  const authError = callerAuthError(caller);
  if (authError) return authError;

  const body = await request.json();
  const parsed = factUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const owned = await loadOwnFact(tripId, factId, caller!.id, supabase);
  if ("error" in owned) return owned.error;

  const { data: updated, error } = await supabase.from("facts").update({ type: parsed.data.type }).eq("id", factId).select().single();
  if (error) return NextResponse.json({ error: "could_not_update_fact" }, { status: 500 });
  await broadcastTripChange(tripId);
  return NextResponse.json({ fact: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ tripId: string; factId: string }> }
) {
  const { tripId, factId } = await params;
  const supabase = createServiceSupabaseClient();
  const caller = await resolveCaller(tripId, supabase);
  const authError = callerAuthError(caller);
  if (authError) return authError;

  const owned = await loadOwnFact(tripId, factId, caller!.id, supabase);
  if ("error" in owned) return owned.error;

  const { error } = await supabase.from("facts").delete().eq("id", factId);
  if (error) return NextResponse.json({ error: "could_not_delete_fact" }, { status: 500 });
  await broadcastTripChange(tripId);
  return NextResponse.json({ ok: true });
}
