import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { requireTripOwner } from "@/lib/auth/resolve-caller";
import { broadcastTripChange } from "@/lib/realtime/broadcast";

// Admin-only, same as creating one — bookings are the admin's tracking list.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ tripId: string; bookingId: string }> }
) {
  const { tripId, bookingId } = await params;
  const supabase = createServiceSupabaseClient();
  const owner = await requireTripOwner(tripId, supabase);
  if ("error" in owner) return owner.error;

  const { error } = await supabase.from("bookings").delete().eq("id", bookingId).eq("trip_id", tripId);
  if (error) return NextResponse.json({ error: "could_not_delete_booking" }, { status: 500 });
  await broadcastTripChange(tripId);
  return NextResponse.json({ ok: true });
}
