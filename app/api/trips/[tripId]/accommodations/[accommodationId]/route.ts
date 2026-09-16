import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { resolveCaller, callerAuthError, requireTripOwner } from "@/lib/auth/resolve-caller";
import { getAuthUser } from "@/lib/auth/session";
import { lockAccommodationSchema } from "@/lib/validation";
import { broadcastTripChange } from "@/lib/realtime/broadcast";

// Admin-only — locking (and attaching which dates it covers) is the
// trip-leader call, same as closing a decision. Multiple accommodations can
// be locked at once, each with its own date range, since a longer or
// multi-city trip genuinely books more than one stay.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tripId: string; accommodationId: string }> }
) {
  const { tripId, accommodationId } = await params;
  const supabase = createServiceSupabaseClient();
  const owner = await requireTripOwner(tripId, supabase);
  if ("error" in owner) return owner.error;

  const body = await request.json();
  const parsed = lockAccommodationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data: accommodation, error } = await supabase
    .from("accommodations")
    .update({
      locked: parsed.data.locked,
      start_date: parsed.data.startDate ?? null,
      end_date: parsed.data.endDate ?? null,
    })
    .eq("id", accommodationId)
    .eq("trip_id", tripId)
    .select()
    .single();
  if (error) return NextResponse.json({ error: "could_not_update_accommodation" }, { status: 500 });
  await broadcastTripChange(tripId);
  return NextResponse.json({ accommodation });
}

// Whoever added it can pull it back; the trip's admin can too — same
// moderation shape as ideas.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ tripId: string; accommodationId: string }> }
) {
  const { tripId, accommodationId } = await params;
  const supabase = createServiceSupabaseClient();
  const caller = await resolveCaller(tripId, supabase);
  const authError = callerAuthError(caller);
  if (authError) return authError;

  const { data: accommodation } = await supabase
    .from("accommodations")
    .select("id, member_id")
    .eq("id", accommodationId)
    .eq("trip_id", tripId)
    .maybeSingle();
  if (!accommodation) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (accommodation.member_id !== caller!.id) {
    const admin = await getAuthUser();
    if (!admin) return NextResponse.json({ error: "not_your_accommodation" }, { status: 403 });
    const { data: trip } = await supabase.from("trips").select("admin_user_id").eq("id", tripId).single();
    if (!trip || trip.admin_user_id !== admin.id) {
      return NextResponse.json({ error: "not_your_accommodation" }, { status: 403 });
    }
  }

  const { error } = await supabase.from("accommodations").delete().eq("id", accommodationId);
  if (error) return NextResponse.json({ error: "could_not_delete_accommodation" }, { status: 500 });
  await broadcastTripChange(tripId);
  return NextResponse.json({ ok: true });
}
