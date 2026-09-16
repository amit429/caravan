import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { resolveCaller, callerAuthError, requireTripOwner } from "@/lib/auth/resolve-caller";
import { getAuthUser } from "@/lib/auth/session";
import { lockTravelOptionSchema } from "@/lib/validation";
import { broadcastTripChange } from "@/lib/realtime/broadcast";

// Admin-only — same shape as locking an accommodation, minus the date
// range (a travel leg doesn't need one). Multiple can be locked at once.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tripId: string; travelOptionId: string }> }
) {
  const { tripId, travelOptionId } = await params;
  const supabase = createServiceSupabaseClient();
  const owner = await requireTripOwner(tripId, supabase);
  if ("error" in owner) return owner.error;

  const body = await request.json();
  const parsed = lockTravelOptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data: travelOption, error } = await supabase
    .from("travel_options")
    .update({ locked: parsed.data.locked })
    .eq("id", travelOptionId)
    .eq("trip_id", tripId)
    .select()
    .single();
  if (error) return NextResponse.json({ error: "could_not_update_travel_option" }, { status: 500 });
  await broadcastTripChange(tripId);
  return NextResponse.json({ travelOption });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ tripId: string; travelOptionId: string }> }
) {
  const { tripId, travelOptionId } = await params;
  const supabase = createServiceSupabaseClient();
  const caller = await resolveCaller(tripId, supabase);
  const authError = callerAuthError(caller);
  if (authError) return authError;

  const { data: travelOption } = await supabase
    .from("travel_options")
    .select("id, member_id")
    .eq("id", travelOptionId)
    .eq("trip_id", tripId)
    .maybeSingle();
  if (!travelOption) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (travelOption.member_id !== caller!.id) {
    const admin = await getAuthUser();
    if (!admin) return NextResponse.json({ error: "not_your_travel_option" }, { status: 403 });
    const { data: trip } = await supabase.from("trips").select("admin_user_id").eq("id", tripId).single();
    if (!trip || trip.admin_user_id !== admin.id) {
      return NextResponse.json({ error: "not_your_travel_option" }, { status: 403 });
    }
  }

  const { error } = await supabase.from("travel_options").delete().eq("id", travelOptionId);
  if (error) return NextResponse.json({ error: "could_not_delete_travel_option" }, { status: 500 });
  await broadcastTripChange(tripId);
  return NextResponse.json({ ok: true });
}
