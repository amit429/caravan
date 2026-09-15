import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { resolveCaller, callerAuthError } from "@/lib/auth/resolve-caller";
import { bookingStatusSchema } from "@/lib/validation";
import { broadcastTripChange } from "@/lib/realtime/broadcast";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tripId: string; bookingId: string }> }
) {
  const { tripId, bookingId } = await params;
  const supabase = createServiceSupabaseClient();
  const caller = await resolveCaller(tripId, supabase);
  const authError = callerAuthError(caller);
  if (authError) return authError;

  const body = await request.json();
  const parsed = bookingStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data: booking } = await supabase.from("bookings").select("id").eq("id", bookingId).eq("trip_id", tripId).maybeSingle();
  if (!booking) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const targetMemberId = parsed.data.memberId ?? caller!.id;
  if (targetMemberId !== caller!.id && caller!.role !== "admin") {
    return NextResponse.json({ error: "not_your_status" }, { status: 403 });
  }

  const { data: status, error } = await supabase
    .from("booking_status")
    .upsert(
      { booking_id: bookingId, member_id: targetMemberId, booked: parsed.data.booked, updated_at: new Date().toISOString() },
      { onConflict: "booking_id,member_id" }
    )
    .select()
    .single();
  if (error) return NextResponse.json({ error: "could_not_update_status" }, { status: 500 });
  await broadcastTripChange(tripId);
  return NextResponse.json({ status });
}
